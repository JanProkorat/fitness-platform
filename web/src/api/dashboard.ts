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
  /** null when the caller's link does not grant the nutrition domain. */
  avgDailyKcal: number | null;
  /** null when the caller's link does not grant the nutrition domain. */
  todayKcal: number | null;
  kcalGoal: number | null;
  /** null when the caller's link does not grant the training domain. */
  workoutsCompleted: number | null;
  /** null when the caller's link does not grant the training domain. */
  workoutsPlanned: number | null;
  lastActivityAt: string | null;
  /** null when the caller's link does not grant the nutrition domain. */
  activeNutritionPlansCount: number | null;
  /** null when the caller's link does not grant the training domain — distinct from false. */
  hasActiveTrainingPlan: boolean | null;
}

export interface DashboardSummaryResponse {
  clients: ClientDashboardItem[];
}

export async function getDashboardSummary(): Promise<DashboardSummaryResponse> {
  const { data } = await api.get<DashboardSummaryResponse>('/trainer/dashboard-summary');
  return data;
}
