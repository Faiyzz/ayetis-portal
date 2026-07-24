import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import * as authService from './auth.service';

export async function register(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await authService.registerDoctor(req.body);
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
    const data = await authService.login(req.body);
    res.json({
      success: true,
      data,
      message: 'Logged in successfully',
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
    const data = await authService.forgotPassword(req.body);
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
    const data = await authService.resetPassword(req.body);
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
    const data = await authService.changePassword(req.user!.id, req.body);
    res.json({
      success: true,
      data,
      message: data.message,
    });
  } catch (error) {
    next(error);
  }
}
