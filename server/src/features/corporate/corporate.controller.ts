import type { NextFunction, Response } from 'express';
import type { Permission } from '@ayetis/shared';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { User } from '../../models/User';
import { AppError } from '../../utils/AppError';
import { getRequestAuditContext } from '../audit/audit.service';
import { resolvePermissionsForUserId } from '../users/users.service';
import * as corporateService from './corporate.service';

async function actor(req: AuthenticatedRequest): Promise<corporateService.CorporateActor> {
  const user = await User.findById(req.user!.id);
  if (!user || !user.isActive) throw new AppError('User not found or inactive', 401);
  const permissions = await resolvePermissionsForUserId(user.id);
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    permissions: permissions as Permission[],
    organizationId: user.organizationId ? String(user.organizationId) : null,
    facilityId: user.facilityId ? String(user.facilityId) : null,
    corporateCustomerId: user.corporateCustomerId ?? null,
  };
}

export async function dashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId =
      typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const data = await corporateService.getCorporateDashboard(await actor(req), organizationId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getOrganization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId =
      typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const data = await corporateService.getOrganizationForActor(await actor(req), organizationId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateOrganization(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const organizationId =
      typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const data = await corporateService.updateOrganization(
      await actor(req),
      req.body,
      organizationId,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data, message: 'Organization updated' });
  } catch (error) {
    next(error);
  }
}

export async function listOrganizations(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const a = await actor(req);
    if (a.role !== 'admin') {
      throw new AppError('Only Main Admin can list all organizations', 403);
    }
    const data = await corporateService.listOrganizationsForAdmin();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listFacilities(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId =
      typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const data = await corporateService.listFacilities(await actor(req), organizationId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createFacility(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId =
      typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const data = await corporateService.createFacility(
      await actor(req),
      req.body,
      organizationId,
      getRequestAuditContext(req),
    );
    res.status(201).json({ success: true, data, message: 'Facility created' });
  } catch (error) {
    next(error);
  }
}

export async function updateFacility(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await corporateService.updateFacility(
      await actor(req),
      req.params.facilityId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data, message: 'Facility updated' });
  } catch (error) {
    next(error);
  }
}

export async function listEmployees(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId =
      typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const data = await corporateService.listEmployees(await actor(req), organizationId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createEmployee(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId =
      typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const data = await corporateService.createEmployee(
      await actor(req),
      req.body,
      organizationId,
      getRequestAuditContext(req),
    );
    res.status(201).json({
      success: true,
      data,
      message: 'Employee created. A temporary password was emailed.',
    });
  } catch (error) {
    next(error);
  }
}

export async function setEmployeeStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await corporateService.setEmployeeStatus(
      await actor(req),
      req.params.userId,
      req.body.accountStatus,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data, message: 'Employee status updated' });
  } catch (error) {
    next(error);
  }
}

export async function listSubAccounts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId =
      typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const data = await corporateService.listSubAccounts(await actor(req), organizationId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createSubAccount(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await corporateService.createSubAccount(
      await actor(req),
      req.body,
      getRequestAuditContext(req),
    );
    res.status(201).json({
      success: true,
      data,
      message: 'Sub-account created. Verification email sent.',
    });
  } catch (error) {
    next(error);
  }
}

export async function insights(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId =
      typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const data = await corporateService.getCorporateInsights(await actor(req), organizationId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function audit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId =
      typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;
    const data = await corporateService.listCorporateAudit(await actor(req), {
      organizationId,
      q,
      page,
      pageSize,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function verifySubAccount(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const token =
      typeof req.body?.token === 'string'
        ? req.body.token
        : typeof req.query.token === 'string'
          ? req.query.token
          : '';
    const data = await corporateService.verifySubAccountEmail(
      token,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
