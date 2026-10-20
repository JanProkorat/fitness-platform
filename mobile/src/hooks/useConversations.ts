import { useQuery } from '@tanstack/react-query';

import { CONVERSATIONS_QUERY_KEY, fetchConversations } from '@/api/conversations';
import { useAuthStore } from '@/stores/auth';

/** The client's conversation list; refreshed by realtime events and on foreground. */
export function useConversations() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: ({ signal }) => fetchConversations(signal),
    enabled: isAuthenticated,
    retry: 1,
  });
}

/** Unread total for the Messages tab badge; zero until the list has loaded. */
export function useUnreadMessageCount(): number {
  const { data } = useConversations();
  return (data ?? []).reduce((sum, conversation) => sum + (conversation.unreadCount ?? 0), 0);
}
