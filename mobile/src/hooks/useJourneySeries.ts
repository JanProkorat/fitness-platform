import { useQuery } from '@tanstack/react-query';

import { JOURNEY_SERIES_QUERY_KEY, fetchJourneySeries } from '@/api/journey';
import { useAuthStore } from '@/stores/auth';

/** Every weight and waist measurement for the My journey chart. */
export function useJourneySeries() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: JOURNEY_SERIES_QUERY_KEY,
    queryFn: ({ signal }) => fetchJourneySeries(signal),
    enabled: isAuthenticated,
    retry: 1,
  });
}
