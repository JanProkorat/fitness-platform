import { api } from '@/api/client';
import type { NotificationDto } from '@/api/generated';

export type AppNotification = NotificationDto;

export type NotificationsPage = {
  items: AppNotification[];
  unreadCount: number;
};

export const NOTIFICATIONS_QUERY_KEY = ['notifications'] as const;

/** Lowercased notification type the backend sends for a new coach invitation. */
export const INVITATION_RECEIVED_TYPE = 'invitationreceived';

const PAGE_SIZE = 50;

export async function fetchNotifications(signal?: AbortSignal): Promise<NotificationsPage> {
  const response = await api.getNotificationsEndpoint(PAGE_SIZE, undefined, signal);
  return { items: response.items ?? [], unreadCount: response.unreadCount ?? 0 };
}

export function markNotificationRead(id: string): Promise<void> {
  return api.markReadEndpoint(id);
}

export function markAllNotificationsRead(): Promise<void> {
  return api.markAllReadEndpoint();
}

/** String fields of a notification's payload, a JSON object such as `{"inviteId":"...","trainerName":"..."}`. */
export function getNotificationPayload(notification: AppNotification): Record<string, string> {
  if (!notification.actionPayload) return {};
  try {
    const parsed: unknown = JSON.parse(notification.actionPayload);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') fields[key] = value;
    }
    return fields;
  } catch {
    // A malformed payload simply means there is nothing to read.
    return {};
  }
}

/** The invite a notification points at, when it has one. */
export function getNotificationInviteId(notification: AppNotification): string | undefined {
  const inviteId = getNotificationPayload(notification).inviteId;
  return inviteId ? inviteId : undefined;
}
