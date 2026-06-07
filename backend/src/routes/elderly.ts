import { Router, Request, Response } from "express";
import dayjs from "dayjs";
import { Elderly } from "../models/Elderly";
import { CheckIn } from "../models/CheckIn";
import { CareAlert } from "../models/CareAlert";
import { authMiddleware, requireRoles } from "../middleware/auth";
import { analyzeMealPattern, getMissingDays } from "../utils/mealPattern";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requireRoles("admin", "worker"),
  async (req: Request, res: Response) => {
    try {
      const {
        page = "1",
        pageSize = "10",
        keyword = "",
        community = "",
        subsidyCategory = "",
      } = req.query;

      const query: any = {};
      if (keyword) {
        query.$or = [
          { name: { $regex: keyword, $options: "i" } },
          { idCard: { $regex: keyword, $options: "i" } },
          { phone: { $regex: keyword, $options: "i" } },
        ];
      }
      if (community) query.community = community;
      if (subsidyCategory) query.subsidyCategory = subsidyCategory;

      const pageNum = parseInt(page as string, 10);
      const size = parseInt(pageSize as string, 10);
      const skip = (pageNum - 1) * size;

      const [total, list] = await Promise.all([
        Elderly.countDocuments(query),
        Elderly.find(query)
          .populate("canteenId", "name")
          .skip(skip)
          .limit(size)
          .sort({ createdAt: -1 }),
      ]);

      res.json({
        total,
        list,
        page: pageNum,
        pageSize: size,
      });
    } catch (error) {
      res.status(500).json({ message: "获取老人列表失败" });
    }
  },
);

router.get(
  "/:id",
  requireRoles("admin", "worker"),
  async (req: Request, res: Response) => {
    try {
      const elderly = await Elderly.findById(req.params.id).populate(
        "canteenId",
        "name",
      );
      if (!elderly) {
        return res.status(404).json({ message: "老人信息不存在" });
      }
      res.json(elderly);
    } catch (error) {
      res.status(500).json({ message: "获取老人信息失败" });
    }
  },
);

router.post(
  "/",
  requireRoles("admin", "worker"),
  async (req: Request, res: Response) => {
    try {
      const elderly = new Elderly(req.body);
      await elderly.save();
      await elderly.populate("canteenId", "name");
      res.status(201).json(elderly);
    } catch (error: any) {
      if (error.code === 11000) {
        return res.status(400).json({ message: "身份证号已存在" });
      }
      res.status(500).json({ message: "创建老人信息失败" });
    }
  },
);

router.put(
  "/:id",
  requireRoles("admin", "worker"),
  async (req: Request, res: Response) => {
    try {
      const elderly = await Elderly.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      }).populate("canteenId", "name");

      if (!elderly) {
        return res.status(404).json({ message: "老人信息不存在" });
      }
      res.json(elderly);
    } catch (error: any) {
      if (error.code === 11000) {
        return res.status(400).json({ message: "身份证号已存在" });
      }
      res.status(500).json({ message: "更新老人信息失败" });
    }
  },
);

router.delete(
  "/:id",
  requireRoles("admin", "worker"),
  async (req: Request, res: Response) => {
    try {
      const elderly = await Elderly.findByIdAndDelete(req.params.id);
      if (!elderly) {
        return res.status(404).json({ message: "老人信息不存在" });
      }
      res.json({ message: "删除成功" });
    } catch (error) {
      res.status(500).json({ message: "删除老人信息失败" });
    }
  },
);

router.get("/:id/profile", async (req: Request, res: Response) => {
  try {
    const elderly = await Elderly.findById(req.params.id).populate(
      "canteenId",
      "name",
    );
    if (!elderly) {
      return res.status(404).json({ message: "老人信息不存在" });
    }

    const pattern = await analyzeMealPattern(req.params.id, 30);

    const thisMonthStart = dayjs().startOf("month");
    const thisMonthEnd = dayjs().endOf("month");
    const today = dayjs();
    const daysInMonth = today.date();

    const monthCheckIns = await CheckIn.countDocuments({
      elderlyId: req.params.id,
      mealDate: { $gte: thisMonthStart.toDate(), $lte: thisMonthEnd.toDate() },
    });

    const monthlyAttendanceRate =
      daysInMonth > 0 ? monthCheckIns / daysInMonth : 0;

    const missingDays = await getMissingDays(req.params.id);

    const activeAlerts = await CareAlert.find({
      elderlyId: req.params.id,
      status: { $in: ["pending", "processing"] },
    }).sort({ triggeredAt: -1 });

    const recentCheckIns = await CheckIn.find({ elderlyId: req.params.id })
      .populate("canteenId", "name")
      .sort({ mealDate: -1, mealSession: -1 })
      .limit(20);

    const profile = {
      elderly,
      pattern,
      stats: {
        totalCheckIns: elderly.totalCheckInCount || 0,
        monthCheckIns: monthCheckIns,
        monthlyAttendanceRate: Math.round(monthlyAttendanceRate * 100),
        consecutiveDays: pattern.consecutiveDays,
        missingDays,
        lastCheckInDate: elderly.lastCheckInDate,
      },
      activeAlerts,
      recentCheckIns,
    };

    res.json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取老人画像失败" });
  }
});

router.get("/:id/checkins", async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      pageSize = "20",
      startDate = "",
      endDate = "",
    } = req.query;

    const query: any = { elderlyId: req.params.id };

    if (startDate || endDate) {
      query.mealDate = {};
      if (startDate) query.mealDate.$gte = new Date(startDate as string);
      if (endDate) {
        const end = dayjs(endDate as string)
          .add(1, "day")
          .toDate();
        query.mealDate.$lt = end;
      }
    }

    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * size;

    const [total, list] = await Promise.all([
      CheckIn.countDocuments(query),
      CheckIn.find(query)
        .populate("canteenId", "name")
        .populate("orderId", "orderNo mealStandard")
        .skip(skip)
        .limit(size)
        .sort({ mealDate: -1, mealSession: -1 }),
    ]);

    res.json({
      total,
      list,
      page: pageNum,
      pageSize: size,
    });
  } catch (error) {
    res.status(500).json({ message: "获取签到记录失败" });
  }
});

router.get("/:id/calendar", async (req: Request, res: Response) => {
  try {
    const { year, month } = req.query;

    let startDate: dayjs.Dayjs;
    if (year && month) {
      startDate = dayjs(`${year}-${month}-01`);
    } else {
      startDate = dayjs().startOf("month");
    }

    const endDate = startDate.endOf("month");
    const daysInMonth = startDate.daysInMonth();

    const checkIns = await CheckIn.find({
      elderlyId: req.params.id,
      mealDate: {
        $gte: startDate.startOf("day").toDate(),
        $lte: endDate.endOf("day").toDate(),
      },
    }).sort({ mealDate: 1 });

    const calendarData: Record<
      string,
      { date: string; lunch: boolean; dinner: boolean; count: number }
    > = {};

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = startDate.date(i).format("YYYY-MM-DD");
      calendarData[dateStr] = {
        date: dateStr,
        lunch: false,
        dinner: false,
        count: 0,
      };
    }

    for (const checkIn of checkIns) {
      const dateStr = dayjs(checkIn.mealDate).format("YYYY-MM-DD");
      if (calendarData[dateStr]) {
        if (checkIn.mealSession === "lunch") {
          calendarData[dateStr].lunch = true;
        } else {
          calendarData[dateStr].dinner = true;
        }
        calendarData[dateStr].count++;
      }
    }

    const calendarList = Object.values(calendarData);
    const attendedDays = calendarList.filter((d) => d.count > 0).length;
    const attendanceRate = daysInMonth > 0 ? attendedDays / daysInMonth : 0;

    res.json({
      year: startDate.year(),
      month: startDate.month() + 1,
      daysInMonth,
      attendedDays,
      attendanceRate: Math.round(attendanceRate * 100),
      calendar: calendarList,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取日历数据失败" });
  }
});

router.get("/:id/alerts", async (req: Request, res: Response) => {
  try {
    const { page = "1", pageSize = "10", status = "" } = req.query;

    const query: any = { elderlyId: req.params.id };
    if (status) query.status = status;

    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * size;

    const [total, list] = await Promise.all([
      CareAlert.countDocuments(query),
      CareAlert.find(query)
        .populate("taskId", "status assignedToName result")
        .skip(skip)
        .limit(size)
        .sort({ triggeredAt: -1 }),
    ]);

    res.json({
      total,
      list,
      page: pageNum,
      pageSize: size,
    });
  } catch (error) {
    res.status(500).json({ message: "获取预警记录失败" });
  }
});

export default router;
