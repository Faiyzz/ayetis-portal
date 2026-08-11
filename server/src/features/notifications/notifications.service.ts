import {
  NOTIFICATION_TYPES,
  notificationChannelForType,
  typesForNotificationChannel,
  type NotificationChannel,
  type NotificationListResult,
  type NotificationType,
  type NotificationUnreadByChannel,
} from '@ayetis/shared';
import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { Notification, toNotificationDto } from '../../models/Notification';

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  caseId?: string;
  clarificationId?: string;
}) {
  const doc = await Notification.create({
    userId: new Types.ObjectId(input.userId),
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
    caseId: input.caseId,
    clarificationId: input.clarificationId,
    isRead: false,
  });
  return toNotificationDto(doc);
}

export async function createNotificationsForUsers(
  userIds: string[],
  input: Omit<Parameters<typeof createNotification>[0], 'userId'>,
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  await Promise.all(unique.map((userId) => createNotification({ ...input, userId })));
}

async function unreadByChannel(userId: string): Promise<NotificationUnreadByChannel> {
  const uid = new Types.ObjectId(userId);
  const [statusAlerts, clarifications] = await Promise.all([
    Notification.countDocuments({
      userId: uid,
      isRead: false,
      type: { $in: typesForNotificationChannel('status_alerts') },
    }),
    Notification.countDocuments({
      userId: uid,
      isRead: false,
      type: { $in: typesForNotificationChannel('clarifications') },
    }),
  ]);
  return { status_alerts: statusAlerts, clarifications };
}

export async function listNotifications(
  userId: string,
  query: {
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
    channel?: NotificationChannel;
  },
): Promise<NotificationListResult> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (query.unreadOnly) filter.isRead = false;
  if (query.channel) {
    filter.type = { $in: typesForNotificationChannel(query.channel) };
  }

  const byChannel = await unreadByChannel(userId);
  const [items, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Notification.countDocuments(filter),
  ]);

  const unreadCount = query.channel
    ? byChannel[query.channel]
    : byChannel.status_alerts + byChannel.clarifications;

  return {
    items: items.map(toNotificationDto),
    total,
    unreadCount,
    unreadByChannel: byChannel,
    page,
    pageSize,
    channel: query.channel ?? null,
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const doc = await Notification.findOneAndUpdate(
    { _id: notificationId, userId: new Types.ObjectId(userId) },
    { $set: { isRead: true } },
    { new: true },
  );
  if (!doc) throw new AppError('Notification not found', 404);
  return toNotificationDto(doc);
}

export async function markAllNotificationsRead(
  userId: string,
  channel?: NotificationChannel,
) {
  const filter: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
    isRead: false,
  };
  if (channel) {
    filter.type = { $in: typesForNotificationChannel(channel) };
  }
  await Notification.updateMany(filter, { $set: { isRead: true } });
  return {
    success: true as const,
    unreadByChannel: await unreadByChannel(userId),
  };
}

export { NOTIFICATION_TYPES, notificationChannelForType };
