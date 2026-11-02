import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { PENDING_QUESTIONNAIRES_QUERY_KEY, fetchPendingQuestionnaires } from '@/api/questionnaires';
import { fillRouteForResponse } from '@/components/today/pendingForms';
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

/**
 * Opens the fill flow of a check-in response. The list is refreshed first, so a check-in that was answered
 * or passed its answer window is told apart from an open one; a response that is not pending shows the
 * "no longer available" notice instead.
 */
export function useOpenCheckIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const { refetch } = usePendingQuestionnaires();

  return useCallback(
    async (responsePublicId: string | undefined) => {
      const result = responsePublicId ? await refetch() : undefined;
      const route = responsePublicId ? fillRouteForResponse(result?.data?.questionnaires, responsePublicId) : null;
      if (route) {
        router.push(route);
        return;
      }
      Alert.alert(
        t('questionnaireFill.errors.unavailable.title'),
        t('questionnaireFill.errors.unavailable.body'),
        [{ text: t('questionnaireFill.errors.ok') }],
      );
    },
    [refetch, router, t],
  );
}
