import { PERMISSIONS } from '@ayetis/shared';
import { Router } from 'express';
import { authenticate, requireAnyPermission } from '../../middleware/auth';
import * as reportsController from './reports.controller';

const router = Router();

router.use(authenticate);
router.use(
  requireAnyPermission(
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ALL,
  ),
);

router.get('/dashboard', reportsController.dashboard);
router.get('/pipeline', reportsController.pipeline);
router.get('/designer', reportsController.designer);
router.get('/qc', reportsController.qc);
router.get('/consultant', reportsController.consultant);
router.get('/supervisor', reportsController.supervisor);
router.get('/comparison', reportsController.comparison);
router.get('/export/:report', reportsController.exportCsv);

export default router;
