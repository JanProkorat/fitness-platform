import { useQuery } from '@tanstack/react-query';

import { WEIGHT_SERIES_QUERY_KEY, fetchWeightSeries } from '@/api/measurements';
import { useAuthStore } from '@/stores/auth';

/** Recent weights for the journey sparkline; a failure just leaves the sparkline out. */
export function useWeightSeries() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: WEIGHT_SERIES_QUERY_KEY,
    queryFn: ({ signal }) => fetchWeightSeries(signal),
    enabled: isAuthenticated,
    retry: 1,
  });
}
