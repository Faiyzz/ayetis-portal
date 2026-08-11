import {
  ALL_ASSIGNMENT_QUEUES,
  ALL_EXPERIENCE_LEVELS,
  ALL_PERMISSIONS,
  ALL_PORTAL_TEMPLATES,
  ALL_QC_SCOPES,
  PERMISSIONS,
} from '@ayetis/shared';
import { Router } from 'express';
import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import {
  authenticate,
  requireAnyPermission,
  requirePermission,
  type AuthenticatedRequest,
} from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { getRequestAuditContext } from '../audit/audit.service';
import * as service from './rbac.service';

const router = Router();

router.use(authenticate);

function actor(req: AuthenticatedRequest) {
  return {
    id: req.user!.id,
    email: req.user!.email,
    role: req.user!.role,
  };
}

const portalTemplateSchema = z.enum(ALL_PORTAL_TEMPLATES as [string, ...string[]]);
const qcScopeSchema = z.enum(ALL_QC_SCOPES as [string, ...string[]]);
const assignmentQueueSchema = z.enum(ALL_ASSIGNMENT_QUEUES as [string, ...string[]]);
const experienceLevelSchema = z.enum(ALL_EXPERIENCE_LEVELS as [string, ...string[]]);
const permissionSchema = z.enum(ALL_PERMISSIONS as [string, ...string[]]);

router.get(
  '/roles',
  requirePermission(PERMISSIONS.ROLE_VIEW_PERMISSIONS),
  async (_req, res, next) => {
    try {
      res.json({ success: true, data: await service.listRoleDefinitions() });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/roles',
  requirePermission(PERMISSIONS.ROLE_MANAGE),
  validate(
    z.object({
      key: z.string().trim().min(2).max(64).optional(),
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(500).nullable().optional(),
      portalTemplate: portalTemplateSchema,
      qcScope: qcScopeSchema.optional(),
    }),
  ),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.createRole(req.body, actor(req), getRequestAuditContext(req));
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/roles/:key',
  requirePermission(PERMISSIONS.ROLE_MANAGE),
  validate(
    z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(500).nullable().optional(),
        portalTemplate: portalTemplateSchema.optional(),
        qcScope: qcScopeSchema.optional(),
        isActive: z.boolean().optional(),
        isDisabled: z.boolean().optional(),
      })
      .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one field is required',
      }),
  ),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.updateRole(
        req.params.key,
        req.body,
        actor(req),
        getRequestAuditContext(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/roles/:key',
  requirePermission(PERMISSIONS.ROLE_MANAGE),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.deleteRole(
        req.params.key,
        actor(req),
        getRequestAuditContext(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/roles/reorder',
  requirePermission(PERMISSIONS.ROLE_MANAGE),
  validate(
    z.object({
      keys: z.array(z.string().trim().min(1)).min(1),
    }),
  ),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.reorderRoles(
        req.body.keys,
        actor(req),
        getRequestAuditContext(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/roles/:key/clone',
  requirePermission(PERMISSIONS.ROLE_MANAGE),
  validate(
    z.object({
      name: z.string().trim().min(1).max(120),
      key: z.string().trim().min(2).max(64).optional(),
    }),
  ),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.cloneRole(
        req.params.key,
        req.body,
        actor(req),
        getRequestAuditContext(req),
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/roles/:key/permissions',
  requireAnyPermission(PERMISSIONS.ROLE_ASSIGN_PERMISSIONS, PERMISSIONS.ROLE_MANAGE),
  validate(
    z.object({
      grants: z.array(permissionSchema).default([]),
      denies: z.array(permissionSchema).default([]),
    }),
  ),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.patchRolePermissions(
        req.params.key,
        req.body.grants,
        req.body.denies,
        actor(req),
        getRequestAuditContext(req),
      );
      res.json({ success: true, data, message: 'Role permissions updated' });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/matrix',
  requirePermission(PERMISSIONS.ROLE_VIEW_PERMISSIONS),
  async (_req, res, next) => {
    try {
      res.json({ success: true, data: await service.getPermissionMatrix() });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/teams',
  requirePermission(PERMISSIONS.TEAM_MANAGE),
  async (_req, res, next) => {
    try {
      res.json({ success: true, data: await service.listTeams() });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/teams',
  requirePermission(PERMISSIONS.TEAM_MANAGE),
  validate(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(1).max(120),
      code: z.string().trim().max(40).nullable().optional(),
      supervisorIds: z.array(z.string()).optional(),
      memberIds: z.array(z.string()).optional(),
      regionIds: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }),
  ),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.upsertTeam(req.body, actor(req), getRequestAuditContext(req));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/teams/:id',
  requirePermission(PERMISSIONS.TEAM_MANAGE),
  validate(
    z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        code: z.string().trim().max(40).nullable().optional(),
        supervisorIds: z.array(z.string()).optional(),
        memberIds: z.array(z.string()).optional(),
        regionIds: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      })
      .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one field is required',
      }),
  ),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.upsertTeam(
        { id: req.params.id, ...req.body },
        actor(req),
        getRequestAuditContext(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/teams/:id',
  requirePermission(PERMISSIONS.TEAM_MANAGE),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.deleteTeam(req.params.id, actor(req), getRequestAuditContext(req));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/assignment-rules',
  requirePermission(PERMISSIONS.ASSIGNMENT_RULE_MANAGE),
  async (req, res, next) => {
    try {
      const queue = req.query.targetQueue ? String(req.query.targetQueue) : undefined;
      res.json({
        success: true,
        data: await service.listAssignmentRules(
          queue as (typeof ALL_ASSIGNMENT_QUEUES)[number] | undefined,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/assignment-rules',
  requirePermission(PERMISSIONS.ASSIGNMENT_RULE_MANAGE),
  validate(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(1).max(160),
      isActive: z.boolean().optional(),
      priority: z.number().optional(),
      targetQueue: assignmentQueueSchema,
      roleKeys: z.array(z.string()).optional(),
      teamIds: z.array(z.string()).optional(),
      regionIds: z.array(z.string()).optional(),
      countryIds: z.array(z.string()).optional(),
      excludedCountryIds: z.array(z.string()).optional(),
      experienceLevels: z.array(experienceLevelSchema).optional(),
      softwareKeys: z.array(z.string()).optional(),
      requireAvailable: z.boolean().optional(),
      maxOpenCases: z.number().nullable().optional(),
      weight: z.number().optional(),
    }),
  ),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.upsertAssignmentRule(
        req.body,
        actor(req),
        getRequestAuditContext(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/assignment-rules/:id',
  requirePermission(PERMISSIONS.ASSIGNMENT_RULE_MANAGE),
  validate(
    z
      .object({
        name: z.string().trim().min(1).max(160).optional(),
        isActive: z.boolean().optional(),
        priority: z.number().optional(),
        targetQueue: assignmentQueueSchema.optional(),
        roleKeys: z.array(z.string()).optional(),
        teamIds: z.array(z.string()).optional(),
        regionIds: z.array(z.string()).optional(),
        countryIds: z.array(z.string()).optional(),
        excludedCountryIds: z.array(z.string()).optional(),
        experienceLevels: z.array(experienceLevelSchema).optional(),
        softwareKeys: z.array(z.string()).optional(),
        requireAvailable: z.boolean().optional(),
        maxOpenCases: z.number().nullable().optional(),
        weight: z.number().optional(),
      })
      .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one field is required',
      }),
  ),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.upsertAssignmentRule(
        { id: req.params.id, ...req.body },
        actor(req),
        getRequestAuditContext(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/assignment-rules/:id',
  requirePermission(PERMISSIONS.ASSIGNMENT_RULE_MANAGE),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.deleteAssignmentRule(
        req.params.id,
        actor(req),
        getRequestAuditContext(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/assignment-rules/reorder',
  requirePermission(PERMISSIONS.ASSIGNMENT_RULE_MANAGE),
  validate(
    z.object({
      ids: z.array(z.string().trim().min(1)).min(1),
    }),
  ),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service.reorderAssignmentRules(
        req.body.ids,
        actor(req),
        getRequestAuditContext(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
