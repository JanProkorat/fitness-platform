import { useQuery } from '@tanstack/react-query';

import { TODAY_PLAN_KEY, fetchTodayPlan } from '@/api/nutrition';

/** Today's plan; a client without an active plan gets a 404, so it is not retried. */
export function useTodayNutritionPlan() {
  return useQuery({
    queryKey: TODAY_PLAN_KEY,
    queryFn: ({ signal }) => fetchTodayPlan(signal),
    retry: false,
  });
}
