import { queryOptions, useQueries, useQuery } from '@tanstack/react-query';

import { PLAN_SUMMARY_STALE_TIME_MS, fetchPlanSummary, planSummaryQueryKey } from '@/api/plans';
import { useAuthStore } from '@/stores/auth';

/** One shape for the Plan summary screen and the My journey rows, so both read the same cache entry. */
const planSummaryOptions = (planId: string) =>
  queryOptions({
    queryKey: planSummaryQueryKey(planId),
    queryFn: ({ signal }) => fetchPlanSummary(planId, signal),
    staleTime: PLAN_SUMMARY_STALE_TIME_MS,
    retry: 1,
  });

/** Summary of one plan; `planId` must already be a valid id. */
export function usePlanSummary(planId: string, enabled: boolean) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({ ...planSummaryOptions(planId), enabled: enabled && isAuthenticated });
}

/** Summaries for several plans at once; a failed one only leaves its own result empty. */
export function usePlanSummaries(planIds: readonly string[]) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQueries({
    queries: planIds.map((planId) => ({ ...planSummaryOptions(planId), enabled: isAuthenticated })),
  });
}
