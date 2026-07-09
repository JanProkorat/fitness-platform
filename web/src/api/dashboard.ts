import api from '@/lib/api';

export interface ClientDashboardItem {
  publicId: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  avatarBlobUrl?: string | null;
  goal: string | null;
  compliancePercent: number;
  currentStreak: number;
  avgDailyKcal: number;
  todayKcal: number;
  kcalGoal: number | null;
  workoutsCompleted: number;
  workoutsPlanned: number;
  lastActivityAt: string | null;
  activeNutritionPlansCount: number;
  hasActiveTrainingPlan: boolean;
}

export interface DashboardSummaryResponse {
  clients: ClientDashboardItem[];
}

export async function getDashboardSummary(): Promise<DashboardSummaryResponse> {
  const { data } = await api.get<DashboardSummaryResponse>('/trainer/dashboard-summary');
  return data;
}
