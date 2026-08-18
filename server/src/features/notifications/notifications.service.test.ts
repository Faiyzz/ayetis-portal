import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../utils/AppError';
import { mockQuery } from '../../test/mocks';
import { NOTIFICATION_CHANNELS } from '@ayetis/shared';

const { Notification, toNotificationDto } = vi.hoisted(() => ({
  Notification: {
    create: vi.fn(),
    countDocuments: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateMany: vi.fn(),
  },
  toNotificationDto: vi.fn((doc: { title: string }) => ({
    id: 'n1',
    title: doc.title,
    type: 'case_assigned',
    isRead: false,
  })),
}));

vi.mock('../../models/Notification', () => ({ Notification, toNotificationDto }));

import {
  createNotification,
  createNotificationsForUsers,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.service';

describe('notifications', () => {
  it('creates a notification', async () => {
    Notification.create.mockResolvedValue({ title: 'Assigned', type: 'case_assigned' });
    const dto = await createNotification({
      userId: '507f1f77bcf86cd799439011',
      type: 'case_assigned',
      title: 'Assigned',
      body: 'Case AYT-1',
      caseId: 'AYT-1',
    });
    expect(dto.title).toBe('Assigned');
  });

  it('lists channels with independent unread counts', async () => {
    Notification.countDocuments.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    Notification.find.mockReturnValue(mockQuery([]));
    const result = await listNotifications('507f1f77bcf86cd799439011', {
      channel: NOTIFICATION_CHANNELS.CLARIFICATIONS,
    });
    expect(result.unreadByChannel.status_alerts).toBe(3);
    expect(result.unreadByChannel.clarifications).toBe(1);
    expect(result.unreadCount).toBe(1);
  });

  it('sums unread counts when no channel is selected', async () => {
    Notification.countDocuments.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    Notification.find.mockReturnValue(mockQuery([]));
    const result = await listNotifications('507f1f77bcf86cd799439011', {});
    expect(result.unreadCount).toBe(5);
    await createNotificationsForUsers([], {
      type: 'case_assigned',
      title: 'Assigned',
      body: 'none',
    });
  });

  it('marks one notification read', async () => {
    Notification.findOneAndUpdate.mockResolvedValue({ title: 'Assigned' });
    await expect(
      markNotificationRead('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'),
    ).resolves.toMatchObject({ title: 'Assigned' });
    Notification.findOneAndUpdate.mockResolvedValue(null);
    await expect(
      markNotificationRead('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('marks a channel read', async () => {
    Notification.updateMany.mockResolvedValue({ modifiedCount: 2 });
    Notification.countDocuments.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const result = await markAllNotificationsRead(
      '507f1f77bcf86cd799439011',
      NOTIFICATION_CHANNELS.STATUS_ALERTS,
    );
    expect(result.success).toBe(true);
    expect(result.unreadByChannel.status_alerts).toBe(0);
  });
});
