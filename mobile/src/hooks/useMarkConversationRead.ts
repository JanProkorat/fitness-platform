import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getErrorStatus } from '@/api/errors';
import { CONVERSATIONS_QUERY_KEY, conversationMessagesQueryKey, markConversationRead } from '@/api/conversations';

/** Marks the other party's messages in a chat as read, then refreshes the list and the thread. */
export function useMarkConversationRead(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markConversationRead(conversationId),
    onError: (error) => {
      if (getErrorStatus(error) !== 404) console.warn('Could not mark the chat as read', error);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: conversationMessagesQueryKey(conversationId) });
    },
  });
}
