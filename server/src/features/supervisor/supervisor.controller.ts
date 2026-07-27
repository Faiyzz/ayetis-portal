import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { getRequestAuditContext } from '../audit/audit.service';
import * as casesService from '../cases/cases.service';
import * as supervisorService from './supervisor.service';

async function actor(req: AuthenticatedRequest) {
  return casesService.resolveCaseActor(req.user!.id);
}

export async function dashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await supervisorService.getSupervisorDashboard(await actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function performance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await supervisorService.getSupervisorPerformance(await actor(req), {
      month: req.query.month ? String(req.query.month) : undefined,
      view: req.query.view === 'quarter' ? 'quarter' : 'month',
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listMembers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await supervisorService.listTeamMembers(await actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function addMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await supervisorService.createTeamMember(
      await actor(req),
      req.body,
      getRequestAuditContext(req),
    );
    res.status(201).json({ success: true, data, message: 'Team member added' });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await supervisorService.deactivateTeamMember(
      await actor(req),
      req.params.userId,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data, message: 'Team member deactivated' });
  } catch (error) {
    next(error);
  }
}
