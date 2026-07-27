import { PERMISSIONS } from '@ayetis/shared';
import { Router } from 'express';
import { z } from 'zod';
import {
  authenticate,
  requireAnyPermission,
  requirePermission,
} from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as deletionsController from './deletions.controller';

const router = Router();

const reviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(1000).optional(),
  confirmation: z.string().trim().min(1),
});

const reasonSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

router.use(authenticate);

router.get(
  '/',
  requireAnyPermission(PERMISSIONS.DELETE_REQUEST_REVIEW, PERMISSIONS.AUDIT_VIEW),
  deletionsController.list,
);

router.get(
  '/log',
  requireAnyPermission(PERMISSIONS.DELETE_REQUEST_REVIEW, PERMISSIONS.AUDIT_VIEW),
  deletionsController.log,
);

router.post(
  '/:requestId/review',
  requirePermission(PERMISSIONS.DELETE_REQUEST_REVIEW),
  validate(reviewSchema),
  deletionsController.review,
);

router.post(
  '/users/:userId',
  requirePermission(PERMISSIONS.USER_DELETE),
  validate(reasonSchema),
  deletionsController.requestUserDelete,
);

export default router;
