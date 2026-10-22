import { useQuery } from '@tanstack/react-query';

import { JOURNEY_PHOTOS_QUERY_KEY, fetchJourneyPhotoDates } from '@/api/journey';
import { useAuthStore } from '@/stores/auth';

/** Dates of the client's progress photos, shown as markers on the journey chart. */
export function useJourneyPhotos() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: JOURNEY_PHOTOS_QUERY_KEY,
    queryFn: ({ signal }) => fetchJourneyPhotoDates(signal),
    enabled: isAuthenticated,
    retry: 1,
  });
}
