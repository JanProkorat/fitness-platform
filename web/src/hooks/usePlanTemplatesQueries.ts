import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  copyPlanTemplate,
  createPlanTemplate,
  deletePlanTemplate,
  getPlanTemplate,
  searchPlanTemplates,
  updatePlanTemplate,
  type CreateNutritionPlanTemplateRequest,
  type UpdateNutritionPlanTemplateRequest,
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

/** One template's detail. 403 and 404 are answers, not transient failures, so they are not retried. */
export function usePlanTemplate(templateId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['plan-templates', 'detail', templateId],
    queryFn: () => getPlanTemplate(templateId as string),
    enabled: enabled && Boolean(templateId),
    retry: (failureCount, error) => {
      const status = getErrorStatus(error);
      return status !== 403 && status !== 404 && failureCount < 1;
    },
  });
}

/** Templates to copy meals from: the first page of a name search. Not part of the main list's cache keys. */
export function usePlanTemplateSources(search: string, enabled: boolean) {
  return useQuery({
    queryKey: ['plan-templates', 'sources', search],
    queryFn: () => searchPlanTemplates({ search: search || undefined, page: 1, pageSize: 20 }),
    placeholderData: keepPreviousData,
    enabled,
    retry: retryUnlessForbidden,
  });
}

/** Loads one template's detail on demand, outside the cache, to read the meals to copy. */
export function useLoadPlanTemplate() {
  return useMutation({ mutationFn: (templateId: string) => getPlanTemplate(templateId) });
}

/**
 * Saves a template's whole content. It does not toast: the editor shows save and conflict errors
 * inline and keeps the user's edits. The detail cache is refreshed only from the server's reply.
 */
export function useUpdatePlanTemplate(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdateNutritionPlanTemplateRequest) => updatePlanTemplate(templateId, request),
    onSuccess: (saved) => {
      queryClient.setQueryData(['plan-templates', 'detail', templateId], saved);
      queryClient.invalidateQueries({ queryKey: ['plan-templates', 'list'] });
    },
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
