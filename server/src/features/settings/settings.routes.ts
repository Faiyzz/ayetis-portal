import {
  ALL_MASTER_LIST_TYPES,
  BRANDING_LOGO_SLOTS,
  PERMISSIONS,
  isMasterListType,
} from '@ayetis/shared';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { NextFunction, Response } from 'express';
import {
  authenticate,
  requireAnyPermission,
  requirePermission,
  type AuthenticatedRequest,
} from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { getRequestAuditContext } from '../audit/audit.service';
import * as service from './settings.service';
import { AppError } from '../../utils/AppError';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

const router = Router();

router.get('/branding', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await service.getBranding() });
  } catch (error) {
    next(error);
  }
});

router.get('/business-config', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await service.getBusinessConfig() });
  } catch (error) {
    next(error);
  }
});

router.get('/sla', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await service.getSlaConfig() });
  } catch (error) {
    next(error);
  }
});

router.get('/privacy/current', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await service.getCurrentPrivacy() });
  } catch (error) {
    next(error);
  }
});

router.get('/lists/:type', async (req, res, next) => {
  try {
    const type = String(req.params.type);
    if (!isMasterListType(type)) {
      res.status(400).json({ success: false, message: 'Invalid list type' });
      return;
    }
    const activeOnly = req.query.activeOnly !== 'false';
    res.json({ success: true, data: await service.listMasterItems(type, activeOnly) });
  } catch (error) {
    next(error);
  }
});

router.get('/countries', async (req, res, next) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
    res.json({ success: true, data: await service.listCountries(activeOnly) });
  } catch (error) {
    next(error);
  }
});

router.get('/regions', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await service.listRegions() });
  } catch (error) {
    next(error);
  }
});

router.get('/branding/asset', async (req, res, next) => {
  try {
    const key = String(req.query.key ?? '');
    if (!key.startsWith('cases/branding-') && !key.includes('branding')) {
      throw new AppError('Invalid asset key', 400);
    }
    const { stream, contentLength } = await service.streamBrandingAsset(key);
    if (contentLength) res.setHeader('Content-Length', String(contentLength));
    res.setHeader('Content-Type', 'image/png');
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

router.use(authenticate);

router.get(
  '/messages',
  requireAnyPermission(
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.REGISTRATION_APPROVE,
  ),
  async (_req, res, next) => {
    try {
      res.json({ success: true, data: await service.getMessages() });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/messages',
  requireAnyPermission(PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.REGISTRATION_APPROVE),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.saveMessages(
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
  '/lists',
  requirePermission(PERMISSIONS.MASTER_DATA_MANAGE),
  validate(
    z.object({
      id: z.string().optional(),
      type: z.enum(ALL_MASTER_LIST_TYPES as [string, ...string[]]),
      label: z.string().trim().min(1).max(160),
      code: z.string().nullable().optional(),
      sortOrder: z.number().optional(),
      parentId: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
      metadata: z.record(z.string()).optional(),
    }),
  ),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await service.upsertMasterItem(
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
  '/regions',
  requirePermission(PERMISSIONS.REGION_MANAGE),
  validate(
    z.object({
      id: z.string().optional(),
      code: z.string().trim().min(2).max(32),
      name: z.string().trim().min(1).max(120),
      isActive: z.boolean().optional(),
    }),
  ),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await service.upsertRegion(
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
  '/countries',
  requirePermission(PERMISSIONS.REGION_MANAGE),
  validate(
    z.object({
      id: z.string().optional(),
      code: z.string().trim().min(2).max(40),
      name: z.string().trim().min(1).max(120),
      dialCode: z.string().nullable().optional(),
      regionId: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
    }),
  ),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await service.upsertCountry(
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
  '/country-requests',
  requirePermission(PERMISSIONS.REGION_MANAGE),
  async (req, res, next) => {
    try {
      res.json({
        success: true,
        data: await service.listCountryRequests(
          req.query.status ? String(req.query.status) : undefined,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/country-requests/:id/review',
  requirePermission(PERMISSIONS.REGION_MANAGE),
  validate(
    z.object({
      status: z.enum(['approved', 'rejected']),
      regionId: z.string().nullable().optional(),
      reviewNotes: z.string().optional(),
      dialCode: z.string().nullable().optional(),
    }),
  ),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await service.reviewCountryRequest(
        req.params.id,
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

router.patch(
  '/branding',
  requirePermission(PERMISSIONS.BRANDING_MANAGE),
  validate(
    z.object({
      companyName: z.string().trim().min(1).max(160).optional(),
      notificationEmails: z.array(z.string().email()).optional(),
    }),
  ),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await service.updateBranding(
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
  '/branding/logos/:slot',
  requirePermission(PERMISSIONS.BRANDING_MANAGE),
  upload.single('file'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const slot = String(req.params.slot);
      if (!(Object.values(BRANDING_LOGO_SLOTS) as string[]).includes(slot)) {
        throw new AppError('Invalid logo slot', 400);
      }
      if (!req.file) throw new AppError('File required', 400);
      const data = await service.uploadBrandingLogo(
        slot as 'login' | 'header' | 'footer' | 'email',
        {
          buffer: req.file.buffer,
          mimetype: req.file.mimetype,
          originalname: req.file.originalname,
        },
        { id: req.user!.id, email: req.user!.email, role: req.user!.role },
        getRequestAuditContext(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/business-config',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await service.updateBusinessConfig(
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

router.patch(
  '/sla',
  requireAnyPermission(PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.SLA_CONFIGURE),
  validate(
    z.object({
      hoursBySegment: z
        .object({
          individual: z.number().min(1).max(24 * 30).optional(),
          company: z.number().min(1).max(24 * 30).optional(),
          sub_account: z.number().min(1).max(24 * 30).optional(),
        })
        .optional(),
      warningPercent: z.number().min(1).max(100).optional(),
    }),
  ),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await service.updateSlaConfig(
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
  '/email-templates',
  requirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE),
  async (_req, res, next) => {
    try {
      res.json({ success: true, data: await service.listEmailTemplates() });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/email-templates',
  requirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE),
  validate(
    z.object({
      key: z.string().trim().min(2).max(80),
      name: z.string().trim().min(1).max(160),
      subject: z.string().trim().min(1).max(300),
      htmlBody: z.string().min(1),
      placeholders: z.array(z.string()).optional(),
    }),
  ),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await service.upsertEmailTemplate(
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
  '/privacy/history',
  requirePermission(PERMISSIONS.PRIVACY_MANAGE),
  async (_req, res, next) => {
    try {
      res.json({ success: true, data: await service.listPrivacyHistory() });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/privacy/publish',
  requirePermission(PERMISSIONS.PRIVACY_MANAGE),
  validate(
    z.object({
      version: z.string().trim().min(1).max(40),
      bodyHtml: z.string().min(1),
    }),
  ),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await service.publishPrivacyPolicy(
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

router.put(
  '/customer-scope',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    z.object({
      subjectType: z.enum(['user', 'organization']),
      subjectId: z.string().min(1),
      preferredCurrency: z.string().optional(),
      regionIds: z.array(z.string()).optional(),
      scopedCountryIds: z.array(z.string()).optional(),
      excludedCountryIds: z.array(z.string()).optional(),
    }),
  ),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await service.updateCustomerScope(
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

export default router;
