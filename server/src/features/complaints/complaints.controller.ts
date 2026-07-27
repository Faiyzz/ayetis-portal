import type { NextFunction, Response } from 'express';
import type { Permission } from '@ayetis/shared';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '../../utils/AppError';
import { User } from '../../models/User';
import { getRequestAuditContext } from '../audit/audit.service';
import { resolvePermissionsForUserId } from '../users/users.service';
import * as complaintsService from './complaints.service';

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
    const data = await complaintsService.listComplaints(await actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function ratings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await complaintsService.getRatingsOverview(await actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await complaintsService.createComplaint(
      await actor(req),
      req.body,
      getRequestAuditContext(req),
    );
    res.status(201).json({ success: true, data, message: 'Complaint filed' });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await complaintsService.updateComplaint(
      await actor(req),
      req.params.complaintId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data, message: 'Complaint updated' });
  } catch (error) {
    next(error);
  }
}
