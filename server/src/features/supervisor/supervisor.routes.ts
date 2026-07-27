import { PERMISSIONS } from '@ayetis/shared';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAnyPermission, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as supervisorController from './supervisor.controller';

const router = Router();

const performanceQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  view: z.enum(['month', 'quarter']).optional(),
});

const addMemberSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  role: z.enum(['designer', 'qc', 'orthodontist']),
});

router.use(authenticate);

router.get(
  '/dashboard',
  requireAnyPermission(
    PERMISSIONS.REPORT_VIEW_TEAM,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.REPORT_VIEW_ALL,
  ),
  supervisorController.dashboard,
);

router.get(
  '/performance',
  requireAnyPermission(
    PERMISSIONS.REPORT_VIEW_TEAM,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.REPORT_VIEW_ALL,
  ),
  validate(performanceQuerySchema, 'query'),
  supervisorController.performance,
);

router.get(
  '/members',
  requireAnyPermission(PERMISSIONS.TEAM_MANAGE, PERMISSIONS.USER_LIST),
  supervisorController.listMembers,
);

router.post(
  '/members',
  requireAnyPermission(PERMISSIONS.TEAM_MANAGE, PERMISSIONS.USER_CREATE),
  validate(addMemberSchema),
  supervisorController.addMember,
);

router.post(
  '/members/:userId/deactivate',
  requireAnyPermission(PERMISSIONS.TEAM_MANAGE, PERMISSIONS.USER_UPDATE),
  supervisorController.removeMember,
);

export default router;
