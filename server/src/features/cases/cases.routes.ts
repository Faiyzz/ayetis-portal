import { PERMISSIONS } from '@ayetis/shared';
import { Router } from 'express';
import multer from 'multer';
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
  setPrioritySchema,
  updateCaseSchema,
  uploadFilesMetaSchema,
} from './cases.schemas';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
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
  requireAnyPermission(
    PERMISSIONS.CASE_CREATE,
    PERMISSIONS.CASE_UPDATE,
  ),
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

export default router;
