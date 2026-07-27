import { ALL_DEPARTMENT_TYPES, PERMISSIONS, isDepartmentType } from '@ayetis/shared';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as departmentsController from './departments.controller';

const router = Router();

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(2).max(32),
  type: z.string().refine((v) => isDepartmentType(v), {
    message: `type must be one of: ${ALL_DEPARTMENT_TYPES.join(', ')}`,
  }),
  description: z.string().trim().max(2000).optional(),
  supervisorId: z.string().trim().nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(2).max(32).optional(),
  type: z
    .string()
    .optional()
    .refine((v) => !v || isDepartmentType(v), { message: 'Invalid department type' }),
  description: z.string().trim().max(2000).optional(),
  supervisorId: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
});

const transferSchema = z.object({
  userId: z.string().trim().min(1),
  toDepartmentId: z.string().trim().nullable(),
});

const reasonSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.DEPARTMENT_MANAGE), departmentsController.list);
router.post(
  '/',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validate(createSchema),
  departmentsController.create,
);
router.patch(
  '/:departmentId',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validate(updateSchema),
  departmentsController.update,
);
router.post(
  '/transfer',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validate(transferSchema),
  departmentsController.transfer,
);
router.post(
  '/:departmentId/delete-request',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validate(reasonSchema),
  departmentsController.requestDelete,
);

export default router;
