import type { NextFunction, Response } from 'express';
import type { CasePriority, CaseStatus } from '@ayetis/shared';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { getRequestAuditContext } from '../audit/audit.service';
import * as casesService from './cases.service';

async function actor(req: AuthenticatedRequest) {
  return casesService.resolveCaseActor(req.user!.id);
}

export async function listCases(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.listCases(await actor(req), {
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      status: req.query.status ? (String(req.query.status) as CaseStatus) : undefined,
      priority: req.query.priority ? (String(req.query.priority) as CasePriority) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
      includeDeleted: Boolean(req.query.includeDeleted),
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getCase(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.getCaseById(await actor(req), req.params.caseId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createCase(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.createCase(
      await actor(req),
      req.body,
      getRequestAuditContext(req),
    );
    res.status(201).json({
      success: true,
      data,
      message: `Case ${data.caseId} created`,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCase(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.updateCase(
      await actor(req),
      req.params.caseId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Case updated',
    });
  } catch (error) {
    next(error);
  }
}

export async function setPriority(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.setCasePriority(
      await actor(req),
      req.params.caseId,
      req.body.priority,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message:
        data.priority === 'urgent'
          ? 'Case marked as Urgent Priority'
          : 'Case priority updated',
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelCase(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.cancelCase(
      await actor(req),
      req.params.caseId,
      req.body.reason,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Case cancelled',
    });
  } catch (error) {
    next(error);
  }
}

export async function softDeleteCase(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.softDeleteCase(
      await actor(req),
      req.params.caseId,
      req.body.reason,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Case deleted',
    });
  } catch (error) {
    next(error);
  }
}

export async function addNote(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.addCaseNote(
      await actor(req),
      req.params.caseId,
      req.body.body,
      getRequestAuditContext(req),
    );
    res.status(201).json({
      success: true,
      data,
      message: 'Note added',
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadFiles(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const data = await casesService.uploadCaseFiles(
      await actor(req),
      req.params.caseId,
      files.map((file) => ({
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      })),
      {
        category: typeof req.body.category === 'string' ? req.body.category : undefined,
        note: typeof req.body.note === 'string' ? req.body.note : undefined,
      },
      getRequestAuditContext(req),
    );
    res.status(201).json({
      success: true,
      data,
      message: files.length === 1 ? 'File uploaded' : `${files.length} files uploaded`,
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadFile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const file = await casesService.getCaseFileForDownload(
      await actor(req),
      req.params.caseId,
      req.params.fileId,
    );
    res.download(file.absolutePath, file.originalName);
  } catch (error) {
    next(error);
  }
}
