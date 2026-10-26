import { useQuery } from '@tanstack/react-query';

import { COLLABORATIONS_QUERY_KEY, fetchCollaborations } from '@/api/collaborations';
import { useAuthStore } from '@/stores/auth';

/** The coaches the signed-in client works with. */
export function useCollaborations() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: COLLABORATIONS_QUERY_KEY,
    queryFn: ({ signal }) => fetchCollaborations(signal),
    enabled: isAuthenticated,
    retry: 1,
  });
}
