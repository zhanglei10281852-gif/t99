import { Router, Request, Response } from "express";
import dayjs from "dayjs";
import { Order } from "../models/Order";
import { Elderly } from "../models/Elderly";
import { SubsidyRecord } from "../models/SubsidyRecord";
import { MonthlySubsidyQuota } from "../models/MonthlySubsidyQuota";
import { Canteen } from "../models/Canteen";
import { CheckIn } from "../models/CheckIn";
import { CareAlert } from "../models/CareAlert";
import { CareTask } from "../models/CareTask";
import { authMiddleware } from "../middleware/auth";
import { getMonthKey } from "../utils/subsidy";
import { config } from "../config";

const router = Router();

router.use(authMiddleware);

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentMonth = getMonthKey(today);

    let canteenFilter: any = {};
    if (req.user?.role === "canteen") {
      canteenFilter.canteenId = req.user.canteenId;
    }

    const [
      todayOrders,
      totalElderly,
      totalCanteens,
      monthSubsidy,
      monthQuota,
      canteenOrders,
      dailyTrend,
      todayCheckIns,
      activeAlerts,
      alertSummary,
      taskSummary,
      attendanceDistribution,
      alertTrend,
      careTaskTrend,
    ] = await Promise.all([
      Order.countDocuments({
        ...canteenFilter,
        mealDate: { $gte: today, $lt: tomorrow },
        status: { $ne: "cancelled" },
      }),
      Elderly.countDocuments({ status: "active" }),
      Canteen.countDocuments({ status: "active" }),
      SubsidyRecord.aggregate([
        {
          $match: {
            month: currentMonth,
            ...(canteenFilter.canteenId
              ? { canteenId: canteenFilter.canteenId }
              : {}),
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalSubsidy" },
            count: { $sum: 1 },
          },
        },
      ]),
      MonthlySubsidyQuota.findOne({ month: currentMonth }),
      Order.aggregate([
        {
          $match: {
            mealDate: { $gte: today, $lt: tomorrow },
            status: { $ne: "cancelled" },
            ...canteenFilter,
          },
        },
        { $group: { _id: "$canteenId", count: { $sum: 1 } } },
        {
          $lookup: {
            from: "canteens",
            localField: "_id",
            foreignField: "_id",
            as: "canteen",
          },
        },
        { $unwind: "$canteen" },
        { $project: { canteenName: "$canteen.name", count: 1 } },
      ]),
      getDailyTrend(canteenFilter),
      CheckIn.countDocuments({
        ...canteenFilter,
        mealDate: { $gte: today, $lt: tomorrow },
      }),
      CareAlert.countDocuments({
        status: { $in: ["pending", "processing"] },
        ...(canteenFilter.canteenId ? {} : {}),
      }),
      getAlertSummary(canteenFilter),
      getTaskSummary(canteenFilter),
      getAttendanceDistribution(canteenFilter),
      getAlertTrend(canteenFilter),
      getCareTaskTrend(canteenFilter),
    ]);

    const subsidyTotal = monthSubsidy[0]?.total || 0;
    const subsidyCount = monthSubsidy[0]?.count || 0;
    const quota = monthQuota || {
      totalQuota: config.monthlySubsidyQuota,
      usedAmount: subsidyTotal,
      remainingAmount: config.monthlySubsidyQuota - subsidyTotal,
    };

    res.json({
      todayOrders,
      totalElderly,
      totalCanteens,
      monthSubsidyTotal: subsidyTotal,
      monthSubsidyCount: subsidyCount,
      monthQuota: {
        totalQuota: quota.totalQuota,
        usedAmount: quota.usedAmount || 0,
        remainingAmount:
          quota.remainingAmount !== undefined
            ? quota.remainingAmount
            : quota.totalQuota - (quota.usedAmount || 0),
      },
      canteenOrders: canteenOrders.sort((a: any, b: any) => b.count - a.count),
      dailyTrend,
      todayCheckIns,
      activeAlerts,
      alertSummary,
      taskSummary,
      attendanceDistribution,
      alertTrend,
      careTaskTrend,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取统计数据失败" });
  }
});

async function getDailyTrend(canteenFilter: any): Promise<any[]> {
  const days: Array<{ date: string; count: number }> = [];
  const today = dayjs();

  for (let i = 29; i >= 0; i--) {
    const date = today.subtract(i, "day");
    const dayStart = date.startOf("day").toDate();
    const dayEnd = date.endOf("day").toDate();

    const count = await Order.countDocuments({
      ...canteenFilter,
      mealDate: { $gte: dayStart, $lt: dayEnd },
      status: { $ne: "cancelled" },
    });

    days.push({
      date: date.format("YYYY-MM-DD"),
      count,
    });
  }

  return days;
}

async function getAlertSummary(canteenFilter: any): Promise<any> {
  const baseQuery = canteenFilter.canteenId ? {} : {};

  const [yellow, orange, red, pending, processing] = await Promise.all([
    CareAlert.countDocuments({
      level: "yellow",
      status: { $in: ["pending", "processing"] },
      ...baseQuery,
    }),
    CareAlert.countDocuments({
      level: "orange",
      status: { $in: ["pending", "processing"] },
      ...baseQuery,
    }),
    CareAlert.countDocuments({
      level: "red",
      status: { $in: ["pending", "processing"] },
      ...baseQuery,
    }),
    CareAlert.countDocuments({ status: "pending", ...baseQuery }),
    CareAlert.countDocuments({ status: "processing", ...baseQuery }),
  ]);

  return {
    yellow,
    orange,
    red,
    pending,
    processing,
    total: pending + processing,
  };
}

async function getTaskSummary(canteenFilter: any): Promise<any> {
  const baseQuery = canteenFilter.canteenId ? {} : {};

  const [pending, inProgress, completed, escalated] = await Promise.all([
    CareTask.countDocuments({ status: "pending", ...baseQuery }),
    CareTask.countDocuments({ status: "in_progress", ...baseQuery }),
    CareTask.countDocuments({ status: "completed", ...baseQuery }),
    CareTask.countDocuments({ status: "escalated", ...baseQuery }),
  ]);

  const total = pending + inProgress + completed + escalated;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { pending, inProgress, completed, escalated, total, completionRate };
}

async function getAttendanceDistribution(canteenFilter: any): Promise<any[]> {
  const elderlyList = await Elderly.find({ status: "active" }).select(
    "_id mealPattern totalCheckInCount",
  );

  const distribution: Record<string, number> = {
    daily: 0,
    weekdays: 0,
    frequent: 0,
    occasional: 0,
    rare: 0,
  };

  for (const elderly of elderlyList) {
    const pattern = elderly.mealPattern || "occasional";
    distribution[pattern] = (distribution[pattern] || 0) + 1;
  }

  return Object.entries(distribution).map(([type, count]) => ({
    type,
    label:
      type === "daily"
        ? "每天来"
        : type === "weekdays"
          ? "工作日来"
          : type === "frequent"
            ? "经常来"
            : type === "occasional"
              ? "偶尔来"
              : "很少来",
    count,
  }));
}

async function getAlertTrend(canteenFilter: any): Promise<any[]> {
  const days: Array<{
    date: string;
    yellow: number;
    orange: number;
    red: number;
    total: number;
  }> = [];
  const today = dayjs();
  const baseQuery = canteenFilter.canteenId ? {} : {};

  for (let i = 29; i >= 0; i--) {
    const date = today.subtract(i, "day");
    const dayStart = date.startOf("day").toDate();
    const dayEnd = date.endOf("day").toDate();

    const matchQuery = {
      triggeredAt: { $gte: dayStart, $lt: dayEnd },
      ...baseQuery,
    };

    const [yellow, orange, red] = await Promise.all([
      CareAlert.countDocuments({ ...matchQuery, level: "yellow" }),
      CareAlert.countDocuments({ ...matchQuery, level: "orange" }),
      CareAlert.countDocuments({ ...matchQuery, level: "red" }),
    ]);

    days.push({
      date: date.format("MM-DD"),
      yellow,
      orange,
      red,
      total: yellow + orange + red,
    });
  }

  return days;
}

async function getCareTaskTrend(canteenFilter: any): Promise<any[]> {
  const days: Array<{ date: string; created: number; completed: number }> = [];
  const today = dayjs();
  const baseQuery = canteenFilter.canteenId ? {} : {};

  for (let i = 29; i >= 0; i--) {
    const date = today.subtract(i, "day");
    const dayStart = date.startOf("day").toDate();
    const dayEnd = date.endOf("day").toDate();

    const [created, completed] = await Promise.all([
      CareTask.countDocuments({
        createdAt: { $gte: dayStart, $lt: dayEnd },
        ...baseQuery,
      }),
      CareTask.countDocuments({
        completedAt: { $gte: dayStart, $lt: dayEnd },
        ...baseQuery,
      }),
    ]);

    days.push({
      date: date.format("MM-DD"),
      created,
      completed,
    });
  }

  return days;
}

export default router;
