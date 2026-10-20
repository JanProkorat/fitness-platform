import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  CONVERSATIONS_QUERY_KEY,
  conversationMessagesQueryKey,
  sendMessage,
} from '@/api/conversations';

/**
 * Sends one text message. The caller clears its draft only on success, so a failed send
 * keeps the text and a retry cannot post it twice.
 */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => sendMessage(conversationId, text),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: conversationMessagesQueryKey(conversationId) });
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
  });
}
