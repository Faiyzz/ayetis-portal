import {
  NOTIFICATION_TYPES,
  type NotificationListResult,
  type NotificationType,
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

export async function listNotifications(
  userId: string,
  query: { page?: number; pageSize?: number; unreadOnly?: boolean },
): Promise<NotificationListResult> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (query.unreadOnly) filter.isRead = false;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: new Types.ObjectId(userId), isRead: false }),
  ]);

  return {
    items: items.map(toNotificationDto),
    total,
    unreadCount,
    page,
    pageSize,
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

export async function markAllNotificationsRead(userId: string) {
  await Notification.updateMany(
    { userId: new Types.ObjectId(userId), isRead: false },
    { $set: { isRead: true } },
  );
  return { success: true as const };
}

export { NOTIFICATION_TYPES };
