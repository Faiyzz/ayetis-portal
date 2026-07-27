import type { NextFunction, Response } from 'express';
import type { Permission } from '@ayetis/shared';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { getRequestAuditContext } from '../audit/audit.service';
import { resolvePermissionsForUserId } from '../users/users.service';
import { User } from '../../models/User';
import { AppError } from '../../utils/AppError';
import * as departmentsService from './departments.service';

async function actor(req: AuthenticatedRequest) {
  const user = await User.findById(req.user!.id);
  if (!user || !user.isActive) throw new AppError('User not found or inactive', 401);
  const permissions = await resolvePermissionsForUserId(user.id);
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    permissions: permissions as Permission[],
  };
}

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await departmentsService.listDepartments(await actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await departmentsService.createDepartment(
      await actor(req),
      req.body,
      getRequestAuditContext(req),
    );
    res.status(201).json({ success: true, data, message: 'Department created' });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await departmentsService.updateDepartment(
      await actor(req),
      req.params.departmentId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data, message: 'Department updated' });
  } catch (error) {
    next(error);
  }
}

export async function transfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await departmentsService.transferMember(
      await actor(req),
      req.body,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data, message: 'Member transferred' });
  } catch (error) {
    next(error);
  }
}

export async function requestDelete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await departmentsService.requestDeleteDepartment(
      await actor(req),
      req.params.departmentId,
      req.body.reason,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Delete request submitted for admin approval',
    });
  } catch (error) {
    next(error);
  }
}
