import { PERMISSIONS } from '@ayetis/shared';
import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as auditController from './audit.controller';
import { listActivityQuerySchema } from './audit.schemas';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  validate(listActivityQuerySchema, 'query'),
  auditController.listActivity,
);

export default router;
