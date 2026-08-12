import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import * as authService from './auth.service';
import { getRequestAuditContext } from '../audit/audit.service';

export async function register(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await authService.register(req.body, getRequestAuditContext(req));
    res.status(201).json({
      success: true,
      data,
      message: data.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyEmail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token =
      typeof req.body?.token === 'string'
        ? req.body.token
        : typeof req.query.token === 'string'
          ? req.query.token
          : '';
    const data = await authService.verifyEmail({ token }, getRequestAuditContext(req));
    res.json({
      success: true,
      data,
      message: data.message,
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

export async function confirmPasswordReset(
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
    const data = await authService.confirmPasswordReset(
      { token },
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

export async function updatePreferences(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await authService.updatePreferences(
      req.user!.id,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Preferences updated',
    });
  } catch (error) {
    next(error);
  }
}
