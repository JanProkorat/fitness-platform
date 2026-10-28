import { useQuery } from '@tanstack/react-query';

import { NUTRITION_PHOTO_STALE_MS, TODAY_LOG_KEY, fetchTodayLog } from '@/api/nutrition';

/** Today's meal log: eaten state and photos. Stale early because photo URLs expire. */
export function useTodayMealLog(enabled: boolean) {
  return useQuery({
    queryKey: TODAY_LOG_KEY,
    queryFn: ({ signal }) => fetchTodayLog(signal),
    staleTime: NUTRITION_PHOTO_STALE_MS,
    enabled,
  });
}
