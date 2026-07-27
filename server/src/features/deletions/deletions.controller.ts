import type { NextFunction, Response } from 'express';
import type { Permission } from '@ayetis/shared';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '../../utils/AppError';
import { User } from '../../models/User';
import { getRequestAuditContext } from '../audit/audit.service';
import { resolvePermissionsForUserId } from '../users/users.service';
import * as deletionsService from './deletions.service';

async function actor(req: AuthenticatedRequest) {
  const user = await User.findById(req.user!.id);
  if (!user || !user.isActive) throw new AppError('User not found or inactive', 401);
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    permissions: (await resolvePermissionsForUserId(user.id)) as Permission[],
  };
}

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await deletionsService.listDeleteRequests(await actor(req), {
      status: req.query.status ? String(req.query.status) : undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function log(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await deletionsService.listDeletedRecordsLog(await actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function review(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await deletionsService.reviewDeleteRequest(
      await actor(req),
      req.params.requestId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data, message: 'Delete request reviewed' });
  } catch (error) {
    next(error);
  }
}

export async function requestUserDelete(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await deletionsService.requestUserDelete(
      await actor(req),
      req.params.userId,
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
