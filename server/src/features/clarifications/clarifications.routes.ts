import { PERMISSIONS } from '@ayetis/shared';
import { Router } from 'express';
import {
  authenticate,
  requireAnyPermission,
  requirePermission,
} from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as clarificationsController from './clarifications.controller';
import {
  createClarificationSchema,
  replyClarificationSchema,
} from './clarifications.schemas';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Mounted at /api/cases/:caseId/clarifications AND /api/clarifications
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

export default router;
