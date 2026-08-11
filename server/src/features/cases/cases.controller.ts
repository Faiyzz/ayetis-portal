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
      isDemo:
        req.query.isDemo === undefined
          ? undefined
          : String(req.query.isDemo) === 'true',
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

export async function updatePayment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.updateCasePayment(
      await actor(req),
      req.params.caseId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Payment overview updated',
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTreatmentInstructions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.updateTreatmentInstructions(
      await actor(req),
      req.params.caseId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Treatment instructions saved',
    });
  } catch (error) {
    next(error);
  }
}

export async function coordinatorDashboard(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.getCoordinatorDashboard(await actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listDesigners(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.listDesignerAssignees(await actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listDoctors(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.listDoctorAssignees(await actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function startValidation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.startCaseValidation(
      await actor(req),
      req.params.caseId,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Validation started',
    });
  } catch (error) {
    next(error);
  }
}

export async function markValidated(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.markCaseValidated(
      await actor(req),
      req.params.caseId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Case marked as validated',
    });
  } catch (error) {
    next(error);
  }
}

export async function assignCase(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.assignCase(
      await actor(req),
      req.params.caseId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message:
        req.body.mode === 'auto_queue'
          ? 'Case sent to auto pick queue'
          : 'Case assigned to designer',
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
      req.body.remarks,
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
      message: 'Delete request submitted for admin approval',
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
        path: file.path,
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

export async function attachViewerLink(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.attachCaseViewerLink(
      await actor(req),
      req.params.caseId,
      req.body,
      getRequestAuditContext(req),
    );
    res.status(201).json({
      success: true,
      data,
      message: 'Viewer link attached',
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
    const { openStoredReadStream } = await import('../../services/storage.service');
    const { stream, contentLength } = await openStoredReadStream(file.storageKey);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    );
    if (contentLength != null) res.setHeader('Content-Length', String(contentLength));
    stream.on('error', (error) => next(error));
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

export async function signedFileUrl(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.createCaseFileSignedUrl(
      await actor(req),
      req.params.caseId,
      req.params.fileId,
    );
    res.json({
      success: true,
      data,
      message: 'Signed download URL issued',
    });
  } catch (error) {
    next(error);
  }
}

export async function restoreFile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.restoreCaseFile(
      await actor(req),
      req.params.caseId,
      req.params.fileId,
    );
    res.json({
      success: true,
      data,
      message: 'File restore requested',
    });
  } catch (error) {
    next(error);
  }
}

export async function fileRestoreStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.getCaseFileRestoreStatus(
      await actor(req),
      req.params.caseId,
      req.params.fileId,
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function restoreDeliveryVideoHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.restoreDeliveryVideo(await actor(req), req.params.caseId);
    res.json({
      success: true,
      data,
      message: 'Delivery video restore requested',
    });
  } catch (error) {
    next(error);
  }
}

export async function deliveryVideoRestoreStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.getDeliveryVideoRestoreStatus(
      await actor(req),
      req.params.caseId,
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function signedDeliveryVideoUrl(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.createDeliveryVideoSignedUrl(
      await actor(req),
      req.params.caseId,
    );
    res.json({
      success: true,
      data,
      message: 'Signed delivery video URL issued',
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadAllFiles(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { ZipArchive } = await import('archiver');
    const { openStoredReadStream } = await import('../../services/storage.service');
    const pack = await casesService.getCaseFilesForZipDownload(
      await actor(req),
      req.params.caseId,
      getRequestAuditContext(req),
    );

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${pack.zipName}"`,
    );

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', (error: Error) => next(error));
    archive.pipe(res);

    for (const entry of pack.entries) {
      const { stream } = await openStoredReadStream(entry.storageKey);
      archive.append(stream, { name: entry.name });
    }

    await archive.finalize();
  } catch (error) {
    next(error);
  }
}

export async function startProduction(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.startProduction(
      await actor(req),
      req.params.caseId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Production started',
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProduction(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.updateProductionNotes(
      await actor(req),
      req.params.caseId,
      req.body.notes ?? '',
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Production status updated',
    });
  } catch (error) {
    next(error);
  }
}

export async function submitToQc(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.submitCaseToQc(
      await actor(req),
      req.params.caseId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({
      success: true,
      data,
      message: 'Case submitted to QC queue',
    });
  } catch (error) {
    next(error);
  }
}

export async function qcDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.getQcDashboard(await actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function escalatedQueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.getEscalatedCasesQueue(await actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function addQcComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.addQcComment(
      await actor(req),
      req.params.caseId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data, message: 'QC comment added' });
  } catch (error) {
    next(error);
  }
}

export async function approveQc(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const video = req.file;

    const data = await casesService.approveQcCase(
      await actor(req),
      req.params.caseId,
      {
        comments: req.body.comments,
        deliveryViewLink: req.body.deliveryViewLink,
      },
      video,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data, message: 'Case approved by QC' });
  } catch (error) {
    next(error);
  }
}

export async function rejectQc(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.rejectQcCase(
      await actor(req),
      req.params.caseId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data, message: 'Case returned to designer' });
  } catch (error) {
    next(error);
  }
}

export async function designerPerformance(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.getDesignerPerformance(await actor(req), {
      month: req.query.month ? String(req.query.month) : undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function qcPerformance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await casesService.getQcPerformance(await actor(req), {
      month: req.query.month ? String(req.query.month) : undefined,
      view: req.query.view === 'quarter' ? 'quarter' : 'month',
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function downloadDeliveryVideo(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const file = await casesService.getDeliveryVideoForDownload(
      await actor(req),
      req.params.caseId,
    );
    const { openStoredReadStream } = await import('../../services/storage.service');
    const { stream, contentLength } = await openStoredReadStream(file.storageKey);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    );
    if (contentLength != null) res.setHeader('Content-Length', String(contentLength));
    stream.on('error', (error) => next(error));
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

export async function consultantDashboard(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.getConsultantDashboard(await actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function addClinicalRemark(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.addClinicalRemark(
      await actor(req),
      req.params.caseId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data, message: 'Clinical remark added' });
  } catch (error) {
    next(error);
  }
}

export async function consultantPerformance(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.getConsultantPerformance(await actor(req), {
      month: req.query.month ? String(req.query.month) : undefined,
      view: req.query.view === 'quarter' ? 'quarter' : 'month',
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function recordDoctorView(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.recordDoctorCaseView(
      await actor(req),
      req.params.caseId,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function doctorDecision(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.submitDoctorDecision(
      await actor(req),
      req.params.caseId,
      req.body,
      getRequestAuditContext(req),
    );
    res.json({ success: true, data, message: 'Decision recorded' });
  } catch (error) {
    next(error);
  }
}

export async function doctorDeliveryQueue(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await casesService.getDoctorDeliveryQueue(await actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
