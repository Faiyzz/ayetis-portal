import {
  ALL_BILLING_ARRANGEMENTS,
  ALL_PAYMENT_PROVIDERS,
  PERMISSIONS,
  PRICE_SUBJECT_TYPES,
  isCaseCategory,
  isBillingArrangement,
} from '@ayetis/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { NextFunction, Request, Response } from 'express';
import {
  authenticate,
  requirePermission,
  type AuthenticatedRequest,
} from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { getRequestAuditContext } from '../audit/audit.service';
import { resolvePermissionsForUserId } from '../users/users.service';
import * as service from './commercial.service';
import * as pricing from './pricingBilling.service';
import * as payments from './payments.service';
import * as invoices from './invoices.service';
import { permissionsInclude } from '@ayetis/shared';

const planSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(160),
  caseCategory: z.string().nullable().optional(),
  description: z.string().trim().max(2000).optional(),
  price: z.number().min(0),
  currency: z.string().trim().min(3).max(8).optional(),
  estimatedDeliveryHours: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  isFreeDemo: z.boolean().optional(),
  archived: z.boolean().optional(),
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
  maxUses: z.number().int().min(1).nullable().optional(),
  applicableCaseCategories: z.array(z.string()).optional(),
  applicablePlanIds: z.array(z.string()).optional(),
});

const slaSchema = z.object({
  slaBusinessHours: z.number().min(1).max(24 * 30),
});

const priceOverrideSchema = z.object({
  id: z.string().optional(),
  subjectType: z.enum([PRICE_SUBJECT_TYPES.USER, PRICE_SUBJECT_TYPES.ORGANIZATION]),
  subjectId: z.string().min(1),
  treatmentPlanId: z.string().min(1),
  price: z.number().min(0),
  currency: z.string().optional(),
  effectiveFrom: z.string().nullable().optional(),
  effectiveUntil: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const billingSchema = z.object({
  subjectType: z.enum([PRICE_SUBJECT_TYPES.USER, PRICE_SUBJECT_TYPES.ORGANIZATION]),
  subjectId: z.string().min(1),
  billingArrangement: z
    .string()
    .nullable()
    .refine((v) => v == null || isBillingArrangement(v), {
      message: 'Invalid billing arrangement',
    }),
});

const prepaidCreditSchema = z.object({
  subjectType: z.enum([PRICE_SUBJECT_TYPES.USER, PRICE_SUBJECT_TYPES.ORGANIZATION]),
  subjectId: z.string().min(1),
  cases: z.number().int().min(1),
  reason: z.string().max(500).optional(),
});

const providerSchema = z.object({
  id: z.string().optional(),
  provider: z.enum(['stripe', 'bank_transfer', 'custom']),
  label: z.string().trim().min(1).max(120),
  enabled: z.boolean().optional(),
  instructions: z.string().max(4000).optional(),
  config: z.record(z.string()).optional(),
});

const eligibilitySchema = z.object({
  treatmentPlanId: z.string().min(1),
  discountCode: z.string().nullable().optional(),
  isDemo: z.boolean().optional(),
  caseCategory: z.string().nullable().optional(),
});

const paymentSessionCreateSchema = z.object({
  createPayload: z.record(z.unknown()),
});

const router = Router();

/** Stripe webhook — mounted without authenticate; caller must send raw body. */
export async function stripeWebhookHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const signature = req.headers['stripe-signature'];
    const body = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    const result = await payments.handleStripeWebhook(
      body,
      typeof signature === 'string' ? signature : undefined,
    );
    res.json({ received: true, ...result });
  } catch (error) {
    next(error);
  }
}

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
      const data = await service.validateDiscountCode(code, req.user?.id, {
        treatmentPlanId: req.body?.treatmentPlanId,
        caseCategory: req.body?.caseCategory,
      });
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

router.post(
  '/pricing/resolve',
  validate(eligibilitySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const doctorId = req.user!.id;
      const subject = await pricing.loadBillingSubject(doctorId);
      const data = await pricing.resolveCasePricing({
        treatmentPlanId: req.body.treatmentPlanId,
        discountCode: req.body.discountCode,
        customerUserId: doctorId,
        organizationId: subject.organizationId,
        caseCategory: req.body.caseCategory,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/eligibility',
  validate(eligibilitySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await pricing.evaluateCreateEligibility({
        userId: req.user!.id,
        treatmentPlanId: req.body.treatmentPlanId,
        discountCode: req.body.discountCode,
        isDemo: req.body.isDemo,
        caseCategory: req.body.caseCategory,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/customer-prices',
  requirePermission(PERMISSIONS.CUSTOMER_PRICE_MANAGE),
  async (_req, res, next) => {
    try {
      res.json({ success: true, data: await pricing.listCustomerPrices() });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/customer-prices',
  requirePermission(PERMISSIONS.CUSTOMER_PRICE_MANAGE),
  validate(priceOverrideSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await pricing.upsertCustomerPrice(
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

router.get(
  '/billing/:subjectType/:subjectId',
  requirePermission(PERMISSIONS.BILLING_ARRANGE_MANAGE),
  async (req, res, next) => {
    try {
      const subjectType = String(req.params.subjectType);
      if (
        subjectType !== PRICE_SUBJECT_TYPES.USER &&
        subjectType !== PRICE_SUBJECT_TYPES.ORGANIZATION
      ) {
        res.status(400).json({ success: false, message: 'Invalid subject type' });
        return;
      }
      res.json({
        success: true,
        data: await pricing.getBillingProfile(subjectType, req.params.subjectId),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/billing',
  requirePermission(PERMISSIONS.BILLING_ARRANGE_MANAGE),
  validate(billingSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await pricing.updateBillingArrangement(
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
  '/prepaid/credit',
  requirePermission(PERMISSIONS.PREPAID_MANAGE),
  validate(prepaidCreditSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await pricing.creditPrepaid(
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

router.get(
  '/prepaid/:subjectType/:subjectId/ledger',
  requirePermission(PERMISSIONS.PREPAID_MANAGE),
  async (req, res, next) => {
    try {
      const subjectType = String(req.params.subjectType);
      if (
        subjectType !== PRICE_SUBJECT_TYPES.USER &&
        subjectType !== PRICE_SUBJECT_TYPES.ORGANIZATION
      ) {
        res.status(400).json({ success: false, message: 'Invalid subject type' });
        return;
      }
      res.json({
        success: true,
        data: await pricing.listPrepaidLedger(subjectType, req.params.subjectId),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/billing-arrangements', (_req, res) => {
  res.json({ success: true, data: ALL_BILLING_ARRANGEMENTS });
});

router.get('/payment-providers', async (req: AuthenticatedRequest, res, next) => {
  try {
    const perms = await resolvePermissionsForUserId(req.user!.id);
    req.user!.permissions = perms;
    const manage = permissionsInclude(perms, PERMISSIONS.PAYMENT_PROVIDER_MANAGE);
    const data = await payments.listPaymentProviders(!manage);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/payment-providers',
  requirePermission(PERMISSIONS.PAYMENT_PROVIDER_MANAGE),
  validate(providerSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await payments.upsertPaymentProvider(
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
  '/payment-sessions',
  validate(paymentSessionCreateSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await payments.createPaymentSession(
        req.user!.id,
        req.body.createPayload as never,
        { id: req.user!.id, email: req.user!.email, role: req.user!.role },
        getRequestAuditContext(req),
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/payment-sessions/:sessionId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const perms = await resolvePermissionsForUserId(req.user!.id);
      const canViewAll = permissionsInclude(perms, PERMISSIONS.INVOICE_MANAGE);
      const data = await payments.getPaymentSession(
        req.params.sessionId,
        req.user!.id,
        canViewAll,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/payment-sessions/:sessionId/provider',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const provider = String(req.body?.provider ?? '');
      if (!(ALL_PAYMENT_PROVIDERS as string[]).includes(provider)) {
        res.status(400).json({ success: false, message: 'Invalid provider' });
        return;
      }
      const data = await payments.selectPaymentProvider(
        req.params.sessionId,
        provider as never,
        req.user!.id,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/payment-sessions/:sessionId/bank-reference',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await payments.submitBankReference(
        req.params.sessionId,
        String(req.body?.bankReference ?? ''),
        req.user!.id,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/payment-sessions/:sessionId/confirm',
  requirePermission(PERMISSIONS.INVOICE_MANAGE),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await payments.confirmPaymentSession(
        req.params.sessionId,
        { id: req.user!.id, email: req.user!.email, role: req.user!.role },
        getRequestAuditContext(req),
        { mockStripe: Boolean(req.body?.mockStripe) },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

/** Doctors can mark mock Stripe paid in non-prod when key is absent. */
router.post(
  '/payment-sessions/:sessionId/mock-pay',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await payments.confirmPaymentSession(
        req.params.sessionId,
        { id: req.user!.id, email: req.user!.email, role: req.user!.role },
        getRequestAuditContext(req),
        { mockStripe: true },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/invoices',
  requirePermission(PERMISSIONS.INVOICE_VIEW),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const perms = req.user!.permissions ?? (await resolvePermissionsForUserId(req.user!.id));
      const canManage = permissionsInclude(perms, PERMISSIONS.INVOICE_MANAGE);
      const data = await invoices.listInvoices({
        caseId: req.query.caseId ? String(req.query.caseId) : undefined,
        customerUserId: canManage
          ? req.query.customerUserId
            ? String(req.query.customerUserId)
            : undefined
          : req.user!.id,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/invoices/:id',
  requirePermission(PERMISSIONS.INVOICE_VIEW),
  async (req, res, next) => {
    try {
      const doc = await invoices.getInvoice(req.params.id);
      res.json({ success: true, data: invoices.invoiceDto(doc) });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/invoices/:id/html',
  requirePermission(PERMISSIONS.INVOICE_VIEW),
  async (req, res, next) => {
    try {
      const doc = await invoices.getInvoice(req.params.id);
      res.type('html').send(doc.htmlBody || '<p>No HTML</p>');
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/receipts/:id/html',
  requirePermission(PERMISSIONS.INVOICE_VIEW),
  async (req, res, next) => {
    try {
      const doc = await invoices.getReceipt(req.params.id);
      res.type('html').send(doc.htmlBody || '<p>No HTML</p>');
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/invoices/batch-stub',
  requirePermission(PERMISSIONS.INVOICE_MANAGE),
  async (req, res, next) => {
    try {
      const caseIds = Array.isArray(req.body?.caseIds) ? req.body.caseIds.map(String) : [];
      res.json({ success: true, data: await invoices.generateScheduledInvoiceStub(caseIds) });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
