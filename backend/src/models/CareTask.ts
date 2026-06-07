import mongoose from "mongoose";

export type TaskStatus = "pending" | "in_progress" | "completed" | "escalated";
export type TaskResult =
  | "contacted_normal"
  | "contacted_sick"
  | "contacted_outing"
  | "contacted_hospital"
  | "no_contact"
  | "other";

export interface ICareTask extends mongoose.Document {
  alertId: mongoose.Types.ObjectId;
  elderlyId: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  assignedToName?: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: TaskResult;
  resultNote?: string;
  contactMethod?: "phone" | "visit" | "neighbor";
  feedback?: string;
  followUpNeeded?: boolean;
  followUpDate?: Date;
}

const careTaskSchema = new mongoose.Schema<ICareTask>(
  {
    alertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CareAlert",
      required: true,
      index: true,
    },
    elderlyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Elderly",
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    assignedToName: String,
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "escalated"],
      default: "pending",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    startedAt: Date,
    completedAt: Date,
    result: {
      type: String,
      enum: [
        "contacted_normal",
        "contacted_sick",
        "contacted_outing",
        "contacted_hospital",
        "no_contact",
        "other",
      ],
    },
    resultNote: String,
    contactMethod: {
      type: String,
      enum: ["phone", "visit", "neighbor"],
    },
    feedback: String,
    followUpNeeded: { type: Boolean, default: false },
    followUpDate: Date,
  },
  { timestamps: true },
);

careTaskSchema.index({ status: 1, priority: 1, createdAt: -1 });
careTaskSchema.index({ assignedTo: 1, status: 1 });

export const CareTask = mongoose.model<ICareTask>("CareTask", careTaskSchema);
