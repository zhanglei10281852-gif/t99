import request from "@/utils/request";

export type AlertLevel = "yellow" | "orange" | "red";
export type AlertStatus = "pending" | "processing" | "resolved" | "closed";
export type AlertType = "missing_meals";

export type TaskStatus = "pending" | "in_progress" | "completed" | "escalated";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskResult =
  | "contacted_normal"
  | "contacted_sick"
  | "contacted_outing"
  | "contacted_hospital"
  | "no_contact"
  | "other";

export interface AlertItem {
  _id: string;
  elderlyId: any;
  alertType: AlertType;
  level: AlertLevel;
  status: AlertStatus;
  reason: {
    consecutiveDays: number;
    lastCheckInDate?: string;
    patternType: string;
    thresholdDays: number;
  };
  triggeredAt: string;
  resolvedAt?: string;
  resolvedBy?: any;
  resolutionNote?: string;
  taskId?: any;
  createdAt: string;
}

export interface TaskItem {
  _id: string;
  alertId: any;
  elderlyId: any;
  assignedTo?: any;
  assignedToName?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: TaskResult;
  resultNote?: string;
  contactMethod?: "phone" | "visit" | "neighbor";
  feedback?: string;
  followUpNeeded?: boolean;
  followUpDate?: string;
}

export interface AlertQueryParams {
  page?: number;
  pageSize?: number;
  level?: string;
  status?: string;
  elderlyId?: string;
}

export interface TaskQueryParams {
  page?: number;
  pageSize?: number;
  status?: string;
  priority?: string;
  assignedTo?: string;
}

export interface AlertListResponse {
  total: number;
  list: AlertItem[];
  page: number;
  pageSize: number;
}

export interface TaskListResponse {
  total: number;
  list: TaskItem[];
  page: number;
  pageSize: number;
}

export interface AlertSummary {
  pending: number;
  processing: number;
  yellow: number;
  orange: number;
  red: number;
  total: number;
}

export interface TaskSummary {
  pending: number;
  inProgress: number;
  completed: number;
  escalated: number;
  total: number;
  completionRate: number;
}

export interface BirthdayItem {
  id: string;
  name: string;
  age: number;
  birthday: string;
  daysUntil: number;
  isAlone: boolean;
  phone: string;
  community: string;
}

export interface BirthdayListResponse {
  days: number;
  total: number;
  list: BirthdayItem[];
}

export interface HolidayItem {
  name: string;
  date: string;
  type: string;
  daysUntil: number;
}

export interface HolidayResponse {
  upcoming: HolidayItem[];
  totalElderly: number;
}

export interface CompleteTaskParams {
  result: TaskResult;
  resultNote?: string;
  contactMethod?: "phone" | "visit" | "neighbor";
  feedback?: string;
  followUpNeeded?: boolean;
  followUpDate?: string;
}

export function getAlertList(params: AlertQueryParams) {
  return request.get<any, AlertListResponse>("/care/alerts", { params });
}

export function getAlertDetail(id: string) {
  return request.get<any, { alert: AlertItem; lastCheckIns: any[] }>(
    `/care/alerts/${id}`,
  );
}

export function updateAlertStatus(
  id: string,
  status: AlertStatus,
  resolutionNote?: string,
) {
  return request.patch<any, AlertItem>(`/care/alerts/${id}/status`, {
    status,
    resolutionNote,
  });
}

export function getAlertSummary() {
  return request.get<any, AlertSummary>("/care/alerts/summary");
}

export function scanAlerts() {
  return request.post<any, any>("/care/alerts/scan");
}

export function getTaskList(params: TaskQueryParams) {
  return request.get<any, TaskListResponse>("/care/tasks", { params });
}

export function getMyTasks(params: {
  page?: number;
  pageSize?: number;
  status?: string;
}) {
  return request.get<any, TaskListResponse>("/care/tasks/mine", { params });
}

export function getTaskDetail(id: string) {
  return request.get<any, TaskItem>(`/care/tasks/${id}`);
}

export function createTask(data: {
  alertId?: string;
  elderlyId: string;
  priority?: TaskPriority;
}) {
  return request.post<any, TaskItem>("/care/tasks", data);
}

export function assignTask(
  id: string,
  assignedTo: string,
  assignedToName?: string,
) {
  return request.patch<any, TaskItem>(`/care/tasks/${id}/assign`, {
    assignedTo,
    assignedToName,
  });
}

export function completeTask(id: string, data: CompleteTaskParams) {
  return request.patch<any, TaskItem>(`/care/tasks/${id}/complete`, data);
}

export function updateTaskStatus(id: string, status: TaskStatus) {
  return request.patch<any, TaskItem>(`/care/tasks/${id}/status`, { status });
}

export function getTaskSummary() {
  return request.get<any, TaskSummary>("/care/tasks/summary");
}

export function getBirthdayList(days: number = 7) {
  return request.get<any, BirthdayListResponse>("/care/birthdays", {
    params: { days },
  });
}

export function getHolidays() {
  return request.get<any, HolidayResponse>("/care/holidays");
}
