import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import * as notificationsService from './notifications.service';

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await notificationsService.listNotifications(req.user!.id, {
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      unreadOnly: req.query.unreadOnly === 'true' || req.query.unreadOnly === '1',
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function markRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await notificationsService.markNotificationRead(
      req.user!.id,
      req.params.notificationId,
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function markAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await notificationsService.markAllNotificationsRead(req.user!.id);
    res.json({ success: true, data, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
}
