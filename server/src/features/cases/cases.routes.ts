import { PERMISSIONS } from '@ayetis/shared';
import { Router } from 'express';
import {
  authenticate,
  requireAnyPermission,
  requirePermission,
} from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as casesController from './cases.controller';
import {
  addNoteSchema,
  createCaseSchema,
  listCasesQuerySchema,
  reasonSchema,
  updateCaseSchema,
} from './cases.schemas';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
  ),
  validate(listCasesQuerySchema, 'query'),
  casesController.listCases,
);

router.post(
  '/',
  requirePermission(PERMISSIONS.CASE_CREATE),
  validate(createCaseSchema),
  casesController.createCase,
);

router.get(
  '/:caseId',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
  ),
  casesController.getCase,
);

router.patch(
  '/:caseId',
  requirePermission(PERMISSIONS.CASE_UPDATE),
  validate(updateCaseSchema),
  casesController.updateCase,
);

router.post(
  '/:caseId/cancel',
  requireAnyPermission(PERMISSIONS.CASE_UPDATE, PERMISSIONS.CASE_DELETE),
  validate(reasonSchema),
  casesController.cancelCase,
);

router.post(
  '/:caseId/delete',
  requirePermission(PERMISSIONS.CASE_DELETE),
  validate(reasonSchema),
  casesController.softDeleteCase,
);

router.post(
  '/:caseId/notes',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
  ),
  validate(addNoteSchema),
  casesController.addNote,
);

export default router;
