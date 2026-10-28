import { useQuery } from '@tanstack/react-query';

import { WEEK_PLAN_KEY, fetchWeekPlan } from '@/api/nutrition';

/** The current plan week; a client without an active plan gets a 404, so it is not retried. */
export function useNutritionWeekPlan(enabled = true) {
  return useQuery({
    queryKey: WEEK_PLAN_KEY,
    queryFn: ({ signal }) => fetchWeekPlan(signal),
    retry: false,
    enabled,
  });
}
