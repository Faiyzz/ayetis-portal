import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import * as authService from './auth.service';
import { getRequestAuditContext } from '../audit/audit.service';

export async function register(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await authService.registerDoctor(req.body, getRequestAuditContext(req));
    res.status(201).json({
      success: true,
      data,
      message: 'Account created successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await authService.login(req.body, getRequestAuditContext(req));
    res.json({
      success: true,
      data,
      message: 'Logged in successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await authService.logout(req.user!.id, getRequestAuditContext(req));
    res.json({
      success: true,
      data,
      message: data.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await authService.getMe(req.user!.id);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await authService.forgotPassword(req.body, getRequestAuditContext(req));
    res.json({
      success: true,
      data,
      message: data.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await authService.resetPassword(req.body, getRequestAuditContext(req));
    res.json({
      success: true,
      data,
      message: 'Password reset successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await authService.changePassword(
      req.user!.id,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: data.message,
    });
  } catch (error) {
    next(error);
  }
}
