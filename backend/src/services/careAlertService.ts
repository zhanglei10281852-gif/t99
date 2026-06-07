import { Elderly } from "../models/Elderly";
import { CareAlert } from "../models/CareAlert";
import { CareTask } from "../models/CareTask";
import { CheckIn } from "../models/CheckIn";
import {
  analyzeMealPattern,
  getMissingDays,
  determineAlertLevel,
  getAlertThreshold,
} from "../utils/mealPattern";
import dayjs from "dayjs";

export interface ScanResult {
  scanned: number;
  newAlerts: number;
  updatedAlerts: number;
  newTasks: number;
}

export async function scanMissingElderly(): Promise<ScanResult> {
  const activeElderly = await Elderly.find({ status: "active" });

  let newAlerts = 0;
  let updatedAlerts = 0;
  let newTasks = 0;

  for (const elderly of activeElderly) {
    try {
      const pattern = await analyzeMealPattern(elderly._id.toString(), 30);

      if (pattern.checkInDays < 3) {
        continue;
      }

      elderly.mealPattern = pattern.patternType;
      elderly.preferredMealSession = pattern.preferredSession;

      const lastCheckIn = await CheckIn.findOne({ elderlyId: elderly._id })
        .sort({ mealDate: -1 })
        .select("mealDate");

      if (lastCheckIn) {
        elderly.lastCheckInDate = lastCheckIn.mealDate;
      }

      await elderly.save();

      const missingDays = await getMissingDays(elderly._id.toString());
      const alertLevel = determineAlertLevel(
        missingDays,
        elderly.mealPattern || "occasional",
        elderly.isAlone,
        elderly.age,
      );

      const existingAlert = await CareAlert.findOne({
        elderlyId: elderly._id,
        status: { $in: ["pending", "processing"] },
      });

      if (alertLevel) {
        const thresholds = getAlertThreshold(
          elderly.mealPattern || "occasional",
          elderly.isAlone,
          elderly.age,
        );

        if (existingAlert) {
          if (existingAlert.level !== alertLevel) {
            existingAlert.level = alertLevel;
            existingAlert.reason = {
              consecutiveDays: missingDays,
              lastCheckInDate: lastCheckIn?.mealDate,
              patternType: elderly.mealPattern || "occasional",
              thresholdDays: thresholds.yellow,
            };
            await existingAlert.save();
            updatedAlerts++;

            if (existingAlert.taskId) {
              const task = await CareTask.findById(existingAlert.taskId);
              if (task && task.status !== "completed") {
                task.priority =
                  alertLevel === "red"
                    ? "urgent"
                    : alertLevel === "orange"
                      ? "high"
                      : "medium";
                await task.save();
              }
            }
          }
        } else {
          const alert = new CareAlert({
            elderlyId: elderly._id,
            alertType: "missing_meals",
            level: alertLevel,
            status: "pending",
            reason: {
              consecutiveDays: missingDays,
              lastCheckInDate: lastCheckIn?.mealDate,
              patternType: elderly.mealPattern || "occasional",
              thresholdDays: thresholds.yellow,
            },
            triggeredAt: new Date(),
          });
          await alert.save();
          newAlerts++;

          const task = new CareTask({
            alertId: alert._id,
            elderlyId: elderly._id,
            status: "pending",
            priority:
              alertLevel === "red"
                ? "urgent"
                : alertLevel === "orange"
                  ? "high"
                  : "medium",
          });
          await task.save();

          alert.taskId = task._id;
          await alert.save();
          newTasks++;
        }
      } else {
        if (existingAlert && existingAlert.status !== "resolved") {
          existingAlert.status = "resolved";
          existingAlert.resolvedAt = new Date();
          existingAlert.resolutionNote = "老人恢复正常就餐";
          await existingAlert.save();
          updatedAlerts++;

          if (existingAlert.taskId) {
            const task = await CareTask.findById(existingAlert.taskId);
            if (task && task.status !== "completed") {
              task.status = "completed";
              task.result = "contacted_normal";
              task.resultNote = "系统自动恢复：老人已恢复正常就餐";
              task.completedAt = new Date();
              await task.save();
            }
          }
        }
      }
    } catch (error) {
      console.error(`扫描老人 ${elderly._id} 失败:`, error);
    }
  }

  return {
    scanned: activeElderly.length,
    newAlerts,
    updatedAlerts,
    newTasks,
  };
}

export async function getUpcomingBirthdays(days: number = 7): Promise<any[]> {
  const today = dayjs();
  const endDate = today.add(days, "day");

  const elderlyList = await Elderly.find({
    status: "active",
    birthday: { $exists: true },
  });

  const upcoming = elderlyList
    .filter((elderly) => {
      if (!elderly.birthday) return false;
      const birthdayThisYear = dayjs(elderly.birthday).year(today.year());
      const diff = birthdayThisYear.diff(today, "day");
      return diff >= 0 && diff < days;
    })
    .sort((a, b) => {
      if (!a.birthday || !b.birthday) return 0;
      const dayA = dayjs(a.birthday).month() * 31 + dayjs(a.birthday).date();
      const dayB = dayjs(b.birthday).month() * 31 + dayjs(b.birthday).date();
      return dayA - dayB;
    });

  return upcoming.map((elderly) => ({
    id: elderly._id,
    name: elderly.name,
    age: elderly.age,
    birthday: elderly.birthday,
    daysUntil: dayjs(elderly.birthday!).year(today.year()).diff(today, "day"),
    isAlone: elderly.isAlone,
    phone: elderly.phone,
    community: elderly.community,
  }));
}
