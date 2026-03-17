import api from '@/lib/api';
import type {
  NutritionPlanDetail,
  GetPlansResponse,
  CreatePlanRequest,
  UpdatePlanRequest,
  AddMealRequest,
  AddFoodToMealRequest,
  PlanMeal,
  PlanDay,
} from './plan-types';

/** Fetch paginated list of nutrition plans. */
export async function getPlans(params: {
  clientId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<GetPlansResponse> {
  const { data } = await api.get<GetPlansResponse>('/nutrition/plans', { params });
  return data;
}

/** Get a single nutrition plan by ID. */
export async function getPlan(planId: string): Promise<NutritionPlanDetail> {
  const { data } = await api.get<NutritionPlanDetail>(`/nutrition/plans/${planId}`);
  return data;
}

/** Create a new nutrition plan. */
export async function createPlan(request: CreatePlanRequest): Promise<NutritionPlanDetail> {
  const { data } = await api.post<NutritionPlanDetail>('/nutrition/plans', request);
  return data;
}

/** Update an existing nutrition plan (name, global settings). */
export async function updatePlan(
  planId: string,
  request: UpdatePlanRequest,
): Promise<NutritionPlanDetail> {
  const { data } = await api.put<NutritionPlanDetail>(`/nutrition/plans/${planId}`, request);
  return data;
}

/** Delete a nutrition plan. */
export async function deletePlan(planId: string): Promise<void> {
  await api.delete(`/nutrition/plans/${planId}`);
}

/** Publish a draft plan (makes it active). */
export async function publishPlan(planId: string): Promise<NutritionPlanDetail> {
  const { data } = await api.post<NutritionPlanDetail>(`/nutrition/plans/${planId}/publish`);
  return data;
}

/** Duplicate an existing plan. */
export async function duplicatePlan(planId: string, name?: string): Promise<NutritionPlanDetail> {
  const { data } = await api.post<NutritionPlanDetail>(`/nutrition/plans/${planId}/duplicate`, { name: name || undefined });
  return data;
}

/** Add a meal to a specific day. */
export async function addMeal(
  planId: string,
  weekNumber: number,
  dayOfWeek: number,
  request: AddMealRequest,
): Promise<PlanMeal> {
  const { data } = await api.post<PlanMeal>(
    `/nutrition/plans/${planId}/weeks/${weekNumber}/days/${dayOfWeek}/meals`,
    request,
  );
  return data;
}

/** Update a meal (name, order, time). */
export async function updateMeal(
  planId: string,
  weekNumber: number,
  dayOfWeek: number,
  mealId: string,
  request: Partial<AddMealRequest>,
): Promise<PlanMeal> {
  const { data } = await api.put<PlanMeal>(
    `/nutrition/plans/${planId}/weeks/${weekNumber}/days/${dayOfWeek}/meals/${mealId}`,
    request,
  );
  return data;
}

/** Delete a meal from a day. */
export async function deleteMeal(
  planId: string,
  weekNumber: number,
  dayOfWeek: number,
  mealId: string,
): Promise<void> {
  await api.delete(
    `/nutrition/plans/${planId}/weeks/${weekNumber}/days/${dayOfWeek}/meals/${mealId}`,
  );
}

/** Add a food to a meal. */
export async function addFoodToMeal(
  planId: string,
  mealId: string,
  request: AddFoodToMealRequest,
): Promise<void> {
  await api.post(`/nutrition/plans/${planId}/meals/${mealId}/foods`, request);
}

/** Update an entire day (replaces all meals). */
export async function updateDay(
  planId: string,
  weekNumber: number,
  dayOfWeek: number,
  meals: PlanDay['meals'],
): Promise<PlanDay> {
  const { data } = await api.put<PlanDay>(
    `/nutrition/plans/${planId}/weeks/${weekNumber}/days/${dayOfWeek}`,
    { meals },
  );
  return data;
}

/** Remove a food from a meal. */
export async function removeFoodFromMeal(
  planId: string,
  mealId: string,
  foodExternalId: string,
): Promise<void> {
  await api.delete(`/nutrition/plans/${planId}/meals/${mealId}/foods/${foodExternalId}`);
}
