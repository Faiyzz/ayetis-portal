import { PERMISSIONS, isRefundStatus } from '@ayetis/shared';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { getRequestAuditContext } from '../audit/audit.service';
import type { AuthenticatedRequest } from '../../middleware/auth';
import type { NextFunction, Response } from 'express';
import * as service from './cancellations.service';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  caseId: z.string().optional(),
  doctorId: z.string().optional(),
  coordinatorId: z.string().optional(),
  companyName: z.string().optional(),
  treatmentPlanName: z.string().optional(),
  cancellationReason: z.string().optional(),
  caseCategory: z.string().optional(),
  refundStatus: z.string().optional(),
  paymentStatus: z.string().optional(),
  trend: z.string().optional(),
  q: z.string().optional(),
});

const refundSchema = z.object({
  refundStatus: z.string().refine(isRefundStatus),
  refundTransactionReference: z.string().trim().max(200).optional(),
});

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.CANCELLATION_REPORT_VIEW),
  validate(listQuerySchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.listCancellationAudits(req.query as never);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/export.csv',
  requirePermission(PERMISSIONS.CANCELLATION_REPORT_VIEW),
  validate(listQuerySchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const csv = await service.exportCancellationCsv(req.query as never);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="cancellation-audit.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/export.xls',
  requirePermission(PERMISSIONS.CANCELLATION_REPORT_VIEW),
  validate(listQuerySchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const xml = await service.exportCancellationExcel(req.query as never);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="cancellation-audit.xls"');
      res.send(xml);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/export.html',
  requirePermission(PERMISSIONS.CANCELLATION_REPORT_VIEW),
  validate(listQuerySchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const html = await service.exportCancellationHtml(req.query as never);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="cancellation-audit.html"');
      res.send(html);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/:id/refund',
  requirePermission(PERMISSIONS.CANCELLATION_REFUND_UPDATE),
  validate(refundSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.updateCancellationRefund(
        req.params.id,
        req.body,
        { id: req.user!.id, email: req.user!.email, role: req.user!.role },
        getRequestAuditContext(req),
      );
      res.json({ success: true, data, message: 'Refund status updated' });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
