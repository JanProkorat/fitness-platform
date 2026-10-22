import { useQuery } from '@tanstack/react-query';

import {
  ONBOARDING_ANSWERS_QUERY_KEY,
  fetchOnboardingAnswers,
  isAnswersUnavailable,
} from '@/api/onboardingAnswers';
import { useAuthStore } from '@/stores/auth';

/** The client's onboarding answers; an error that `isAnswersUnavailable` accepts means there are none. */
export function useOnboardingAnswers() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ONBOARDING_ANSWERS_QUERY_KEY,
    queryFn: ({ signal }) => fetchOnboardingAnswers(signal),
    enabled: isAuthenticated,
    retry: (failureCount, error) => !isAnswersUnavailable(error) && failureCount < 1,
    // The screen edits a local copy; a background refetch must not replace it.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
