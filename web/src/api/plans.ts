import api from '@/lib/api';
import type {
  NutritionPlanDetail,
  GetPlansResponse,
  CreatePlanRequest,
  UpdatePlanRequest,
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

/** Full-state update of a nutrition plan. */
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

/** Mark a nutrition plan as completed. */
export async function completePlan(
  planId: string,
  version: number,
): Promise<NutritionPlanDetail> {
  const { data } = await api.post<NutritionPlanDetail>(
    `/nutrition/plans/${planId}/complete`,
    { version },
  );
  return data;
}

/** Link or unlink a questionnaire response to a nutrition plan. */
export async function linkQuestionnaire(
  planId: string,
  questionnaireResponseId: string | null,
  version: number,
): Promise<NutritionPlanDetail> {
  const { data } = await api.put<NutritionPlanDetail>(
    `/nutrition/plans/${planId}/link-questionnaire`,
    { questionnaireResponseId, version },
  );
  return data;
}

/** Publish a single week of a nutrition plan. */
export async function publishWeek(
  planId: string,
  weekNumber: number,
  version: number,
): Promise<NutritionPlanDetail> {
  const { data } = await api.post<NutritionPlanDetail>(
    `/nutrition/plans/${planId}/weeks/${weekNumber}/publish`,
    { version },
  );
  return data;
}
