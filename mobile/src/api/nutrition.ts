import api from './client';

// --- Types ---

export interface NutrientTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface GlobalNutritionSettings {
  dailyKcal?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
}

export interface MealFood {
  foodExternalId: string;
  foodName: string;
  nutrientValuePer100Grams: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  amountGrams: number;
}

export interface PlanMeal {
  mealId: string;
  name: string;
  order: number;
  time?: string | null;
  foods: MealFood[];
  mealTotals?: NutrientTotals | null;
}

export interface TodayPlanResponse {
  planId: string;
  planName: string;
  weekNumber: number;
  dayOfWeek: number;
  meals: PlanMeal[];
  dayTotals: NutrientTotals | null;
  globalSettings: GlobalNutritionSettings | null;
}

export interface MealLogDto {
  mealId: string;
  mealName: string;
  eatenAt: string;
  totals: NutrientTotals;
}

export interface TodayLogResponse {
  mealsEaten: MealLogDto[];
  totalConsumed: NutrientTotals;
  remaining: NutrientTotals | null;
}

export interface WeeklyOverviewResponse {
  weekStart: string;
  weekEnd: string;
  compliancePercent: number;
  mealsPlanned: number;
  mealsLogged: number;
  averageDailyMacros: NutrientTotals;
  currentStreak: number;
}

// --- API calls ---

export async function getTodayPlan(): Promise<TodayPlanResponse> {
  const { data } = await api.get<TodayPlanResponse>('/client/nutrition/plan/today');
  return data;
}

export async function getTodayLog(): Promise<TodayLogResponse> {
  const { data } = await api.get<TodayLogResponse>('/client/nutrition/log/today');
  return data;
}

export async function logMealEaten(mealId: string): Promise<void> {
  await api.post(`/client/nutrition/log/meals/${mealId}/eaten`);
}

export async function getWeeklyOverview(): Promise<WeeklyOverviewResponse> {
  const { data } = await api.get<WeeklyOverviewResponse>('/client/progress/weekly');
  return data;
}

// --- Week Plan types ---

export interface PlanDay {
  dayOfWeek: number;
  meals: PlanMeal[];
  dayTotals: NutrientTotals | null;
}

export interface WeekPlanResponse {
  planId: string;
  planName: string;
  weekNumber: number;
  days: PlanDay[];
  globalSettings: GlobalNutritionSettings | null;
}

export interface ShoppingListItem {
  foodExternalId: string;
  foodName: string;
  totalAmountGrams: number;
}

export interface ShoppingListResponse {
  items: ShoppingListItem[];
}

// --- Week Plan API calls ---

export async function getWeekPlan(): Promise<WeekPlanResponse> {
  const { data } = await api.get<WeekPlanResponse>('/client/nutrition/plan/week');
  return data;
}

export async function getShoppingList(params?: {
  weekFrom?: number;
  weekTo?: number;
}): Promise<ShoppingListResponse> {
  const { data } = await api.get<ShoppingListResponse>(
    '/client/nutrition/plan/shopping-list',
    { params },
  );
  return data;
}

// --- Full Plan types (for Nutrition tab browsing) ---

export interface FullPlanWeek {
  weekNumber: number;
  weekStartDate: string;
  weekEndDate: string;
  days: PlanDay[];
}

export interface FullPlanResponse {
  planId: string;
  planName: string;
  startDate: string | null;
  globalSettings: GlobalNutritionSettings | null;
  weeks: FullPlanWeek[];
  publishedWeekCount: number;
  currentWeek: number | null;
  currentDayOfWeek: number | null;
}

export async function getFullPlan(): Promise<FullPlanResponse> {
  const { data } = await api.get<FullPlanResponse>('/client/nutrition/plan/full');
  return data;
}
