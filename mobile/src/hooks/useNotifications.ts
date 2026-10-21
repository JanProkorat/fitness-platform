import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  NOTIFICATIONS_QUERY_KEY,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications';
import type { NotificationsPage } from '@/api/notifications';
import { getErrorStatus } from '@/api/errors';
import { useAuthStore } from '@/stores/auth';

/** The client's notifications plus the unread total; refreshed by realtime events and on foreground. */
export function useNotifications() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: ({ signal }) => fetchNotifications(signal),
    enabled: isAuthenticated,
    retry: 1,
  });
}

/** Unread total for the bell dot; zero until the list has loaded. */
export function useUnreadCount(): number {
  return useNotifications().data?.unreadCount ?? 0;
}

/** Mark one notification, or all of them, as read. A notification that is gone is not an error. */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });

  const markOne = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      queryClient.setQueryData<NotificationsPage>(NOTIFICATIONS_QUERY_KEY, (page) => {
        if (!page) return page;
        const target = page.items.find((item) => item.id === id);
        if (!target || target.read) return page;
        return {
          items: page.items.map((item) => (item.id === id ? { ...item, read: true } : item)),
          unreadCount: Math.max(0, page.unreadCount - 1),
        };
      });
    },
    onError: (error) => {
      if (getErrorStatus(error) !== 404) console.warn('Could not mark the notification as read', error);
    },
    onSettled: refresh,
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      queryClient.setQueryData<NotificationsPage>(NOTIFICATIONS_QUERY_KEY, (page) =>
        page ? { items: page.items.map((item) => ({ ...item, read: true })), unreadCount: 0 } : page,
      );
    },
    onError: (error) => console.warn('Could not mark all notifications as read', error),
    onSettled: refresh,
  });

  return { markOne: markOne.mutate, markAll: markAll.mutate };
}
