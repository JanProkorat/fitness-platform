import { useQuery } from '@tanstack/react-query';

import { NUTRITION_PHOTO_STALE_MS, fetchWeekLog, weekLogQueryKey } from '@/api/nutrition';

/**
 * The meal log of the plan week containing `date`: eaten state and photos for each of its days.
 * Signed photo URLs expire, so the cached log goes stale well before they do.
 */
export function useNutritionDayLog(date: string | undefined) {
  return useQuery({
    queryKey: weekLogQueryKey(date ?? ''),
    queryFn: ({ signal }) => fetchWeekLog(date ?? '', signal),
    enabled: Boolean(date),
    staleTime: NUTRITION_PHOTO_STALE_MS,
    retry: false,
  });
}
