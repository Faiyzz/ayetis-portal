import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { getRequestAuditContext } from '../audit/audit.service';
import * as clarificationsService from './clarifications.service';

async function actor(req: AuthenticatedRequest) {
  return clarificationsService.resolveClarificationActor(req.user!.id);
}

export async function listForCase(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await clarificationsService.listClarificationsForCase(
      await actor(req),
      req.params.caseId,
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await clarificationsService.createClarification(
      await actor(req),
      req.params.caseId,
      req.body,
      getRequestAuditContext(req),
    );
    res.status(201).json({
      success: true,
      data,
      message: 'Clarification request created',
    });
  } catch (error) {
    next(error);
  }
}

export async function getOne(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await clarificationsService.getClarification(
      await actor(req),
      req.params.clarificationId,
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function reply(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await clarificationsService.replyToClarification(
      await actor(req),
      req.params.clarificationId,
      req.body.body,
      getRequestAuditContext(req),
    );
    res.status(201).json({
      success: true,
      data,
      message: 'Reply added',
    });
  } catch (error) {
    next(error);
  }
}

export async function resolve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await clarificationsService.resolveClarification(
      await actor(req),
      req.params.clarificationId,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Clarification resolved',
    });
  } catch (error) {
    next(error);
  }
}
