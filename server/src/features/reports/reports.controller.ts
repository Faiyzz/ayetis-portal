import type { NextFunction, Response } from 'express';
import type { Permission } from '@ayetis/shared';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '../../utils/AppError';
import { User } from '../../models/User';
import { resolvePermissionsForUserId } from '../users/users.service';
import * as reportsService from './reports.service';

async function actor(req: AuthenticatedRequest) {
  const user = await User.findById(req.user!.id);
  if (!user || !user.isActive) throw new AppError('User not found or inactive', 401);
  return {
    id: user.id,
    permissions: (await resolvePermissionsForUserId(user.id)) as Permission[],
  };
}

function periodQuery(req: AuthenticatedRequest) {
  const month = typeof req.query.month === 'string' ? req.query.month : undefined;
  const view = req.query.view === 'quarter' ? 'quarter' as const : 'month' as const;
  return { month, view };
}

export async function dashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await reportsService.getAnalyticsDashboard(await actor(req), periodQuery(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function pipeline(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await reportsService.getPipelineReport(await actor(req), periodQuery(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function designer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await reportsService.getDesignerDeptReport(await actor(req), periodQuery(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function qc(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await reportsService.getQcDeptReport(await actor(req), periodQuery(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function consultant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await reportsService.getConsultantDeptReport(await actor(req), periodQuery(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function supervisor(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await reportsService.getSupervisorTeamReport(await actor(req), periodQuery(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function comparison(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await reportsService.getDepartmentComparison(await actor(req), periodQuery(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function exportCsv(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const report = String(req.params.report || '');
    const result = await reportsService.exportReportCsv(await actor(req), report, periodQuery(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.csv);
  } catch (error) {
    next(error);
  }
}
