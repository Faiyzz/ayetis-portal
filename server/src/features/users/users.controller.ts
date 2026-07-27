import type { NextFunction, Response } from 'express';
import type { Role } from '@ayetis/shared';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { getRequestAuditContext } from '../audit/audit.service';
import * as usersService from './users.service';

function actorAudit(req: AuthenticatedRequest) {
  return {
    actorId: req.user!.id,
    ...getRequestAuditContext(req),
  };
}

export async function listPermissions(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await usersService.listPermissionCatalog();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listRoles(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await usersService.listRolePermissionConfigs();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await usersService.getRolePermissionConfig(req.params.role as Role);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateRolePermissions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await usersService.updateRolePermissionConfig(
      req.params.role as Role,
      req.body,
      actorAudit(req),
    );
    res.json({
      success: true,
      data,
      message: 'Role permissions updated',
    });
  } catch (error) {
    next(error);
  }
}

export async function listUsers(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await usersService.listUsers();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await usersService.getUserById(req.params.userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await usersService.createUser(req.body, actorAudit(req));
    res.status(201).json({
      success: true,
      data,
      message: 'User created successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await usersService.updateUser(
      req.params.userId,
      req.user!.id,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'User updated successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUserPermissions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await usersService.updateUserPermissions(
      req.params.userId,
      req.body,
      actorAudit(req),
    );
    res.json({
      success: true,
      data,
      message: 'User permissions updated',
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await usersService.deleteUser(
      req.params.userId,
      req.user!.id,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'User deleted',
    });
  } catch (error) {
    next(error);
  }
}
