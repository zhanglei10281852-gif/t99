import mongoose from "mongoose";

export type AlertLevel = "yellow" | "orange" | "red";
export type AlertStatus = "pending" | "processing" | "resolved" | "closed";
export type AlertType = "missing_meals";

export interface IAlertReason {
  consecutiveDays: number;
  lastCheckInDate?: Date;
  patternType: string;
  thresholdDays: number;
}

export interface ICareAlert extends mongoose.Document {
  elderlyId: mongoose.Types.ObjectId;
  alertType: AlertType;
  level: AlertLevel;
  status: AlertStatus;
  reason: IAlertReason;
  triggeredAt: Date;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  resolutionNote?: string;
  taskId?: mongoose.Types.ObjectId;
}

const careAlertSchema = new mongoose.Schema<ICareAlert>(
  {
    elderlyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Elderly",
      required: true,
      index: true,
    },
    alertType: {
      type: String,
      enum: ["missing_meals"],
      default: "missing_meals",
      required: true,
    },
    level: {
      type: String,
      enum: ["yellow", "orange", "red"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "resolved", "closed"],
      default: "pending",
      index: true,
    },
    reason: {
      consecutiveDays: { type: Number, required: true },
      lastCheckInDate: Date,
      patternType: { type: String, required: true },
      thresholdDays: { type: Number, required: true },
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolutionNote: String,
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CareTask",
    },
  },
  { timestamps: true },
);

careAlertSchema.index({ elderlyId: 1, status: 1 });
careAlertSchema.index({ level: 1, status: 1, triggeredAt: -1 });

export const CareAlert = mongoose.model<ICareAlert>(
  "CareAlert",
  careAlertSchema,
);
