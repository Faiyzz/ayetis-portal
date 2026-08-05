import { PERMISSIONS } from '@ayetis/shared';
import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as controller from './registrations.controller';
import {
  listRegistrationsQuerySchema,
  rejectRegistrationSchema,
  updateMessagesSchema,
} from './registrations.schemas';

const router = Router();

router.use(authenticate);

router.get(
  '/messages',
  requirePermission(PERMISSIONS.REGISTRATION_LIST),
  controller.getMessages,
);

router.patch(
  '/messages',
  requirePermission(PERMISSIONS.REGISTRATION_APPROVE),
  validate(updateMessagesSchema),
  controller.updateMessages,
);

router.get(
  '/',
  requirePermission(PERMISSIONS.REGISTRATION_LIST),
  validate(listRegistrationsQuerySchema, 'query'),
  controller.listRegistrations,
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.REGISTRATION_LIST),
  controller.getRegistration,
);

router.post(
  '/:id/approve',
  requirePermission(PERMISSIONS.REGISTRATION_APPROVE),
  controller.approveRegistration,
);

router.post(
  '/:id/reject',
  requirePermission(PERMISSIONS.REGISTRATION_REJECT),
  validate(rejectRegistrationSchema),
  controller.rejectRegistration,
);

router.post(
  '/:id/hold',
  requirePermission(PERMISSIONS.REGISTRATION_APPROVE),
  controller.holdRegistration,
);

export default router;
