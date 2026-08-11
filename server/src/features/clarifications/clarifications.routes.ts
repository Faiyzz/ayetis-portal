import { PERMISSIONS } from '@ayetis/shared';
import { Router } from 'express';
import multer from 'multer';
import {
  authenticate,
  requireAnyPermission,
  requirePermission,
} from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as clarificationsController from './clarifications.controller';
import {
  createClarificationSchema,
  escalateClarificationSchema,
  replyClarificationSchema,
  updateDraftSchema,
} from './clarifications.schemas';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

const router = Router({ mergeParams: true });

router.use(authenticate);

export const caseClarificationsRouter = Router({ mergeParams: true });
caseClarificationsRouter.use(authenticate);

caseClarificationsRouter.get(
  '/',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
  ),
  clarificationsController.listForCase,
);

caseClarificationsRouter.post(
  '/',
  requirePermission(PERMISSIONS.CLARIFICATION_CREATE),
  validate(createClarificationSchema),
  clarificationsController.create,
);

router.get(
  '/:clarificationId',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CLARIFICATION_CREATE,
    PERMISSIONS.CLARIFICATION_REPLY,
  ),
  clarificationsController.getOne,
);

router.patch(
  '/:clarificationId/draft',
  requireAnyPermission(
    PERMISSIONS.CLARIFICATION_CREATE,
    PERMISSIONS.CLARIFICATION_REPLY,
    PERMISSIONS.CASE_VIEW_OWN,
  ),
  validate(updateDraftSchema),
  clarificationsController.updateDraft,
);

router.post(
  '/:clarificationId/publish',
  requirePermission(PERMISSIONS.CLARIFICATION_CREATE),
  clarificationsController.publishDraft,
);

router.post(
  '/:clarificationId/replies',
  requireAnyPermission(PERMISSIONS.CLARIFICATION_REPLY, PERMISSIONS.CLARIFICATION_CREATE),
  validate(replyClarificationSchema),
  clarificationsController.reply,
);

router.post(
  '/:clarificationId/resolve',
  requirePermission(PERMISSIONS.CLARIFICATION_RESOLVE),
  clarificationsController.resolve,
);

router.post(
  '/:clarificationId/read',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CLARIFICATION_CREATE,
  ),
  clarificationsController.markRead,
);

router.post(
  '/:clarificationId/escalate',
  requireAnyPermission(PERMISSIONS.CLARIFICATION_CREATE, PERMISSIONS.CASE_VIEW_ALL),
  validate(escalateClarificationSchema),
  clarificationsController.escalate,
);

router.post(
  '/:clarificationId/attachments',
  requireAnyPermission(
    PERMISSIONS.CLARIFICATION_CREATE,
    PERMISSIONS.CLARIFICATION_REPLY,
    PERMISSIONS.CASE_VIEW_OWN,
  ),
  upload.single('file'),
  clarificationsController.uploadAttachment,
);

export default router;
