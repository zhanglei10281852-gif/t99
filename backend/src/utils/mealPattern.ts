import dayjs from "dayjs";
import { CheckIn } from "../models/CheckIn";
import { MealPatternType } from "../models/Elderly";

export interface MealPatternAnalysis {
  patternType: MealPatternType;
  totalDays: number;
  checkInDays: number;
  attendanceRate: number;
  weekdayCount: number;
  weekendCount: number;
  lunchCount: number;
  dinnerCount: number;
  preferredSession: "lunch" | "dinner" | "both";
  avgMealsPerDay: number;
  consecutiveDays: number;
}

export async function analyzeMealPattern(
  elderlyId: string,
  days: number = 30,
): Promise<MealPatternAnalysis> {
  const endDate = dayjs().endOf("day");
  const startDate = endDate.subtract(days - 1, "day").startOf("day");

  const checkIns = await CheckIn.find({
    elderlyId,
    mealDate: { $gte: startDate.toDate(), $lte: endDate.toDate() },
  }).sort({ mealDate: 1 });

  const dateSet = new Set<string>();
  let lunchCount = 0;
  let dinnerCount = 0;
  let weekdayCount = 0;
  let weekendCount = 0;

  const dailyRecords = new Map<string, { lunch: boolean; dinner: boolean }>();

  for (const checkIn of checkIns) {
    const dateKey = dayjs(checkIn.mealDate).format("YYYY-MM-DD");
    dateSet.add(dateKey);

    if (!dailyRecords.has(dateKey)) {
      dailyRecords.set(dateKey, { lunch: false, dinner: false });
    }

    const dayRecord = dailyRecords.get(dateKey)!;
    if (checkIn.mealSession === "lunch") {
      lunchCount++;
      dayRecord.lunch = true;
    } else {
      dinnerCount++;
      dayRecord.dinner = true;
    }

    const dayOfWeek = dayjs(checkIn.mealDate).day();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      weekdayCount++;
    } else {
      weekendCount++;
    }
  }

  const checkInDays = dateSet.size;
  const attendanceRate = checkInDays / days;

  let patternType: MealPatternType = "rare";
  if (attendanceRate >= 0.9) {
    patternType = "daily";
  } else if (attendanceRate >= 0.7) {
    const weekdayRate = weekdayCount / Math.max(lunchCount + dinnerCount, 1);
    if (weekdayRate >= 0.9) {
      patternType = "weekdays";
    } else {
      patternType = "frequent";
    }
  } else if (attendanceRate >= 0.3) {
    patternType = "occasional";
  } else {
    patternType = "rare";
  }

  let preferredSession: "lunch" | "dinner" | "both" = "both";
  if (lunchCount > 0 && dinnerCount === 0) {
    preferredSession = "lunch";
  } else if (dinnerCount > 0 && lunchCount === 0) {
    preferredSession = "dinner";
  } else if (lunchCount > dinnerCount * 2) {
    preferredSession = "lunch";
  } else if (dinnerCount > lunchCount * 2) {
    preferredSession = "dinner";
  }

  const avgMealsPerDay =
    checkInDays > 0 ? (lunchCount + dinnerCount) / checkInDays : 0;

  let consecutiveDays = 0;
  let currentStreak = 0;
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = endDate.subtract(i, "day").format("YYYY-MM-DD");
    if (dateSet.has(dateStr)) {
      currentStreak++;
    } else {
      if (i < days - 1) {
        break;
      }
      currentStreak = 0;
    }
  }
  consecutiveDays = currentStreak;

  return {
    patternType,
    totalDays: days,
    checkInDays,
    attendanceRate,
    weekdayCount,
    weekendCount,
    lunchCount,
    dinnerCount,
    preferredSession,
    avgMealsPerDay,
    consecutiveDays,
  };
}

export function getAlertThreshold(
  patternType: MealPatternType,
  isAlone: boolean,
  age: number,
): {
  yellow: number;
  orange: number;
  red: number;
} {
  const isHighRisk = isAlone || age >= 80;

  const baseThresholds: Record<
    MealPatternType,
    { yellow: number; orange: number; red: number }
  > = {
    daily: { yellow: 2, orange: 3, red: 4 },
    weekdays: { yellow: 3, orange: 5, red: 7 },
    frequent: { yellow: 4, orange: 6, red: 8 },
    occasional: { yellow: 7, orange: 10, red: 14 },
    rare: { yellow: 14, orange: 21, red: 30 },
  };

  const base = baseThresholds[patternType];

  if (isHighRisk) {
    return {
      yellow: Math.max(1, Math.floor(base.yellow * 0.7)),
      orange: Math.max(2, Math.floor(base.orange * 0.7)),
      red: Math.max(3, Math.floor(base.red * 0.7)),
    };
  }

  return base;
}

export function determineAlertLevel(
  consecutiveDays: number,
  patternType: MealPatternType,
  isAlone: boolean,
  age: number,
): "yellow" | "orange" | "red" | null {
  const thresholds = getAlertThreshold(patternType, isAlone, age);

  if (consecutiveDays >= thresholds.red) {
    return "red";
  }
  if (consecutiveDays >= thresholds.orange) {
    return "orange";
  }
  if (consecutiveDays >= thresholds.yellow) {
    return "yellow";
  }
  return null;
}

export async function getMissingDays(elderlyId: string): Promise<number> {
  const lastCheckIn = await CheckIn.findOne({ elderlyId })
    .sort({ mealDate: -1 })
    .select("mealDate");

  if (!lastCheckIn) {
    return 999;
  }

  const lastDate = dayjs(lastCheckIn.mealDate).startOf("day");
  const today = dayjs().startOf("day");
  return today.diff(lastDate, "day");
}
