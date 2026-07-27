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
  performanceQuerySchema,
  productionNotesSchema,
  qcApproveSchema,
  qcCommentSchema,
  qcRejectSchema,
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

const deliveryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024,
    files: 1,
  },
});

router.use(authenticate);

router.get(
  '/',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CASE_QC_REVIEW,
    PERMISSIONS.CASE_CONSULT,
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
  '/dashboard/qc',
  requirePermission(PERMISSIONS.CASE_QC_REVIEW),
  casesController.qcDashboard,
);

router.get(
  '/dashboard/escalated',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_CONSULT,
    PERMISSIONS.CASE_QC_REVIEW,
  ),
  casesController.escalatedQueue,
);

router.get(
  '/reports/designer/me',
  requirePermission(PERMISSIONS.CASE_DESIGN),
  validate(performanceQuerySchema, 'query'),
  casesController.designerPerformance,
);

router.get(
  '/reports/qc/me',
  requirePermission(PERMISSIONS.CASE_QC_REVIEW),
  validate(performanceQuerySchema, 'query'),
  casesController.qcPerformance,
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
    PERMISSIONS.CASE_QC_REVIEW,
    PERMISSIONS.CASE_CONSULT,
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
    PERMISSIONS.CASE_QC_REVIEW,
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
  '/:caseId/files/download-all',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CASE_QC_REVIEW,
    PERMISSIONS.CASE_CONSULT,
  ),
  casesController.downloadAllFiles,
);

router.get(
  '/:caseId/files/:fileId',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CASE_QC_REVIEW,
    PERMISSIONS.CASE_CONSULT,
  ),
  casesController.downloadFile,
);

router.get(
  '/:caseId/delivery/video',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CASE_QC_REVIEW,
    PERMISSIONS.CASE_CONSULT,
  ),
  casesController.downloadDeliveryVideo,
);

router.post(
  '/:caseId/production/start',
  requirePermission(PERMISSIONS.CASE_DESIGN),
  validate(productionNotesSchema),
  casesController.startProduction,
);

router.post(
  '/:caseId/production/notes',
  requirePermission(PERMISSIONS.CASE_DESIGN),
  validate(productionNotesSchema),
  casesController.updateProduction,
);

router.post(
  '/:caseId/production/submit-qc',
  requirePermission(PERMISSIONS.CASE_DESIGN),
  validate(productionNotesSchema),
  casesController.submitToQc,
);

router.post(
  '/:caseId/qc/comments',
  requirePermission(PERMISSIONS.CASE_QC_REVIEW),
  validate(qcCommentSchema),
  casesController.addQcComment,
);

router.post(
  '/:caseId/qc/approve',
  requirePermission(PERMISSIONS.CASE_QC_REVIEW),
  deliveryUpload.single('video'),
  validate(qcApproveSchema),
  casesController.approveQc,
);

router.post(
  '/:caseId/qc/reject',
  requirePermission(PERMISSIONS.CASE_QC_REVIEW),
  validate(qcRejectSchema),
  casesController.rejectQc,
);

router.use('/:caseId/clarifications', caseClarificationsRouter);

export default router;
