import type { NextFunction, Response } from 'express';
import type { AuditAction } from '@ayetis/shared';
import type { AuthenticatedRequest } from '../../middleware/auth';
import * as auditService from './audit.service';

export async function listActivity(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await auditService.listActivityLogs({
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      action: req.query.action ? (String(req.query.action) as AuditAction) : undefined,
      actorEmail: req.query.actorEmail ? String(req.query.actorEmail) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
