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

/** True for a nutrition plan notification: its payload carries `planKind` "nutrition". */
export function isNutritionPlanPayload(payload: Record<string, unknown> | undefined): boolean {
  return payload?.planKind === 'nutrition';
}

/** The invite a notification points at, when it has one. */
export function getNotificationInviteId(notification: AppNotification): string | undefined {
  const inviteId = getNotificationPayload(notification).inviteId;
  return inviteId ? inviteId : undefined;
}

/** Types of the notifications that point at a coach's package proposal, lowercased. */
const REQUEST_PROPOSAL_TYPES: readonly string[] = ['clientrequestpackageproposed', 'clientrequestproposalwithdrawn'];

/** True for the notification type, or the push `type` value, of a package proposal or its withdrawal. */
export function isRequestProposalType(type: unknown): boolean {
  return typeof type === 'string' && REQUEST_PROPOSAL_TYPES.includes(type.toLowerCase());
}

/** The request an in-app proposal notification points at, when it has one. */
export function getNotificationRequestId(notification: AppNotification): string | undefined {
  if (!isRequestProposalType(notification.type)) return undefined;
  const requestId = getNotificationPayload(notification).requestId;
  return requestId ? requestId : undefined;
}

/** The request a proposal push points at, read from its `data` object. */
export function getPushRequestId(data: Record<string, unknown> | undefined): string | undefined {
  if (!isRequestProposalType(data?.type)) return undefined;
  const requestId = data?.requestId;
  return typeof requestId === 'string' && requestId.length > 0 ? requestId : undefined;
}
