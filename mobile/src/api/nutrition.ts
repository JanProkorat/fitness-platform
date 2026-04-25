import api from './client';
import { MealKind } from './generated';
import type {
  NutrientTotals,
  GlobalNutritionSettings,
  MealFood,
  MealRecipe,
  PlanMeal,
  GetTodayPlanResponse,
  MealLogDto,
  MealPhotoDto,
  GetTodayLogResponse,
  GetWeeklyOverviewResponse,
  GetRecipeResponse,
  PlanDay,
  GetWeekPlanResponse,
  ShoppingListItem,
  GetShoppingListResponse,
  FullPlanWeek,
  GetFullPlanResponse,
  GetClientPlansResponse,
  ClientPlanItem,
} from './generated';

// Re-export generated types and enums so consumer imports (`from '@/api/nutrition'`) still work.
export { MealKind };
export type {
  NutrientTotals,
  GlobalNutritionSettings,
  MealFood,
  MealRecipe,
  PlanMeal,
  GetTodayPlanResponse,
  MealLogDto,
  MealPhotoDto,
  GetTodayLogResponse,
  GetWeeklyOverviewResponse,
  GetRecipeResponse,
  PlanDay,
  GetWeekPlanResponse,
  ShoppingListItem,
  GetShoppingListResponse,
  FullPlanWeek,
  GetFullPlanResponse,
  GetClientPlansResponse,
  ClientPlanItem,
};

/**
 * @deprecated Use `GetTodayPlanResponse` from generated. Kept as alias for backward compatibility.
 */
export type TodayPlanResponse = GetTodayPlanResponse;

/**
 * @deprecated Use `GetTodayLogResponse` from generated. Kept as alias for backward compatibility.
 */
export type TodayLogResponse = GetTodayLogResponse;

/**
 * @deprecated Use `GetWeeklyOverviewResponse` from generated. Kept as alias for backward compatibility.
 */
export type WeeklyOverviewResponse = GetWeeklyOverviewResponse;

/**
 * @deprecated Use `GetRecipeResponse` from generated. Kept as alias for backward compatibility.
 */
export type RecipeDetail = GetRecipeResponse;

/**
 * @deprecated Use `GetWeekPlanResponse` from generated. Kept as alias for backward compatibility.
 */
export type WeekPlanResponse = GetWeekPlanResponse;

/**
 * @deprecated Use `GetShoppingListResponse` from generated. Kept as alias for backward compatibility.
 */
export type ShoppingListResponse = GetShoppingListResponse;

/**
 * @deprecated Use `GetFullPlanResponse` from generated. Kept as alias for backward compatibility.
 */
export type FullPlanResponse = GetFullPlanResponse;

/**
 * @deprecated Use `GetClientPlansResponse` from generated. Kept as alias for backward compatibility.
 */
export type ClientPlansResponse = GetClientPlansResponse;

/**
 * @deprecated Use `ClientPlanItem` from generated. Kept as alias for backward compatibility.
 */
export type ClientPlanSummary = ClientPlanItem;

/**
 * PlanStatus string union — used as a query parameter for getClientPlans.
 * The generated enums (NutritionPlanStatus, TrainingPlanStatus) cover this
 * domain but the client plans endpoint mixes both plan types under a single
 * string-based filter. Kept as a client-side type.
 */
export type PlanStatus = 'Draft' | 'Active' | 'Completed' | 'Archived';

// --- API calls ---

export async function getRecipeDetail(recipeId: string): Promise<GetRecipeResponse> {
  const { data } = await api.get<GetRecipeResponse>(`/client/recipes/${recipeId}`);
  return data;
}

export async function getTodayPlan(): Promise<GetTodayPlanResponse> {
  const { data } = await api.get<GetTodayPlanResponse>('/client/nutrition/plan/today');
  return data;
}

export async function getTodayLog(): Promise<GetTodayLogResponse> {
  const { data } = await api.get<GetTodayLogResponse>('/client/nutrition/log/today');
  return data;
}

export interface LogMealEatenOptions {
  photoBlobUrls?: string[];
  note?: string;
}

export async function logMealEaten(mealId: string, opts?: LogMealEatenOptions): Promise<void> {
  await api.post(`/client/nutrition/log/meals/${mealId}/eaten`, opts ?? {});
}

export interface GenerateMealPhotoUploadUrlResponse {
  uploadUrl: string;
  blobUrl: string;
}

/**
 * Request a signed upload URL for a meal diary photo.
 * Uses the dedicated diary endpoint so photos land in the diary/{mealId}/
 * bucket namespace (ImageUploadScope.Diary) rather than avatars/.
 */
export async function generateMealPhotoUploadUrl(
  mealId: string,
  contentType: string,
  sizeBytes: number,
): Promise<GenerateMealPhotoUploadUrlResponse> {
  const { data } = await api.post<GenerateMealPhotoUploadUrlResponse>(
    `/client/nutrition/log/meals/${mealId}/photo-upload-url`,
    { contentType, sizeBytes },
  );
  return data;
}

export interface MealPhotoInput {
  blobUrl: string;
  note?: string | null;
}

export interface SaveMealPhotosOptions {
  photos?: MealPhotoInput[];
  note?: string | null;
}

/**
 * Replaces the photos list and note on a meal log entry with the provided values.
 * The endpoint uses REPLACE semantics: the backend sets Photos to exactly the
 * structured photo objects in the request and sets Note to the request's value
 * (null = clear). UploadedAt is preserved for URLs that already exist in the log.
 * Each photo carries an optional per-photo caption (`note`).
 * Creates the log entry if it does not exist yet.
 */
export async function saveMealPhotos(
  mealId: string,
  opts: SaveMealPhotosOptions = {},
): Promise<void> {
  await api.post(`/client/nutrition/log/meals/${mealId}/photos`, opts);
}

export async function unlogMealEaten(mealId: string): Promise<void> {
  await api.delete(`/client/nutrition/log/meals/${mealId}/eaten`);
}

export async function getWeeklyOverview(): Promise<GetWeeklyOverviewResponse> {
  const { data } = await api.get<GetWeeklyOverviewResponse>('/client/progress/weekly');
  return data;
}

// --- Week Plan API calls ---

export async function getWeekPlan(): Promise<GetWeekPlanResponse> {
  const { data } = await api.get<GetWeekPlanResponse>('/client/nutrition/plan/week');
  return data;
}

export async function getShoppingList(params?: {
  weekFrom?: number;
  weekTo?: number;
}): Promise<GetShoppingListResponse> {
  const { data } = await api.get<GetShoppingListResponse>(
    '/client/nutrition/plan/shopping-list',
    { params },
  );
  return data;
}

export async function getClientPlans(status?: PlanStatus): Promise<GetClientPlansResponse> {
  const { data } = await api.get<GetClientPlansResponse>('/client/plans', {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function getFullPlan(): Promise<GetFullPlanResponse> {
  const { data } = await api.get<GetFullPlanResponse>('/client/nutrition/plan/full');
  return data;
}
