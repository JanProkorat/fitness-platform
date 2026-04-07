import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'

export interface Notification {
  id: string
  type: 'invitation' | 'questionnaire' | 'new_plan' | 'message' | 'training_done' | 'alarm'
  title: string
  body: string
  timestamp: string
  read: boolean
  actionLabel?: string
  actionPayload?: Record<string, string>
}

interface NotificationsResponse {
  items: Notification[]
  cursor: string | null
}

async function fetchNotifications(): Promise<NotificationsResponse> {
  const { data } = await api.get('/client/notifications', {
    params: { limit: 20 },
  })
  return data
}

async function markAllRead(): Promise<void> {
  await api.post('/client/notifications/read-all', {})
}

async function markOneRead(id: string): Promise<void> {
  await api.post(`/client/notifications/${id}/read`, {})
}

export function useNotifications() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
  })

  const notifications = query.data?.items ?? []
  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllReadMutation = useMutation({
    mutationFn: markAllRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      const prev = queryClient.getQueryData<NotificationsResponse>(['notifications'])
      if (prev) {
        queryClient.setQueryData<NotificationsResponse>(['notifications'], {
          ...prev,
          items: prev.items.map((n) => ({ ...n, read: true })),
        })
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['notifications'], ctx.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markReadMutation = useMutation({
    mutationFn: markOneRead,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      const prev = queryClient.getQueryData<NotificationsResponse>(['notifications'])
      if (prev) {
        queryClient.setQueryData<NotificationsResponse>(['notifications'], {
          ...prev,
          items: prev.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['notifications'], ctx.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    refetch: query.refetch,
    markAllRead: markAllReadMutation.mutate,
    markRead: markReadMutation.mutate,
  }
}
