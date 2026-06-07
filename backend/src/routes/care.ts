import { Router, Request, Response } from "express";
import dayjs from "dayjs";
import { CareAlert } from "../models/CareAlert";
import { CareTask, TaskStatus, TaskResult } from "../models/CareTask";
import { Elderly } from "../models/Elderly";
import { CheckIn } from "../models/CheckIn";
import { authMiddleware, requireRoles } from "../middleware/auth";
import {
  scanMissingElderly,
  getUpcomingBirthdays,
} from "../services/careAlertService";

const router = Router();

router.use(authMiddleware);

router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      pageSize = "10",
      level = "",
      status = "",
      elderlyId = "",
    } = req.query;

    const query: any = {};

    if (level) query.level = level;
    if (status) query.status = status;
    if (elderlyId) query.elderlyId = elderlyId;

    if (req.user?.role === "canteen") {
      const canteenId = req.user.canteenId;
      const elderlyList = await Elderly.find({ canteenId }).select("_id");
      query.elderlyId = { $in: elderlyList.map((e) => e._id) };
    }

    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * size;

    const [total, list] = await Promise.all([
      CareAlert.countDocuments(query),
      CareAlert.find(query)
        .populate(
          "elderlyId",
          "name age phone isAlone community emergencyContact",
        )
        .populate("taskId", "status assignedToName")
        .populate("resolvedBy", "name")
        .skip(skip)
        .limit(size)
        .sort({
          level: -1,
          status: 1,
          triggeredAt: -1,
        }),
    ]);

    res.json({
      total,
      list,
      page: pageNum,
      pageSize: size,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取预警列表失败" });
  }
});

router.get("/alerts/summary", async (req: Request, res: Response) => {
  try {
    const query: any = { status: { $in: ["pending", "processing"] } };

    if (req.user?.role === "canteen") {
      const canteenId = req.user.canteenId;
      const elderlyList = await Elderly.find({ canteenId }).select("_id");
      query.elderlyId = { $in: elderlyList.map((e) => e._id) };
    }

    const [pendingCount, processingCount, yellowCount, orangeCount, redCount] =
      await Promise.all([
        CareAlert.countDocuments({ ...query, status: "pending" }),
        CareAlert.countDocuments({ ...query, status: "processing" }),
        CareAlert.countDocuments({ ...query, level: "yellow" }),
        CareAlert.countDocuments({ ...query, level: "orange" }),
        CareAlert.countDocuments({ ...query, level: "red" }),
      ]);

    res.json({
      pending: pendingCount,
      processing: processingCount,
      yellow: yellowCount,
      orange: orangeCount,
      red: redCount,
      total: pendingCount + processingCount,
    });
  } catch (error) {
    res.status(500).json({ message: "获取预警统计失败" });
  }
});

router.get("/alerts/:id", async (req: Request, res: Response) => {
  try {
    const alert = await CareAlert.findById(req.params.id)
      .populate("elderlyId")
      .populate("taskId")
      .populate("resolvedBy", "name");

    if (!alert) {
      return res.status(404).json({ message: "预警不存在" });
    }

    const lastCheckIns = await CheckIn.find({ elderlyId: alert.elderlyId })
      .sort({ mealDate: -1 })
      .limit(10)
      .populate("canteenId", "name");

    res.json({ alert, lastCheckIns });
  } catch (error) {
    res.status(500).json({ message: "获取预警详情失败" });
  }
});

router.patch(
  "/alerts/:id/status",
  requireRoles("admin", "worker"),
  async (req: Request, res: Response) => {
    try {
      const { status, resolutionNote } = req.body;

      const alert = await CareAlert.findById(req.params.id);
      if (!alert) {
        return res.status(404).json({ message: "预警不存在" });
      }

      alert.status = status;

      if (status === "resolved" || status === "closed") {
        alert.resolvedAt = new Date();
        alert.resolvedBy = req.user?._id;
        if (resolutionNote) {
          alert.resolutionNote = resolutionNote;
        }
      }

      await alert.save();
      await alert.populate("elderlyId", "name age phone");

      res.json(alert);
    } catch (error) {
      res.status(500).json({ message: "更新预警状态失败" });
    }
  },
);

router.post(
  "/alerts/scan",
  requireRoles("admin"),
  async (req: Request, res: Response) => {
    try {
      const result = await scanMissingElderly();
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "扫描失败" });
    }
  },
);

router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      pageSize = "10",
      status = "",
      priority = "",
      assignedTo = "",
    } = req.query;

    const query: any = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;

    if (req.user?.role === "canteen") {
      const canteenId = req.user.canteenId;
      const elderlyList = await Elderly.find({ canteenId }).select("_id");
      query.elderlyId = { $in: elderlyList.map((e) => e._id) };
    }

    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * size;

    const [total, list] = await Promise.all([
      CareTask.countDocuments(query),
      CareTask.find(query)
        .populate(
          "elderlyId",
          "name age phone isAlone community address emergencyContact",
        )
        .populate("alertId", "level status reason")
        .populate("assignedTo", "name")
        .skip(skip)
        .limit(size)
        .sort({ priority: -1, createdAt: -1 }),
    ]);

    res.json({
      total,
      list,
      page: pageNum,
      pageSize: size,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取任务列表失败" });
  }
});

router.get("/tasks/mine", async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "未登录" });
    }

    const { page = "1", pageSize = "10", status = "" } = req.query;

    const query: any = { assignedTo: userId };
    if (status) query.status = status;

    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * size;

    const [total, list] = await Promise.all([
      CareTask.countDocuments(query),
      CareTask.find(query)
        .populate(
          "elderlyId",
          "name age phone isAlone community address emergencyContact",
        )
        .populate("alertId", "level status reason")
        .skip(skip)
        .limit(size)
        .sort({ priority: -1, createdAt: -1 }),
    ]);

    res.json({
      total,
      list,
      page: pageNum,
      pageSize: size,
    });
  } catch (error) {
    res.status(500).json({ message: "获取我的任务失败" });
  }
});

router.get("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const task = await CareTask.findById(req.params.id)
      .populate("elderlyId")
      .populate("alertId")
      .populate("assignedTo", "name");

    if (!task) {
      return res.status(404).json({ message: "任务不存在" });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: "获取任务详情失败" });
  }
});

router.post(
  "/tasks",
  requireRoles("admin", "worker"),
  async (req: Request, res: Response) => {
    try {
      const { alertId, elderlyId, priority = "medium" } = req.body;

      if (!elderlyId) {
        return res.status(400).json({ message: "缺少老人ID" });
      }

      const elderly = await Elderly.findById(elderlyId);
      if (!elderly) {
        return res.status(404).json({ message: "老人信息不存在" });
      }

      const task = new CareTask({
        alertId,
        elderlyId,
        status: "pending",
        priority,
      });

      await task.save();
      await task.populate("elderlyId", "name age phone");

      res.status(201).json(task);
    } catch (error) {
      res.status(500).json({ message: "创建任务失败" });
    }
  },
);

router.patch(
  "/tasks/:id/assign",
  requireRoles("admin", "worker"),
  async (req: Request, res: Response) => {
    try {
      const { assignedTo, assignedToName } = req.body;

      const task = await CareTask.findById(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "任务不存在" });
      }

      task.assignedTo = assignedTo;
      task.assignedToName = assignedToName;
      task.status = "in_progress";
      task.startedAt = new Date();

      await task.save();
      await task.populate("elderlyId", "name age phone");

      const alert = await CareAlert.findById(task.alertId);
      if (alert && alert.status === "pending") {
        alert.status = "processing";
        await alert.save();
      }

      res.json(task);
    } catch (error) {
      res.status(500).json({ message: "派发任务失败" });
    }
  },
);

router.patch(
  "/tasks/:id/complete",
  requireRoles("admin", "worker"),
  async (req: Request, res: Response) => {
    try {
      const {
        result,
        resultNote,
        contactMethod,
        feedback,
        followUpNeeded,
        followUpDate,
      } = req.body;

      const task = await CareTask.findById(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "任务不存在" });
      }

      const validResults: TaskResult[] = [
        "contacted_normal",
        "contacted_sick",
        "contacted_outing",
        "contacted_hospital",
        "no_contact",
        "other",
      ];
      if (result && !validResults.includes(result)) {
        return res.status(400).json({ message: "无效的结果类型" });
      }

      task.result = result;
      task.resultNote = resultNote;
      task.contactMethod = contactMethod;
      task.feedback = feedback;
      task.followUpNeeded = followUpNeeded || false;
      if (followUpDate) task.followUpDate = new Date(followUpDate);

      if (result === "no_contact") {
        task.status = "escalated";
      } else if (result) {
        task.status = "completed";
        task.completedAt = new Date();
      }

      await task.save();
      await task.populate("elderlyId", "name age phone");

      if (
        task.alertId &&
        (task.status === "completed" || task.status === "escalated")
      ) {
        const alert = await CareAlert.findById(task.alertId);
        if (alert) {
          if (result === "contacted_normal") {
            alert.status = "resolved";
            alert.resolvedAt = new Date();
            alert.resolutionNote = resultNote || "联系上，一切正常";
            await alert.save();
          } else if (result === "no_contact") {
            alert.status = "processing";
            await alert.save();
          }
        }
      }

      res.json(task);
    } catch (error) {
      res.status(500).json({ message: "完成任务失败" });
    }
  },
);

router.patch(
  "/tasks/:id/status",
  requireRoles("admin", "worker"),
  async (req: Request, res: Response) => {
    try {
      const { status } = req.body;

      const validStatuses: TaskStatus[] = [
        "pending",
        "in_progress",
        "completed",
        "escalated",
      ];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "无效的状态" });
      }

      const task = await CareTask.findById(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "任务不存在" });
      }

      task.status = status;
      if (status === "in_progress" && !task.startedAt) {
        task.startedAt = new Date();
      }
      if (status === "completed" && !task.completedAt) {
        task.completedAt = new Date();
      }

      await task.save();
      await task.populate("elderlyId", "name age phone");

      res.json(task);
    } catch (error) {
      res.status(500).json({ message: "更新任务状态失败" });
    }
  },
);

router.get("/tasks/summary", async (req: Request, res: Response) => {
  try {
    const query: any = {};

    if (req.user?.role === "canteen") {
      const canteenId = req.user.canteenId;
      const elderlyList = await Elderly.find({ canteenId }).select("_id");
      query.elderlyId = { $in: elderlyList.map((e) => e._id) };
    }

    const [pendingCount, inProgressCount, completedCount, escalatedCount] =
      await Promise.all([
        CareTask.countDocuments({ ...query, status: "pending" }),
        CareTask.countDocuments({ ...query, status: "in_progress" }),
        CareTask.countDocuments({ ...query, status: "completed" }),
        CareTask.countDocuments({ ...query, status: "escalated" }),
      ]);

    const totalTasks =
      pendingCount + inProgressCount + completedCount + escalatedCount;
    const completionRate =
      totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    res.json({
      pending: pendingCount,
      inProgress: inProgressCount,
      completed: completedCount,
      escalated: escalatedCount,
      total: totalTasks,
      completionRate,
    });
  } catch (error) {
    res.status(500).json({ message: "获取任务统计失败" });
  }
});

router.get("/birthdays", async (req: Request, res: Response) => {
  try {
    const { days = "7" } = req.query;
    const daysNum = parseInt(days as string, 10);

    const upcoming = await getUpcomingBirthdays(daysNum);

    res.json({
      days: daysNum,
      total: upcoming.length,
      list: upcoming,
    });
  } catch (error) {
    res.status(500).json({ message: "获取生日名单失败" });
  }
});

router.get("/holidays", async (req: Request, res: Response) => {
  try {
    const holidays = [
      { name: "春节", date: "2026-02-17", type: "major" },
      { name: "元宵节", date: "2026-03-03", type: "normal" },
      { name: "清明节", date: "2026-04-05", type: "major" },
      { name: "端午节", date: "2026-06-19", type: "major" },
      { name: "中秋节", date: "2026-09-25", type: "major" },
      { name: "重阳节", date: "2026-10-19", type: "senior" },
      { name: "国庆节", date: "2026-10-01", type: "major" },
      { name: "元旦", date: "2027-01-01", type: "major" },
    ];

    const today = dayjs();
    const upcoming = holidays
      .filter((h) => dayjs(h.date).isAfter(today))
      .slice(0, 5)
      .map((h) => ({
        ...h,
        daysUntil: dayjs(h.date).diff(today, "day"),
      }));

    const elderlyCount = await Elderly.countDocuments({ status: "active" });

    res.json({
      upcoming,
      totalElderly: elderlyCount,
    });
  } catch (error) {
    res.status(500).json({ message: "获取节日信息失败" });
  }
});

export default router;
