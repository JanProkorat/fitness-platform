import { useQuery } from '@tanstack/react-query';

import { FULL_PLAN_KEY, fetchFullPlan, fetchNutritionPlanById, fullPlanByIdKey } from '@/api/nutrition';

/**
 * The whole plan with its published weeks. Without `planId` it is the plan the server picks by date; with one it
 * is that plan. A missing plan is a 404, so it is not retried.
 */
export function useFullNutritionPlan(planId?: string) {
  return useQuery({
    queryKey: planId ? fullPlanByIdKey(planId) : FULL_PLAN_KEY,
    queryFn: ({ signal }) => (planId ? fetchNutritionPlanById(planId, signal) : fetchFullPlan(signal)),
    retry: false,
  });
}
