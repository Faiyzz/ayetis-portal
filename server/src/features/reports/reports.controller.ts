import type { NextFunction, Response } from 'express';
import type { Permission, ReportFilterQuery } from '@ayetis/shared';
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
    role: user.role,
    roles: user.roles,
    permissions: (await resolvePermissionsForUserId(user.id)) as Permission[],
  };
}

function periodQuery(req: AuthenticatedRequest): ReportFilterQuery {
  const str = (key: string) =>
    typeof req.query[key] === 'string' ? String(req.query[key]) : undefined;
  const sla = str('sla');
  return {
    month: str('month'),
    view: req.query.view === 'quarter' ? ('quarter' as const) : ('month' as const),
    from: str('from'),
    to: str('to'),
    doctor: str('doctor'),
    customer: str('customer'),
    supervisor: str('supervisor'),
    consultant: str('consultant'),
    designer: str('designer'),
    qc: str('qc'),
    priority: str('priority'),
    status: str('status'),
    sla: sla === 'breached' || sla === 'ok' ? sla : undefined,
  };
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
    const format = String(req.query.format || 'csv');
    const a = await actor(req);
    const query = periodQuery(req);
    if (format === 'xls' || format === 'excel') {
      const result = await reportsService.exportReportExcel(a, report, query);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.xml);
      return;
    }
    if (format === 'html' || format === 'pdf') {
      const result = await reportsService.exportReportHtml(a, report, query);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
      res.send(result.html);
      return;
    }
    const result = await reportsService.exportReportCsv(a, report, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.csv);
  } catch (error) {
    next(error);
  }
}
