import { PERMISSIONS, isCaseCategory } from '@ayetis/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { NextFunction, Response } from 'express';
import { authenticate, requirePermission, type AuthenticatedRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { getRequestAuditContext } from '../audit/audit.service';
import * as service from './commercial.service';

const planSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(160),
  caseCategory: z.string().nullable().optional(),
  description: z.string().trim().max(2000).optional(),
  price: z.number().min(0),
  currency: z.string().trim().min(3).max(8).optional(),
  estimatedDeliveryHours: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
});

const discountSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(2).max(40),
  description: z.string().trim().max(500).optional(),
  percentOff: z.number().min(0).max(100).nullable().optional(),
  amountOff: z.number().min(0).nullable().optional(),
  currency: z.string().optional(),
  customerUserId: z.string().nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const slaSchema = z.object({
  slaBusinessHours: z.number().min(1).max(24 * 30),
});

const router = Router();
router.use(authenticate);

router.get('/treatment-plans', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const data = await service.listTreatmentPlans(activeOnly);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/treatment-plans',
  requirePermission(PERMISSIONS.TREATMENT_PLAN_MANAGE),
  validate(planSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = req.body;
      if (body.caseCategory && !isCaseCategory(body.caseCategory)) {
        res.status(400).json({ success: false, message: 'Invalid case category' });
        return;
      }
      const data = await service.upsertTreatmentPlan(
        body,
        { id: req.user!.id, email: req.user!.email, role: req.user!.role },
        getRequestAuditContext(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/discount-codes',
  requirePermission(PERMISSIONS.DISCOUNT_CODE_MANAGE),
  async (_req, res, next) => {
    try {
      res.json({ success: true, data: await service.listDiscountCodes() });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/discount-codes',
  requirePermission(PERMISSIONS.DISCOUNT_CODE_MANAGE),
  validate(discountSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.upsertDiscountCode(
        req.body,
        { id: req.user!.id, email: req.user!.email, role: req.user!.role },
        getRequestAuditContext(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/discount-codes/validate',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const code = String(req.body?.code ?? '');
      const data = await service.validateDiscountCode(code, req.user?.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/users/:userId/sla',
  requirePermission(PERMISSIONS.SLA_CONFIGURE),
  validate(slaSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.updateDoctorSlaHours(
        req.params.userId,
        req.body.slaBusinessHours,
        { id: req.user!.id, email: req.user!.email, role: req.user!.role },
        getRequestAuditContext(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
