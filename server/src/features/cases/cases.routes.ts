import { PERMISSIONS } from '@ayetis/shared';
import { Router } from 'express';
import multer from 'multer';
import {
  authenticate,
  requireAnyPermission,
  requirePermission,
} from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { caseClarificationsRouter } from '../clarifications/clarifications.routes';
import * as casesController from './cases.controller';
import {
  addNoteSchema,
  assignCaseSchema,
  createCaseSchema,
  listCasesQuerySchema,
  reasonSchema,
  setPrioritySchema,
  treatmentInstructionsBodySchema,
  updateCaseSchema,
  updatePaymentSchema,
  uploadFilesMetaSchema,
  validateCaseSchema,
} from './cases.schemas';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 20,
  },
});

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
  '/dashboard/coordinator',
  requireAnyPermission(
    PERMISSIONS.CASE_VALIDATE,
    PERMISSIONS.CASE_ASSIGN,
    PERMISSIONS.CASE_VIEW_ALL,
  ),
  casesController.coordinatorDashboard,
);

router.get(
  '/assignees/designers',
  requirePermission(PERMISSIONS.CASE_ASSIGN),
  casesController.listDesigners,
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
  '/:caseId/priority',
  requirePermission(PERMISSIONS.CASE_SET_PRIORITY),
  validate(setPrioritySchema),
  casesController.setPriority,
);

router.post(
  '/:caseId/validation/start',
  requirePermission(PERMISSIONS.CASE_VALIDATE),
  casesController.startValidation,
);

router.post(
  '/:caseId/validate',
  requirePermission(PERMISSIONS.CASE_VALIDATE),
  validate(validateCaseSchema),
  casesController.markValidated,
);

router.post(
  '/:caseId/assign',
  requirePermission(PERMISSIONS.CASE_ASSIGN),
  validate(assignCaseSchema),
  casesController.assignCase,
);

router.patch(
  '/:caseId/payment',
  requirePermission(PERMISSIONS.CASE_MANAGE_PAYMENT),
  validate(updatePaymentSchema),
  casesController.updatePayment,
);

router.patch(
  '/:caseId/treatment-instructions',
  requireAnyPermission(PERMISSIONS.CASE_CREATE, PERMISSIONS.CASE_UPDATE),
  validate(treatmentInstructionsBodySchema),
  casesController.updateTreatmentInstructions,
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

router.post(
  '/:caseId/files',
  requireAnyPermission(PERMISSIONS.CASE_CREATE, PERMISSIONS.CASE_UPDATE),
  upload.array('files', 20),
  validate(uploadFilesMetaSchema),
  casesController.uploadFiles,
);

router.get(
  '/:caseId/files/:fileId',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
  ),
  casesController.downloadFile,
);

router.use('/:caseId/clarifications', caseClarificationsRouter);

export default router;
