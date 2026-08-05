import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { getRequestAuditContext } from '../audit/audit.service';
import * as registrationsService from './registrations.service';

function actor(req: AuthenticatedRequest) {
  return {
    id: req.user!.id,
    email: req.user!.email,
    role: req.user!.role,
  };
}

export async function listRegistrations(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await registrationsService.listRegistrations({
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      status: req.query.status as never,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getRegistration(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await registrationsService.getRegistration(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function approveRegistration(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await registrationsService.approveRegistration(
      req.params.id,
      actor(req),
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Registration approved and account created',
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectRegistration(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await registrationsService.rejectRegistration(
      req.params.id,
      req.body.reason,
      actor(req),
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Registration rejected',
    });
  } catch (error) {
    next(error);
  }
}

export async function holdRegistration(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await registrationsService.holdRegistration(
      req.params.id,
      actor(req),
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Registration held',
    });
  } catch (error) {
    next(error);
  }
}

export async function getMessages(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await registrationsService.getMessages();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateMessages(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await registrationsService.updateMessages(req.body);
    res.json({
      success: true,
      data,
      message: 'System messages updated',
    });
  } catch (error) {
    next(error);
  }
}
