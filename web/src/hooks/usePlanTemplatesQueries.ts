import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  copyPlanTemplate,
  createPlanTemplate,
  deletePlanTemplate,
  getPlanTemplate,
  searchPlanTemplates,
  type CreateNutritionPlanTemplateRequest,
} from '@/api/nutrition-plan-templates';
import { getErrorStatus, showApiError, showSuccess } from '@/lib/api-errors';
import type { PlanTemplateListFilters } from '@/hooks/usePlanTemplateListParams';

/** A 403 is a role gate (trainer-only coach), not a transient failure — never retried. */
function retryUnlessForbidden(failureCount: number, error: unknown): boolean {
  return getErrorStatus(error) !== 403 && failureCount < 1;
}

/** The plan-templates list, filtered and paginated per `filters`. */
export function usePlanTemplates(filters: PlanTemplateListFilters, enabled: boolean) {
  return useQuery({
    queryKey: [
      'plan-templates',
      'list',
      {
        search: filters.search,
        goal: filters.goal,
        weekCount: filters.weekCount,
        mealsPerDay: filters.mealsPerDay,
        inUse: filters.inUse,
        page: filters.page,
        pageSize: filters.pageSize,
      },
    ],
    queryFn: () =>
      searchPlanTemplates({
        search: filters.search || undefined,
        goal: filters.goal ?? undefined,
        weekCount: filters.weekCount ?? undefined,
        mealsPerDay: filters.mealsPerDay ?? undefined,
        inUse: filters.inUse ?? undefined,
        page: filters.page,
        pageSize: filters.pageSize,
      }),
    placeholderData: keepPreviousData,
    enabled,
    retry: retryUnlessForbidden,
  });
}

/** One template's detail. */
export function usePlanTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: ['plan-templates', 'detail', templateId],
    queryFn: () => getPlanTemplate(templateId as string),
    enabled: Boolean(templateId),
  });
}

/** Creates a template; the caller navigates on success. */
export function useCreatePlanTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateNutritionPlanTemplateRequest) => createPlanTemplate(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-templates'] });
    },
    onError: (error) => {
      showApiError(error, 'planTemplates.createError');
    },
  });
}

/** Copies a template into the caller's library. A vanished source refreshes the list. */
export function useCopyPlanTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => copyPlanTemplate(templateId),
    onSuccess: () => {
      showSuccess('planTemplates.copySuccess');
    },
    onError: (error) => {
      showApiError(error, 'planTemplates.copyError');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-templates'] });
    },
  });
}

/** Deletes a template (owner only). A failure (403/404) refreshes the list. */
export function useDeletePlanTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => deletePlanTemplate(templateId),
    onSuccess: () => {
      showSuccess('planTemplates.deleteSuccess');
    },
    onError: (error) => {
      showApiError(error, 'planTemplates.deleteError');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-templates'] });
    },
  });
}
