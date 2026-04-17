import { useQuery } from '@tanstack/react-query'
import { fetchConversations } from '../api/messages'

export function useUnreadCount() {
  const { data } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => fetchConversations(false),
    select: (conversations) =>
      conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
  })
  return data ?? 0
}
