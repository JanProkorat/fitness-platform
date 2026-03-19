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

export interface OnboardingData {
  sex?: string | null;
  targetWeightKg?: number | null;
  bodyType?: string | null;
  primaryGoal?: string | null;
  timeHorizon?: string | null;
  jobType?: string | null;
  sleepHours?: number | null;
  stressLevel?: number | null;
  currentTrainingFrequency?: string | null;
  desiredTrainingFrequency?: string | null;
  fitnessRating?: number | null;
  preferredActivities?: string | null;
  injuries?: string | null;
  mealsPerDay?: string | null;
  dietaryStyle?: string | null;
  allergies?: string | null;
  planExperience?: string | null;
  pastBlockers?: string | null;
  primaryMotivation?: string | null;
  derivedActivityLevel?: string | null;
  derivedNutritionGoal?: string | null;
  bmr?: number | null;
  tdee?: number | null;
  adjustedKcal?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
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
  onboarding?: OnboardingData | null;
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

export async function updateClientData(
  clientId: string,
  data: {
    weightKg?: number;
    heightCm?: number;
    age?: number;
    sex?: string;
    derivedActivityLevel?: string;
    derivedNutritionGoal?: string;
    bmr?: number;
    tdee?: number;
    adjustedKcal?: number;
    proteinGrams?: number;
    carbsGrams?: number;
    fatGrams?: number;
  },
): Promise<{ message: string }> {
  const { data: res } = await api.put<{ message: string }>(
    `/trainer/clients/${clientId}`,
    data,
  );
  return res;
}
