import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as notificationsController from './notifications.controller';

const router = Router();

router.use(authenticate);

router.get('/', notificationsController.list);
router.post('/read-all', notificationsController.markAllRead);
router.post('/:notificationId/read', notificationsController.markRead);

export default router;
