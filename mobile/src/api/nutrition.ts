import api from './client';

// --- Types ---

export interface NutrientTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface GlobalNutritionSettings {
  dailyKcal?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  fiberGrams?: number | null;
}

export interface MealFood {
  foodExternalId: string;
  foodName: string;
  foodNameCs?: string | null;
  foodNameEn?: string | null;
  foodNameDe?: string | null;
  foodCategory?: string | null;
  nutrientValuePer100Grams: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    saturatedFat?: number;
    salt?: number;
  };
  amountGrams: number;
  note?: string | null;
}

export interface MealRecipe {
  recipeId: string;
  recipeName: string;
  nutrientValuePerServing: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
  servings: number;
  note?: string | null;
  foodCategories?: string[] | null;
}

export type MealKind =
  | 'Breakfast'
  | 'MorningSnack'
  | 'Lunch'
  | 'AfternoonSnack'
  | 'Dinner'
  | 'PreWorkout'
  | 'PostWorkout';

export interface PlanMeal {
  mealId: string;
  kind?: MealKind;
  name: string;
  order: number;
  time?: string | null;
  foods: MealFood[];
  recipes?: MealRecipe[];
  note?: string | null;
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

/** Full recipe detail returned by /client/recipes/{id}. */
export interface RecipeDetail {
  recipeId: string;
  name: string;
  description?: string | null;
  prepTimeMinutes?: number | null;
  steps?: string[] | null;
  note?: string | null;
  foods: MealFood[];
  totalNutrients: NutrientTotals;
  dateCreated: string;
  dateUpdated?: string | null;
}

// --- API calls ---

export async function getRecipeDetail(recipeId: string): Promise<RecipeDetail> {
  const { data } = await api.get<RecipeDetail>(`/client/recipes/${recipeId}`);
  return data;
}

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
  note?: string | null;
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

export type PlanStatus = 'Draft' | 'Active' | 'Completed' | 'Archived';

export interface FullPlanResponse {
  planId: string;
  planName: string;
  startDate: string | null;
  globalSettings: GlobalNutritionSettings | null;
  weeks: FullPlanWeek[];
  publishedWeekCount: number;
  totalWeeks: number;
  currentWeek: number | null;
  currentDayOfWeek: number | null;
  status?: PlanStatus;
  questionnaireResponseId?: string | null;
  dateCompleted?: string | null;
}

/** Lightweight plan summary for listing active + completed plans. */
export interface ClientPlanSummary {
  planId: string;
  planName: string;
  type: 'nutrition' | 'training';
  status: PlanStatus;
  startDate: string | null;
  totalWeeks: number;
  publishedWeekCount: number;
  dateCompleted: string | null;
  questionnaireResponseId: string | null;
}

export interface ClientPlansResponse {
  items: ClientPlanSummary[];
}

export async function getClientPlans(status?: PlanStatus): Promise<ClientPlansResponse> {
  const { data } = await api.get<ClientPlansResponse>('/client/plans', {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function getFullPlan(): Promise<FullPlanResponse> {
  const { data } = await api.get<FullPlanResponse>('/client/nutrition/plan/full');
  return data;
}
