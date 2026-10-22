import { useQuery } from '@tanstack/react-query';

import { PROFILE_SUMMARY_QUERY_KEY, fetchProfileSummary } from '@/api/profile';
import { useAuthStore } from '@/stores/auth';

/** Headline numbers for the Profile screen. */
export function useProfileSummary() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: PROFILE_SUMMARY_QUERY_KEY,
    queryFn: ({ signal }) => fetchProfileSummary(signal),
    enabled: isAuthenticated,
    retry: 1,
  });
}
