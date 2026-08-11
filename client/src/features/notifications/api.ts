import type {
  NotificationChannel,
  NotificationDto,
  NotificationListResult,
  NotificationUnreadByChannel,
} from '@ayetis/shared';
import api from '@/lib/api';

export async function fetchNotifications(params?: {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
  channel?: NotificationChannel;
}): Promise<NotificationListResult> {
  const { data } = await api.get('/notifications', { params });
  return data.data;
}

export async function markNotificationRead(id: string): Promise<NotificationDto> {
  const { data } = await api.post(`/notifications/${id}/read`);
  return data.data;
}

export async function markAllNotificationsRead(channel?: NotificationChannel) {
  const { data } = await api.post('/notifications/read-all', channel ? { channel } : {});
  return data.data as { success: true; unreadByChannel: NotificationUnreadByChannel };
}
