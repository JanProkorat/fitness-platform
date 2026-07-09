import api from '@/lib/api';

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  actionLabel?: string | null;
  actionPayload?: string | null;
}

interface GetNotificationsResponse {
  items: NotificationDto[];
}

export async function getNotifications(limit = 10): Promise<NotificationDto[]> {
  const { data } = await api.get<GetNotificationsResponse>('/client/notifications', { params: { limit } });
  return data.items;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/client/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/client/notifications/read-all');
}
