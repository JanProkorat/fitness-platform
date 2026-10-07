/**
 * Nutrition plan templates API module — wraps the NSwag-generated template endpoints.
 */
import { apiClient } from '@/api/client';
import type {
  CreateNutritionPlanTemplateRequest,
  NutritionPlanTemplateDetailDto,
  NutritionPlanTemplateSummaryDto,
  PrimaryGoal,
} from '@/api/generated';

export { PrimaryGoal, MealKind, LibraryVisibility } from '@/api/generated';
export type {
  CreateNutritionPlanTemplateRequest,
  NutritionPlanTemplateDetailDto,
  NutritionPlanTemplateSummaryDto,
  NutritionPlanTemplateWeekRequest,
  NutritionPlanTemplateDayRequest,
  TemplateMealRequest,
} from '@/api/generated';

export interface SearchPlanTemplatesParams {
  search?: string;
  goal?: PrimaryGoal;
  weekCount?: number;
  mealsPerDay?: number;
  inUse?: boolean;
  page: number;
  pageSize: number;
}

export interface SearchPlanTemplatesResult {
  templates: NutritionPlanTemplateSummaryDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Search the caller's own and shared nutrition plan templates. */
export async function searchPlanTemplates(params: SearchPlanTemplatesParams): Promise<SearchPlanTemplatesResult> {
  const response = await apiClient.searchTemplatesEndpoint(
    params.page,
    params.pageSize,
    params.search,
    params.goal,
    undefined,
    params.weekCount,
    params.mealsPerDay,
    params.inUse,
  );
  return {
    templates: response.templates ?? [],
    totalCount: response.totalCount ?? 0,
    page: response.page ?? params.page,
    pageSize: response.pageSize ?? params.pageSize,
  };
}

/** One template's full detail. */
export async function getPlanTemplate(templateId: string): Promise<NutritionPlanTemplateDetailDto> {
  return apiClient.getTemplateEndpoint(templateId);
}

/** Create a template (Nutritionist only). */
export async function createPlanTemplate(
  request: CreateNutritionPlanTemplateRequest,
): Promise<NutritionPlanTemplateSummaryDto> {
  return apiClient.createTemplateEndpoint(request);
}

/** Copy a template into the caller's own library. */
export async function copyPlanTemplate(templateId: string): Promise<void> {
  await apiClient.copyTemplateEndpoint(templateId);
}

/** Delete a template (owner only). */
export async function deletePlanTemplate(templateId: string): Promise<void> {
  await apiClient.deleteTemplateEndpoint(templateId);
}
