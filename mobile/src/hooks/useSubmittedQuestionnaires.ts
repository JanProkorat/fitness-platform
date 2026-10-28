import { useQuery } from '@tanstack/react-query';

import { SUBMITTED_QUESTIONNAIRES_QUERY_KEY, fetchSubmittedQuestionnaires } from '@/api/questionnaires';
import { useAuthStore } from '@/stores/auth';

/** Answered questionnaires per coach link; a failure just leaves the data undefined. */
export function useSubmittedQuestionnaires() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: SUBMITTED_QUESTIONNAIRES_QUERY_KEY,
    queryFn: ({ signal }) => fetchSubmittedQuestionnaires(signal),
    enabled: isAuthenticated,
    retry: false,
  });
}
