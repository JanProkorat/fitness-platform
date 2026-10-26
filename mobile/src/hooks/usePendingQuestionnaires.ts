import { useQuery } from '@tanstack/react-query';

import { PENDING_QUESTIONNAIRES_QUERY_KEY, fetchPendingQuestionnaires } from '@/api/questionnaires';
import { useAuthStore } from '@/stores/auth';

/** Pending questionnaires and photo requests; a failure (404/403/500) just leaves the data undefined. */
export function usePendingQuestionnaires() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: PENDING_QUESTIONNAIRES_QUERY_KEY,
    queryFn: ({ signal }) => fetchPendingQuestionnaires(signal),
    enabled: isAuthenticated,
    retry: false,
  });
}
