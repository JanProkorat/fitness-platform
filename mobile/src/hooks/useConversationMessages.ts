import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { conversationMessagesQueryKey, fetchMessages } from '@/api/conversations';
import { useAuthStore } from '@/stores/auth';

/** Messages of one chat, newest first. Realtime events refetch it; nothing is appended locally. */
export function useConversationMessages(conversationId: string) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: conversationMessagesQueryKey(conversationId),
    queryFn: ({ signal }) => fetchMessages(conversationId, signal),
    enabled: isAuthenticated && conversationId.length > 0,
    retry: 1,
  });
}

/** Refetches the open chat's messages. */
export function useRefreshConversationMessages(conversationId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: conversationMessagesQueryKey(conversationId) }),
    [queryClient, conversationId],
  );
}
