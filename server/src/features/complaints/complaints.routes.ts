import {
  ALL_COMPLAINT_TYPES,
  PERMISSIONS,
  isComplaintStatus,
  isComplaintType,
} from '@ayetis/shared';
import { Router } from 'express';
import { z } from 'zod';
import {
  authenticate,
  requireAnyPermission,
  requirePermission,
} from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as complaintsController from './complaints.controller';

const router = Router();

const createSchema = z.object({
  details: z.string().trim().min(3).max(5000),
  caseId: z.string().trim().max(40).optional(),
  type: z.string().refine((v) => isComplaintType(v), {
    message: `type must be one of: ${ALL_COMPLAINT_TYPES.join(', ')}`,
  }),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  responsibleEmployeeId: z.string().trim().nullable().optional(),
  responsibleQcId: z.string().trim().nullable().optional(),
  responsibleConsultantId: z.string().trim().nullable().optional(),
  responsibleSupervisorId: z.string().trim().nullable().optional(),
  additionalComments: z.string().trim().max(2000).optional(),
});

const updateSchema = z.object({
  status: z
    .string()
    .optional()
    .refine((v) => !v || isComplaintStatus(v), { message: 'Invalid status' }),
  additionalComments: z.string().trim().max(2000).optional(),
  responsibleEmployeeId: z.string().trim().nullable().optional(),
  responsibleQcId: z.string().trim().nullable().optional(),
  responsibleConsultantId: z.string().trim().nullable().optional(),
  responsibleSupervisorId: z.string().trim().nullable().optional(),
});

router.use(authenticate);

router.get(
  '/',
  requireAnyPermission(
    PERMISSIONS.COMPLAINT_VIEW,
    PERMISSIONS.COMPLAINT_MANAGE,
    PERMISSIONS.CASE_VIEW_ALL,
  ),
  complaintsController.list,
);

router.get(
  '/ratings',
  requireAnyPermission(PERMISSIONS.COMPLAINT_VIEW, PERMISSIONS.CASE_VIEW_ALL),
  complaintsController.ratings,
);

router.post(
  '/',
  requireAnyPermission(
    PERMISSIONS.COMPLAINT_MANAGE,
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
  ),
  validate(createSchema),
  complaintsController.create,
);

router.patch(
  '/:complaintId',
  requirePermission(PERMISSIONS.COMPLAINT_MANAGE),
  validate(updateSchema),
  complaintsController.update,
);

export default router;
