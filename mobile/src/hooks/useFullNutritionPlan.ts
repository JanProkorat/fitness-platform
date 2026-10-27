import { useQuery } from '@tanstack/react-query';

import { FULL_PLAN_KEY, fetchFullPlan } from '@/api/nutrition';

/** The whole plan with its published weeks; a client without an active plan gets a 404, so it is not retried. */
export function useFullNutritionPlan() {
  return useQuery({
    queryKey: FULL_PLAN_KEY,
    queryFn: ({ signal }) => fetchFullPlan(signal),
    retry: false,
  });
}
