import { PERMISSIONS } from '@ayetis/shared';
import { Router } from 'express';
import {
  authenticate,
  requireAnyPermission,
  requirePermission,
} from '../../middleware/auth';
import { caseFileUpload, deliveryVideoUpload } from '../../middleware/uploads';
import { validate } from '../../middleware/validate';
import { caseClarificationsRouter } from '../clarifications/clarifications.routes';
import * as casesController from './cases.controller';
import {
  addNoteSchema,
  assignCaseSchema,
  clinicalRemarkSchema,
  createCaseSchema,
  doctorDecisionSchema,
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
  '/dashboard/consultant',
  requirePermission(PERMISSIONS.CASE_CONSULT),
  casesController.consultantDashboard,
);

router.get(
  '/reports/consultant/me',
  requirePermission(PERMISSIONS.CASE_CONSULT),
  validate(performanceQuerySchema, 'query'),
  casesController.consultantPerformance,
);

router.get(
  '/dashboard/doctor-deliveries',
  requirePermission(PERMISSIONS.CASE_VIEW_OWN),
  casesController.doctorDeliveryQueue,
);

router.get(
  '/assignees/designers',
  requirePermission(PERMISSIONS.CASE_ASSIGN),
  casesController.listDesigners,
);

router.get(
  '/assignees/doctors',
  requirePermission(PERMISSIONS.CASE_CREATE),
  casesController.listDoctors,
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
  caseFileUpload.array('files', 20),
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
  '/:caseId/files/:fileId/signed-url',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CASE_QC_REVIEW,
    PERMISSIONS.CASE_CONSULT,
  ),
  casesController.signedFileUrl,
);

router.post(
  '/:caseId/files/:fileId/restore',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CASE_QC_REVIEW,
    PERMISSIONS.CASE_CONSULT,
  ),
  casesController.restoreFile,
);

router.get(
  '/:caseId/files/:fileId/restore-status',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CASE_QC_REVIEW,
    PERMISSIONS.CASE_CONSULT,
  ),
  casesController.fileRestoreStatus,
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
  '/:caseId/delivery/video/signed-url',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CASE_QC_REVIEW,
    PERMISSIONS.CASE_CONSULT,
  ),
  casesController.signedDeliveryVideoUrl,
);

router.post(
  '/:caseId/delivery/video/restore',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CASE_QC_REVIEW,
    PERMISSIONS.CASE_CONSULT,
  ),
  casesController.restoreDeliveryVideoHandler,
);

router.get(
  '/:caseId/delivery/video/restore-status',
  requireAnyPermission(
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CASE_QC_REVIEW,
    PERMISSIONS.CASE_CONSULT,
  ),
  casesController.deliveryVideoRestoreStatus,
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
  deliveryVideoUpload.single('video'),
  validate(qcApproveSchema),
  casesController.approveQc,
);

router.post(
  '/:caseId/qc/reject',
  requirePermission(PERMISSIONS.CASE_QC_REVIEW),
  validate(qcRejectSchema),
  casesController.rejectQc,
);

router.post(
  '/:caseId/clinical-remarks',
  requirePermission(PERMISSIONS.CASE_CONSULT),
  validate(clinicalRemarkSchema),
  casesController.addClinicalRemark,
);

router.post(
  '/:caseId/doctor/view',
  requirePermission(PERMISSIONS.CASE_VIEW_OWN),
  casesController.recordDoctorView,
);

router.post(
  '/:caseId/doctor/decision',
  requirePermission(PERMISSIONS.CASE_VIEW_OWN),
  validate(doctorDecisionSchema),
  casesController.doctorDecision,
);

router.use('/:caseId/clarifications', caseClarificationsRouter);

export default router;
