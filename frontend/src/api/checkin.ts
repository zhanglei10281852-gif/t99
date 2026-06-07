import request from "@/utils/request";

export type CheckInMethod = "card" | "face" | "staff" | "phone";
export type MealSession = "lunch" | "dinner";

export interface CheckInItem {
  _id: string;
  elderlyId: any;
  orderId?: any;
  canteenId: any;
  checkInTime: string;
  mealDate: string;
  mealSession: MealSession;
  method: CheckInMethod;
  operatorId?: any;
  remark?: string;
  createdAt: string;
}

export interface CheckInQueryParams {
  page?: number;
  pageSize?: number;
  canteenId?: string;
  elderlyId?: string;
  startDate?: string;
  endDate?: string;
  method?: string;
}

export interface CheckInListResponse {
  total: number;
  list: CheckInItem[];
  page: number;
  pageSize: number;
}

export interface QuickCheckInParams {
  keyword: string;
  canteenId: string;
  method?: CheckInMethod;
}

export interface CreateCheckInParams {
  elderlyId: string;
  canteenId: string;
  method: CheckInMethod;
  mealSession: MealSession;
  orderId?: string;
  remark?: string;
}

export interface DeliveryConfirmParams {
  orderId: string;
  method?: CheckInMethod;
}

export interface TodayCheckInStats {
  date: string;
  lunchCount: number;
  dinnerCount: number;
  total: number;
}

export function getCheckInList(params: CheckInQueryParams) {
  return request.get<any, CheckInListResponse>("/checkin", { params });
}

export function getCheckInDetail(id: string) {
  return request.get<any, CheckInItem>(`/checkin/${id}`);
}

export function createCheckIn(data: CreateCheckInParams) {
  return request.post<any, CheckInItem>("/checkin", data);
}

export function quickCheckIn(data: QuickCheckInParams) {
  return request.post<any, CheckInItem>("/checkin/quick", data);
}

export function deliveryConfirm(data: DeliveryConfirmParams) {
  return request.post<any, CheckInItem>("/checkin/delivery-confirm", data);
}

export function getTodayCheckInStats() {
  return request.get<any, TodayCheckInStats>("/checkin/stats/today");
}
