import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_PAGE_SIZE,
} from '@/api/notifications';
import { useAuthStore } from '@/stores/auth';

/** The signed-in coach's newest notifications (one capped page). */
export function useNotifications() {
  const isProfessional = useAuthStore(
    (state) => state.user?.roles.some((role) => role === 'Trainer' || role === 'Nutritionist') ?? false,
  );
  return useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => getNotifications(NOTIFICATIONS_PAGE_SIZE),
    enabled: isProfessional,
  });
}

export interface UnreadNotificationsCount {
  count: number;
  /** True when the page is full of unread items, so the real number may be higher ("50+"). */
  capped: boolean;
}

/**
 * Unread notifications for the sidebar badge. Computed from the list for now,
 * so it is a lower bound once the page is full; swap the source here when the
 * API serves a count.
 */
export function useUnreadNotificationsCount(): UnreadNotificationsCount {
  const { data } = useNotifications();
  const items = data ?? [];
  const count = items.filter((item) => !item.read).length;
  return { count, capped: items.length >= NOTIFICATIONS_PAGE_SIZE && count >= NOTIFICATIONS_PAGE_SIZE };
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    // A 404 (the notification vanished) must not leave a stale row: refetch either way.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
