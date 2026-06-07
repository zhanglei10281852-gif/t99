import request from "@/utils/request";

export type MealPatternType =
  | "daily"
  | "weekdays"
  | "frequent"
  | "occasional"
  | "rare";

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface ElderlyItem {
  _id: string;
  name: string;
  idCard: string;
  age: number;
  gender: string;
  community: string;
  phone: string;
  address: string;
  subsidyCategory: string;
  canteenId: any;
  hasSeniorSubsidy: boolean;
  status: string;
  isAlone: boolean;
  birthday?: string;
  emergencyContact?: EmergencyContact;
  mealPattern?: MealPatternType;
  preferredCanteenId?: any;
  preferredMealSession?: "lunch" | "dinner" | "both";
  lastCheckInDate?: string;
  totalCheckInCount: number;
  createdAt: string;
}

export interface ElderlyQueryParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  community?: string;
  subsidyCategory?: string;
}

export interface ElderlyListResponse {
  total: number;
  list: ElderlyItem[];
  page: number;
  pageSize: number;
}

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

export interface ElderlyProfileStats {
  totalCheckIns: number;
  monthCheckIns: number;
  monthlyAttendanceRate: number;
  consecutiveDays: number;
  missingDays: number;
  lastCheckInDate?: string;
}

export interface ElderlyProfileResponse {
  elderly: ElderlyItem;
  pattern: MealPatternAnalysis;
  stats: ElderlyProfileStats;
  activeAlerts: any[];
  recentCheckIns: any[];
}

export interface CalendarDayItem {
  date: string;
  lunch: boolean;
  dinner: boolean;
  count: number;
}

export interface CalendarResponse {
  year: number;
  month: number;
  daysInMonth: number;
  attendedDays: number;
  attendanceRate: number;
  calendar: CalendarDayItem[];
}

export function getElderlyList(params: ElderlyQueryParams) {
  return request.get<any, ElderlyListResponse>("/elderly", { params });
}

export function getElderlyDetail(id: string) {
  return request.get<any, ElderlyItem>(`/elderly/${id}`);
}

export function createElderly(data: Partial<ElderlyItem>) {
  return request.post<any, ElderlyItem>("/elderly", data);
}

export function updateElderly(id: string, data: Partial<ElderlyItem>) {
  return request.put<any, ElderlyItem>(`/elderly/${id}`, data);
}

export function deleteElderly(id: string) {
  return request.delete<any, { message: string }>(`/elderly/${id}`);
}

export function getElderlyProfile(id: string) {
  return request.get<any, ElderlyProfileResponse>(`/elderly/${id}/profile`);
}

export function getElderlyCheckIns(
  id: string,
  params?: {
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
  },
) {
  return request.get<any, any>(`/elderly/${id}/checkins`, { params });
}

export function getElderlyCalendar(id: string, year?: number, month?: number) {
  return request.get<any, CalendarResponse>(`/elderly/${id}/calendar`, {
    params: { year, month },
  });
}

export function getElderlyAlerts(
  id: string,
  params?: {
    page?: number;
    pageSize?: number;
    status?: string;
  },
) {
  return request.get<any, any>(`/elderly/${id}/alerts`, { params });
}
