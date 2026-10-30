import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  NOTIFICATION_PREFERENCES_QUERY_KEY,
  fetchNotificationPreferences,
  isMessagesEnabled,
  saveNotificationPreferences,
  withMessagesEnabled,
} from '@/api/settings';
import type { NotificationPreferenceDto } from '@/api/generated';
import { showsError } from '@/lib/queryState';
import { useAuthStore } from '@/stores/auth';

/** The Messages notification switch: reads the preferences and saves a flip, rolling back on failure. */
export function useNotificationPreferences() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY,
    queryFn: ({ signal }) => fetchNotificationPreferences(signal),
    enabled: isAuthenticated,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => {
      const current = queryClient.getQueryData<NotificationPreferenceDto[]>(
        NOTIFICATION_PREFERENCES_QUERY_KEY,
      );
      if (!current) throw new Error('notification_preferences_not_loaded');
      return saveNotificationPreferences(withMessagesEnabled(current, enabled));
    },
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationPreferenceDto[]>(
        NOTIFICATION_PREFERENCES_QUERY_KEY,
      );
      if (previous) {
        queryClient.setQueryData(
          NOTIFICATION_PREFERENCES_QUERY_KEY,
          withMessagesEnabled(previous, enabled),
        );
      }
      return { previous };
    },
    onError: (_error, _enabled, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, context.previous);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY }),
  });

  return {
    isPending: query.isPending,
    isError: showsError(query),
    refetch: query.refetch,
    messagesEnabled: query.data ? isMessagesEnabled(query.data) : false,
    setMessagesEnabled: mutation.mutate,
    isSaving: mutation.isPending,
    saveFailed: mutation.isError,
  };
}
