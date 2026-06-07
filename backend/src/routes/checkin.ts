import { Router, Request, Response } from "express";
import dayjs from "dayjs";
import { CheckIn, CheckInMethod, MealSession } from "../models/CheckIn";
import { Elderly } from "../models/Elderly";
import { Order } from "../models/Order";
import { Canteen } from "../models/Canteen";
import { authMiddleware, requireRoles } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      pageSize = "10",
      canteenId = "",
      elderlyId = "",
      startDate = "",
      endDate = "",
      method = "",
    } = req.query;

    const query: any = {};

    if (req.user?.role === "canteen") {
      query.canteenId = req.user.canteenId;
    } else if (canteenId) {
      query.canteenId = canteenId;
    }

    if (elderlyId) query.elderlyId = elderlyId;
    if (method) query.method = method;

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
        .populate("elderlyId", "name age phone isAlone")
        .populate("canteenId", "name")
        .populate("operatorId", "name")
        .skip(skip)
        .limit(size)
        .sort({ checkInTime: -1 }),
    ]);

    res.json({
      total,
      list,
      page: pageNum,
      pageSize: size,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取签到记录失败" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const checkIn = await CheckIn.findById(req.params.id)
      .populate("elderlyId")
      .populate("canteenId", "name")
      .populate("operatorId", "name")
      .populate("orderId", "orderNo status");

    if (!checkIn) {
      return res.status(404).json({ message: "签到记录不存在" });
    }

    res.json(checkIn);
  } catch (error) {
    res.status(500).json({ message: "获取签到详情失败" });
  }
});

router.post(
  "/",
  requireRoles("admin", "canteen", "worker"),
  async (req: Request, res: Response) => {
    try {
      const {
        elderlyId,
        canteenId,
        method,
        mealSession,
        orderId,
        remark = "",
      } = req.body;

      if (!elderlyId || !canteenId || !method || !mealSession) {
        return res.status(400).json({ message: "缺少必要参数" });
      }

      const validMethods: CheckInMethod[] = ["card", "face", "staff", "phone"];
      if (!validMethods.includes(method)) {
        return res.status(400).json({ message: "无效的签到方式" });
      }

      const validSessions: MealSession[] = ["lunch", "dinner"];
      if (!validSessions.includes(mealSession)) {
        return res.status(400).json({ message: "无效的餐段" });
      }

      const elderly = await Elderly.findById(elderlyId);
      if (!elderly) {
        return res.status(404).json({ message: "老人信息不存在" });
      }

      const canteen = await Canteen.findById(canteenId);
      if (!canteen) {
        return res.status(404).json({ message: "助餐点不存在" });
      }

      if (
        req.user?.role === "canteen" &&
        canteenId !== req.user.canteenId?.toString()
      ) {
        return res.status(403).json({ message: "无权在该助餐点签到" });
      }

      const now = new Date();
      const mealDate = dayjs().startOf("day").toDate();

      const existing = await CheckIn.findOne({
        elderlyId,
        mealDate,
        mealSession,
      });

      if (existing) {
        return res.status(400).json({ message: "该餐段已签到" });
      }

      let finalOrderId = orderId;
      if (!finalOrderId) {
        const todayOrder = await Order.findOne({
          elderlyId,
          mealDate,
          mealType: mealSession,
          status: { $ne: "cancelled" },
        });
        if (todayOrder) {
          finalOrderId = todayOrder._id;
        }
      }

      const checkIn = new CheckIn({
        elderlyId,
        orderId: finalOrderId,
        canteenId,
        checkInTime: now,
        mealDate,
        mealSession,
        method,
        operatorId: req.user?._id,
        remark,
      });

      await checkIn.save();

      elderly.lastCheckInDate = mealDate;
      elderly.totalCheckInCount = (elderly.totalCheckInCount || 0) + 1;
      await elderly.save();

      if (finalOrderId) {
        const order = await Order.findById(finalOrderId);
        if (order && order.status !== "completed") {
          order.status = "completed";
          order.completedAt = now;
          await order.save();
        }
      }

      await checkIn.populate("elderlyId", "name age phone");
      await checkIn.populate("canteenId", "name");

      res.status(201).json(checkIn);
    } catch (error: any) {
      if (error.code === 11000) {
        return res.status(400).json({ message: "该餐段已签到" });
      }
      console.error(error);
      res.status(500).json({ message: "签到失败" });
    }
  },
);

router.post(
  "/quick",
  requireRoles("admin", "canteen", "worker"),
  async (req: Request, res: Response) => {
    try {
      const { keyword, canteenId, method = "staff" } = req.body;

      if (!keyword || !canteenId) {
        return res.status(400).json({ message: "缺少必要参数" });
      }

      const elderly = await Elderly.findOne({
        $or: [
          { idCard: keyword },
          { phone: keyword },
          { name: { $regex: keyword, $options: "i" } },
        ],
        status: "active",
      });

      if (!elderly) {
        return res.status(404).json({ message: "未找到匹配的老人" });
      }

      const now = new Date();
      const hour = now.getHours();
      let mealSession: MealSession = "lunch";
      if (hour >= 17) {
        mealSession = "dinner";
      }

      const mealDate = dayjs().startOf("day").toDate();

      const existing = await CheckIn.findOne({
        elderlyId: elderly._id,
        mealDate,
        mealSession,
      });

      if (existing) {
        return res.status(400).json({
          message: `该老人今日${mealSession === "lunch" ? "午餐" : "晚餐"}已签到`,
        });
      }

      const order = await Order.findOne({
        elderlyId: elderly._id,
        mealDate,
        mealType: mealSession,
        status: { $ne: "cancelled" },
      });

      const checkIn = new CheckIn({
        elderlyId: elderly._id,
        orderId: order?._id,
        canteenId,
        checkInTime: now,
        mealDate,
        mealSession,
        method,
        operatorId: req.user?._id,
      });

      await checkIn.save();

      elderly.lastCheckInDate = mealDate;
      elderly.totalCheckInCount = (elderly.totalCheckInCount || 0) + 1;
      await elderly.save();

      if (order && order.status !== "completed") {
        order.status = "completed";
        order.completedAt = now;
        await order.save();
      }

      await checkIn.populate("elderlyId", "name age phone");
      await checkIn.populate("canteenId", "name");

      res.status(201).json(checkIn);
    } catch (error: any) {
      if (error.code === 11000) {
        return res.status(400).json({ message: "该餐段已签到" });
      }
      console.error(error);
      res.status(500).json({ message: "快速签到失败" });
    }
  },
);

router.post(
  "/delivery-confirm",
  requireRoles("admin", "canteen", "worker"),
  async (req: Request, res: Response) => {
    try {
      const { orderId, method = "staff" } = req.body;

      if (!orderId) {
        return res.status(400).json({ message: "缺少订单ID" });
      }

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "订单不存在" });
      }

      if (order.deliveryType !== "delivery") {
        return res.status(400).json({ message: "该订单不是送餐订单" });
      }

      const elderly = await Elderly.findById(order.elderlyId);
      if (!elderly) {
        return res.status(404).json({ message: "老人信息不存在" });
      }

      const mealDate = dayjs(order.mealDate).startOf("day").toDate();
      const mealSession = order.mealType as MealSession;

      const existing = await CheckIn.findOne({
        elderlyId: order.elderlyId,
        mealDate,
        mealSession,
      });

      if (existing) {
        return res.status(400).json({ message: "该订单已确认送达" });
      }

      const now = new Date();

      const checkIn = new CheckIn({
        elderlyId: order.elderlyId,
        orderId: order._id,
        canteenId: order.canteenId,
        checkInTime: now,
        mealDate,
        mealSession,
        method,
        operatorId: req.user?._id,
        remark: "送餐签收",
      });

      await checkIn.save();

      elderly.lastCheckInDate = mealDate;
      elderly.totalCheckInCount = (elderly.totalCheckInCount || 0) + 1;
      await elderly.save();

      order.status = "completed";
      order.completedAt = now;
      if (order.deliveryInfo) {
        order.deliveryInfo.actualTime = dayjs(now).format("HH:mm");
      }
      await order.save();

      await checkIn.populate("elderlyId", "name age phone");
      await checkIn.populate("canteenId", "name");

      res.status(201).json(checkIn);
    } catch (error: any) {
      if (error.code === 11000) {
        return res.status(400).json({ message: "该餐段已签到" });
      }
      console.error(error);
      res.status(500).json({ message: "送餐签收失败" });
    }
  },
);

router.get("/stats/today", async (req: Request, res: Response) => {
  try {
    const mealDate = dayjs().startOf("day").toDate();
    const query: any = { mealDate };

    if (req.user?.role === "canteen") {
      query.canteenId = req.user.canteenId;
    }

    const [lunchCount, dinnerCount, total] = await Promise.all([
      CheckIn.countDocuments({ ...query, mealSession: "lunch" }),
      CheckIn.countDocuments({ ...query, mealSession: "dinner" }),
      CheckIn.countDocuments(query),
    ]);

    res.json({
      date: mealDate,
      lunchCount,
      dinnerCount,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: "获取今日签到统计失败" });
  }
});

export default router;
