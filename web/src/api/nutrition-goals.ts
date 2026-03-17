import api from '@/lib/api';

export interface CalculateGoalsRequest {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'Male' | 'Female';
  activityLevel:
    | 'Sedentary'
    | 'LightlyActive'
    | 'ModeratelyActive'
    | 'VeryActive'
    | 'ExtremelyActive';
  goal: 'Cut' | 'Maintain' | 'Bulk';
  proteinPercent?: number;
  carbsPercent?: number;
  fatPercent?: number;
}

export interface MacroTargets {
  dailyKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

export interface CalculateGoalsResponse {
  bmr: number;
  tdee: number;
  adjustedKcal: number;
  macroTargets: MacroTargets;
}

export interface ClientDashboard {
  clientPublicId: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  goals?: string | null;
  linkedAt: string;
  isActive: boolean;
  totalMeasurements: number;
  totalProgressPhotos: number;
  latestMeasurement?: {
    measuredAt: string;
    weightKg?: number | null;
    bodyFatPercentage?: number | null;
  } | null;
  compliancePercent?: number | null;
  currentStreak: number;
}

export async function calculateGoals(
  clientId: string,
  request: CalculateGoalsRequest,
): Promise<CalculateGoalsResponse> {
  const { data } = await api.post<CalculateGoalsResponse>(
    `/nutrition/clients/${clientId}/calculate-goals`,
    request,
  );
  return data;
}

export async function getClientDashboard(
  clientId: string,
): Promise<ClientDashboard> {
  const { data } = await api.get<ClientDashboard>(
    `/trainer/clients/${clientId}`,
  );
  return data;
}
