import {
  ASSIGNMENT_MODES,
  AUDIT_ACTIONS,
  CASE_FIELD_LABELS,
  CASE_PRIORITIES,
  CASE_PRIORITY_LABELS,
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  CONSULTANT_INDICATORS,
  CONSULTANT_INDICATOR_LABELS,
  COORDINATOR_QUEUE_DESCRIPTIONS,
  COORDINATOR_QUEUE_LABELS,
  COORDINATOR_QUEUES,
  DELAY_LEVELS,
  DOCTOR_DECISIONS,
  DOCTOR_DECISION_LABELS,
  EMPTY_TREATMENT_INSTRUCTIONS,
  FILE_CATEGORIES,
  NOTIFICATION_TYPES,
  PAYMENT_STATUSES,
  PERMISSIONS,
  QC_ERROR_CODE_LABELS,
  QC_ESCALATION_REJECTION_THRESHOLD,
  QC_REVIEW_OUTCOMES,
  ROLES,
  ALL_COORDINATOR_QUEUES,
  ALL_DELAY_LEVELS,
  ALL_QC_ERROR_CODES,
  buildCaseTimeline,
  computeDelayLevel,
  formatHistoryValue,
  isAllowedUploadFilename,
  isFileCategory,
  labelForMonthKey,
  monthRangeUtc,
  formatDoctorDisplay,
  permissionsInclude,
  quarterRangeUtc,
  recentMonthOptions,
  resolveCoordinatorQueue,
  type Role,
  type AssignCaseInput,
  type AssignmentMode,
  type CaseDetailDto,
  type CaseHistoryChange,
  type CaseHistoryDto,
  type CaseListItemDto,
  type CaseListResult,
  type CasePriority,
  type CaseStatus,
  type CaseValidationSummary,
  type ClinicalRemarkDto,
  type ConsultantDashboardDto,
  type ConsultantIndicator,
  type ConsultantPerformanceDto,
  type ConsultantQueueCaseDto,
  type CoordinatorDashboardDto,
  type CoordinatorQueue,
  type CoordinatorQueueCaseDto,
  type CreateCaseInput,
  type DelayLevel,
  type DesignerAssigneeDto,
  type DesignerPerformanceDto,
  type DoctorDecision,
  type DoctorDeliveryQueueItemDto,
  type DoctorEngagementDto,
  type FileCategory,
  type Permission,
  type QcDashboardDto,
  type QcErrorCode,
  type QcErrorTrendItem,
  type QcPerformanceDto,
  type QcQueueCaseDto,
  type QcReviewDto,
  type RejectQcInput,
  type TreatmentInstructions,
  type UpdateCaseInput,
  type UpdateCasePaymentInput,
  type ValidateCaseInput,
  type ValidationCheckItem,
} from '@ayetis/shared';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { Case, type ICase, type IClinicalRemark, type IQcReview } from '../../models/Case';
import { generateCaseId } from '../../models/CaseCounter';
import { User } from '../../models/User';
import {
  caseDeliveredTemplate,
  caseEventTemplate,
  sendTemplatedEmail,
} from '../../services/email';
import {
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';
import {
  countOpenClarifications,
  listClarificationDtosForCase,
} from '../clarifications/clarifications.service';
import {
  createNotification,
  createNotificationsForUsers,
} from '../notifications/notifications.service';
import { resolvePermissionsForUserId } from '../users/users.service';
import {
  persistUploadedFile,
  storedFileExists,
} from '../../services/storage.service';
import {
  copyLifecycleToDelivery,
  copyLifecycleToFile,
  ensureReadableForDownload,
  initialHotFields,
  lifecycleFromDelivery,
  lifecycleFromFile,
  markCaseModified,
  startRestore,
  syncRestoreStatus,
  toLifecycleDto,
} from '../../services/fileLifecycle.service';

export interface CaseActor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: Permission[];
}

function actorName(actor: CaseActor) {
  return `${actor.firstName} ${actor.lastName}`.trim();
}

function pushHistory(
  caseDoc: ICase,
  input: {
    action: string;
    summary: string;
    actor?: CaseActor | null;
    metadata?: Record<string, unknown>;
  },
) {
  caseDoc.history.unshift({
    _id: new Types.ObjectId(),
    action: input.action,
    summary: input.summary,
    actorId: input.actor ? new Types.ObjectId(input.actor.id) : undefined,
    actorName: input.actor ? actorName(input.actor) : undefined,
    metadata: input.metadata,
    createdAt: new Date(),
  } as ICase['history'][number]);
}

function normalizeTreatmentInstructions(
  input?: Partial<TreatmentInstructions> | null,
): TreatmentInstructions {
  return {
    arches: (input?.arches as TreatmentInstructions['arches']) || '',
    applianceType: input?.applianceType?.trim() ?? '',
    treatmentGoal: input?.treatmentGoal?.trim() ?? '',
    biteDetails: input?.biteDetails?.trim() ?? '',
    retainers: input?.retainers?.trim() ?? '',
    specialRequirements: input?.specialRequirements?.trim() ?? '',
    additionalNotes: input?.additionalNotes?.trim() ?? '',
  };
}

function toPaymentDto(caseDoc: ICase) {
  const payment = caseDoc.payment ?? {
    status: PAYMENT_STATUSES.NOT_BILLED,
    currency: 'USD',
    invoiceNumber: '',
    notes: '',
  };
  return {
    status: payment.status ?? PAYMENT_STATUSES.NOT_BILLED,
    currency: payment.currency || 'USD',
    amountDue: payment.amountDue ?? null,
    amountPaid: payment.amountPaid ?? null,
    invoiceNumber: payment.invoiceNumber || '',
    notes: payment.notes || '',
    updatedAt: payment.updatedAt ? payment.updatedAt.toISOString() : null,
  };
}

async function buildValidationSummary(caseDoc: ICase): Promise<CaseValidationSummary> {
  const checks: ValidationCheckItem[] = [];

  checks.push({
    id: 'patient_name',
    label: 'Patient name provided',
    passed: Boolean(caseDoc.patientName?.trim()),
  });

  checks.push({
    id: 'treatment_summary',
    label: 'Treatment summary provided',
    passed: Boolean(caseDoc.treatmentSummary?.trim()),
  });

  const ti = caseDoc.treatmentInstructions;
  const hasStructured =
    Boolean(ti?.arches) ||
    Boolean(ti?.applianceType?.trim()) ||
    Boolean(ti?.treatmentGoal?.trim()) ||
    Boolean(ti?.specialRequirements?.trim()) ||
    Boolean(caseDoc.instructions?.trim());

  checks.push({
    id: 'treatment_instructions',
    label: 'Treatment instructions documented',
    passed: hasStructured,
    detail: hasStructured
      ? undefined
      : 'Add structured form fields or free-text instructions',
  });

  checks.push({
    id: 'files_attached',
    label: 'At least one patient file attached',
    passed: caseDoc.files.length > 0,
    detail: caseDoc.files.length === 0 ? 'Upload STL, scans, photos, or x-rays' : undefined,
  });

  let accessibleCount = 0;
  for (const file of caseDoc.files) {
    if (!file.storageKey) continue;
    if (await storedFileExists(file.storageKey)) {
      accessibleCount += 1;
    }
  }

  const filesOk = caseDoc.files.length === 0 ? false : accessibleCount === caseDoc.files.length;
  checks.push({
    id: 'files_accessible',
    label: 'Attached files are accessible',
    passed: filesOk,
    detail:
      caseDoc.files.length === 0
        ? 'No files to verify'
        : filesOk
          ? `${accessibleCount}/${caseDoc.files.length} readable`
          : `${accessibleCount}/${caseDoc.files.length} readable — some files missing on storage`,
  });

  const openClarifications = await countOpenClarifications(caseDoc._id as Types.ObjectId);
  checks.push({
    id: 'no_open_clarifications',
    label: 'No open clarifications',
    passed: openClarifications === 0,
    detail:
      openClarifications > 0
        ? `${openClarifications} clarification(s) still open`
        : undefined,
  });

  return {
    ready: checks.every((check) => check.passed),
    checks,
    validatedAt: caseDoc.validatedAt ? caseDoc.validatedAt.toISOString() : null,
    validatedByName: caseDoc.validatedByName ?? null,
  };
}

function delayHoursSince(reference: Date, now = new Date()) {
  return Math.max(0, (now.getTime() - reference.getTime()) / (1000 * 60 * 60));
}

function queueReferenceDate(caseDoc: ICase): Date {
  return caseDoc.validatedAt ?? caseDoc.updatedAt ?? caseDoc.createdAt;
}

async function toListItem(
  caseDoc: ICase,
  viewer?: { id: string; role: string },
): Promise<CaseListItemDto> {
  const openClarificationCount = await countOpenClarifications(caseDoc._id as Types.ObjectId);
  const assignmentMode = (caseDoc.assignmentMode ?? ASSIGNMENT_MODES.NONE) as AssignmentMode;
  const queue = caseDoc.isDeleted
    ? null
    : resolveCoordinatorQueue({
        status: caseDoc.status,
        validatedAt: caseDoc.validatedAt,
        assignmentMode,
        assignedDesignerId: caseDoc.assignedDesignerId
          ? String(caseDoc.assignedDesignerId)
          : null,
      });
  const ref = queueReferenceDate(caseDoc);
  const doctorDisplayId = caseDoc.doctorDisplayId ?? null;
  const doctorName = viewer
    ? formatDoctorDisplay(viewer.role as Role, viewer.id, {
        doctorUserId: String(caseDoc.doctorId),
        doctorName: caseDoc.doctorName,
        doctorId: doctorDisplayId,
      })
    : caseDoc.doctorName;

  return {
    id: caseDoc.id,
    caseId: caseDoc.caseId,
    patientName: caseDoc.patientName,
    patientAge: caseDoc.patientAge ?? null,
    doctorId: String(caseDoc.doctorId),
    doctorName,
    doctorDisplayId,
    doctorEmail: caseDoc.doctorEmail,
    status: caseDoc.status,
    priority: caseDoc.priority,
    treatmentSummary: caseDoc.treatmentSummary,
    paymentStatus: caseDoc.payment?.status ?? PAYMENT_STATUSES.NOT_BILLED,
    openClarificationCount,
    assignedDesignerId: caseDoc.assignedDesignerId
      ? String(caseDoc.assignedDesignerId)
      : null,
    assignedDesignerName: caseDoc.assignedDesignerName ?? null,
    assignmentMode,
    validatedAt: caseDoc.validatedAt ? caseDoc.validatedAt.toISOString() : null,
    consultantIndicator: caseDoc.consultantIndicator ?? null,
    queue,
    delayLevel: caseDoc.isDeleted ? null : computeDelayLevel(ref),
    isDeleted: caseDoc.isDeleted,
    createdAt: caseDoc.createdAt.toISOString(),
    updatedAt: caseDoc.updatedAt.toISOString(),
  };
}

function mapClinicalRemarks(caseDoc: ICase): ClinicalRemarkDto[] {
  return (caseDoc.clinicalRemarks ?? []).map((remark) => ({
    id: String(remark._id),
    body: remark.body,
    indicator: remark.indicator,
    authorId: String(remark.authorId),
    authorName: remark.authorName,
    createdAt: remark.createdAt.toISOString(),
  }));
}

function mapDoctorEngagement(caseDoc: ICase): DoctorEngagementDto {
  const eng = caseDoc.doctorEngagement ?? {};
  return {
    openedAt: eng.openedAt ? eng.openedAt.toISOString() : null,
    videoViewedAt: eng.videoViewedAt ? eng.videoViewedAt.toISOString() : null,
    respondedAt: eng.respondedAt ? eng.respondedAt.toISOString() : null,
    filesDownloadedAt: eng.filesDownloadedAt ? eng.filesDownloadedAt.toISOString() : null,
    lastViewedAt: eng.lastViewedAt ? eng.lastViewedAt.toISOString() : null,
    viewedWithoutActionNotifiedAt: eng.viewedWithoutActionNotifiedAt
      ? eng.viewedWithoutActionNotifiedAt.toISOString()
      : null,
  };
}

function mapQcReviews(caseDoc: ICase): QcReviewDto[] {
  return (caseDoc.qcReviews ?? []).map((review) => ({
    id: String(review._id),
    outcome: review.outcome,
    errorCode: review.errorCode ?? null,
    comments: review.comments || '',
    requiredChanges: review.requiredChanges || '',
    reviewerId: String(review.reviewerId),
    reviewerName: review.reviewerName,
    deliveryViewLink: review.deliveryViewLink ?? null,
    deliveryVideoName: review.deliveryVideoFilename ?? null,
    createdAt: review.createdAt.toISOString(),
  }));
}

function mapHistory(caseDoc: ICase): CaseHistoryDto[] {
  return caseDoc.history.map((entry) => {
    const metadata = entry.metadata ?? {};
    const rawChanges = metadata.changes;
    let changes: CaseHistoryChange[] | undefined;

    if (Array.isArray(rawChanges)) {
      changes = rawChanges as CaseHistoryChange[];
    } else if (rawChanges && typeof rawChanges === 'object') {
      changes = Object.entries(rawChanges as Record<string, unknown>).map(([field, to]) => ({
        field,
        label: CASE_FIELD_LABELS[field] ?? field,
        from: null,
        to,
      }));
    }

    return {
      id: String(entry._id),
      action: entry.action,
      summary: entry.summary,
      actorId: entry.actorId ? String(entry.actorId) : null,
      actorName: entry.actorName ?? null,
      createdAt: entry.createdAt.toISOString(),
      metadata,
      changes,
    };
  });
}

async function toDetail(
  caseDoc: ICase,
  viewer?: { id: string; role: string },
): Promise<CaseDetailDto> {
  const [listItem, clarifications, validation] = await Promise.all([
    toListItem(caseDoc, viewer),
    listClarificationDtosForCase(caseDoc._id as Types.ObjectId),
    buildValidationSummary(caseDoc),
  ]);

  return {
    ...listItem,
    clinicName: caseDoc.clinicName,
    patientGender: caseDoc.patientGender,
    instructions: caseDoc.instructions,
    country: caseDoc.country,
    treatmentInstructions: {
      ...EMPTY_TREATMENT_INSTRUCTIONS,
      ...(caseDoc.treatmentInstructions ?? {}),
    },
    payment: toPaymentDto(caseDoc),
    cancelReason: caseDoc.cancelReason ?? null,
    deletedAt: caseDoc.deletedAt ? caseDoc.deletedAt.toISOString() : null,
    deletedByName: caseDoc.deletedByName ?? null,
    deleteReason: caseDoc.deleteReason ?? null,
    validatedByName: caseDoc.validatedByName ?? null,
    validation,
    productionStartedAt: caseDoc.productionStartedAt
      ? caseDoc.productionStartedAt.toISOString()
      : null,
    productionStartedByName: caseDoc.productionStartedByName ?? null,
    submittedToQcAt: caseDoc.submittedToQcAt ? caseDoc.submittedToQcAt.toISOString() : null,
    submittedToQcByName: caseDoc.submittedToQcByName ?? null,
    productionNotes: caseDoc.productionNotes || '',
    qcRejectionCount: caseDoc.qcRejectionCount ?? 0,
    escalatedForOversight: Boolean(caseDoc.escalatedForOversight),
    escalatedAt: caseDoc.escalatedAt ? caseDoc.escalatedAt.toISOString() : null,
    lastQcErrorCode: caseDoc.lastQcErrorCode ?? null,
    lastQcComments: caseDoc.lastQcComments ?? null,
    lastQcRequiredChanges: caseDoc.lastQcRequiredChanges ?? null,
    delivery: caseDoc.delivery
      ? {
          viewLink: caseDoc.delivery.viewLink || '',
          videoFilename: caseDoc.delivery.videoFilename ?? null,
          videoStorageKey: caseDoc.delivery.videoStorageKey ?? null,
          uploadedAt: caseDoc.delivery.uploadedAt
            ? caseDoc.delivery.uploadedAt.toISOString()
            : null,
          uploadedByName: caseDoc.delivery.uploadedByName ?? null,
          ...toLifecycleDto(caseDoc.delivery, caseDoc.delivery.uploadedAt),
        }
      : null,
    qcReviews: mapQcReviews(caseDoc),
    clinicalRemarks: mapClinicalRemarks(caseDoc),
    assignedConsultantId: caseDoc.assignedConsultantId
      ? String(caseDoc.assignedConsultantId)
      : null,
    assignedConsultantName: caseDoc.assignedConsultantName ?? null,
    consultantReviewedAt: caseDoc.consultantReviewedAt
      ? caseDoc.consultantReviewedAt.toISOString()
      : null,
    doctorDecision: caseDoc.doctorDecision ?? null,
    doctorDecisionNote: caseDoc.doctorDecisionNote ?? null,
    doctorDecisionAt: caseDoc.doctorDecisionAt
      ? caseDoc.doctorDecisionAt.toISOString()
      : null,
    doctorEngagement: mapDoctorEngagement(caseDoc),
    notes: caseDoc.notes.map((note) => ({
      id: String(note._id),
      body: note.body,
      authorId: String(note.authorId),
      authorName: note.authorName,
      createdAt: note.createdAt.toISOString(),
    })),
    files: caseDoc.files.map((file) => ({
      id: String(file._id),
      filename: file.filename,
      originalName: file.originalName || file.filename,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      category: file.category || FILE_CATEGORIES.OTHER,
      storageKey: file.storageKey || '',
      uploadedById: file.uploadedById ? String(file.uploadedById) : null,
      uploadedByName: file.uploadedByName,
      version: file.version || 1,
      createdAt: file.createdAt.toISOString(),
      note: file.note,
      ...toLifecycleDto(file, file.createdAt),
    })),
    history: mapHistory(caseDoc),
    timeline: buildCaseTimeline(caseDoc.status),
    clarifications,
  };
}

function assertCanViewCase(actor: CaseActor, caseDoc: ICase) {
  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL)) return;

  if (
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_OWN) &&
    String(caseDoc.doctorId) === actor.id
  ) {
    return;
  }

  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ASSIGNED)) {
    if (caseDoc.assignedDesignerId && String(caseDoc.assignedDesignerId) === actor.id) {
      return;
    }
    if (
      caseDoc.assignmentMode === ASSIGNMENT_MODES.AUTO_QUEUE &&
      !caseDoc.assignedDesignerId &&
      !caseDoc.isDeleted &&
      (caseDoc.status === CASE_STATUSES.DESIGNER_WORKING ||
        caseDoc.status === CASE_STATUSES.UNDER_VALIDATION ||
        caseDoc.status === CASE_STATUSES.SENT_FOR_MODIFICATION)
    ) {
      return;
    }
  }

  if (
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_QC_REVIEW) &&
    !caseDoc.isDeleted &&
    (caseDoc.status === CASE_STATUSES.QC_REVIEW ||
      caseDoc.status === CASE_STATUSES.ORTHODONTIST_REVIEW ||
      caseDoc.status === CASE_STATUSES.APPROVED ||
      caseDoc.status === CASE_STATUSES.DELIVERED ||
      Boolean(caseDoc.escalatedForOversight))
  ) {
    return;
  }

  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_CONSULT) && !caseDoc.isDeleted) {
    if (Boolean(caseDoc.escalatedForOversight)) return;
    if (caseDoc.assignedConsultantId && String(caseDoc.assignedConsultantId) === actor.id) {
      return;
    }
    if (caseDoc.status === CASE_STATUSES.ORTHODONTIST_REVIEW) return;
    if ((caseDoc.clinicalRemarks?.length ?? 0) > 0) return;
  }

  throw new AppError('You do not have permission to view this case', 403);
}

function assertCanUploadFiles(actor: CaseActor, caseDoc: ICase) {
  assertCanViewCase(actor, caseDoc);

  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_UPDATE)) return;

  if (
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_CREATE) &&
    String(caseDoc.doctorId) === actor.id
  ) {
    return;
  }

  throw new AppError('You do not have permission to upload files to this case', 403);
}

function buildVisibilityFilter(actor: CaseActor): Record<string, unknown> {
  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL)) {
    return {};
  }

  const clauses: Record<string, unknown>[] = [];

  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_OWN)) {
    clauses.push({ doctorId: new Types.ObjectId(actor.id) });
  }

  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ASSIGNED)) {
    clauses.push({ assignedDesignerId: new Types.ObjectId(actor.id) });
    // Auto pick queue is visible to designers until claimed.
    clauses.push({
      assignmentMode: ASSIGNMENT_MODES.AUTO_QUEUE,
      $or: [{ assignedDesignerId: { $exists: false } }, { assignedDesignerId: null }],
      status: {
        $in: [
          CASE_STATUSES.DESIGNER_WORKING,
          CASE_STATUSES.UNDER_VALIDATION,
          CASE_STATUSES.SENT_FOR_MODIFICATION,
        ],
      },
      isDeleted: false,
    });
  }

  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_QC_REVIEW)) {
    clauses.push({
      status: {
        $in: [
          CASE_STATUSES.QC_REVIEW,
          CASE_STATUSES.ORTHODONTIST_REVIEW,
          CASE_STATUSES.APPROVED,
          CASE_STATUSES.DELIVERED,
        ],
      },
      isDeleted: false,
    });
    clauses.push({ escalatedForOversight: true, isDeleted: false });
  }

  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_CONSULT)) {
    clauses.push({ escalatedForOversight: true, isDeleted: false });
    clauses.push({ assignedConsultantId: new Types.ObjectId(actor.id) });
    clauses.push({
      status: CASE_STATUSES.ORTHODONTIST_REVIEW,
      isDeleted: false,
    });
    clauses.push({
      'clinicalRemarks.0': { $exists: true },
      isDeleted: false,
    });
  }

  if (clauses.length === 0) {
    throw new AppError('You do not have permission to list cases', 403);
  }

  return clauses.length === 1 ? clauses[0]! : { $or: clauses };
}

function normalizeFieldValue(key: string, value: unknown): unknown {
  if (typeof value === 'string') return value.trim();
  return value;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function detectCategory(originalName: string, mimeType: string, explicit?: string): FileCategory {
  if (explicit && isFileCategory(explicit)) return explicit;

  const lower = originalName.toLowerCase();
  if (lower.endsWith('.stl') || mimeType.includes('sla') || mimeType.includes('stl')) {
    return FILE_CATEGORIES.STL;
  }
  if (lower.endsWith('.obj') || lower.endsWith('.ply') || mimeType.includes('model')) {
    return FILE_CATEGORIES.MODEL;
  }
  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') {
    return FILE_CATEGORIES.PDF;
  }
  if (
    mimeType.startsWith('video/') ||
    /\.(mp4|mov|webm|avi|mkv)$/i.test(lower)
  ) {
    return FILE_CATEGORIES.VIDEO;
  }
  if (
    lower.endsWith('.dcm') ||
    lower.endsWith('.dicom') ||
    lower.includes('scan') ||
    mimeType.includes('dicom')
  ) {
    return FILE_CATEGORIES.SCAN;
  }
  if (
    mimeType.startsWith('image/') ||
    /\.(jpe?g|png|gif|webp|heic|bmp|tiff?)$/i.test(lower)
  ) {
    if (/x[-_]?ray|radiograph|opg|cbct/i.test(lower)) return FILE_CATEGORIES.XRAY;
    return FILE_CATEGORIES.PHOTO;
  }
  if (/x[-_]?ray|radiograph|opg|cbct/i.test(lower)) return FILE_CATEGORIES.XRAY;
  return FILE_CATEGORIES.OTHER;
}

export async function listCases(
  actor: CaseActor,
  query: {
    page?: number;
    pageSize?: number;
    status?: CaseStatus;
    priority?: CasePriority;
    q?: string;
    includeDeleted?: boolean;
  },
): Promise<CaseListResult> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const visibility = buildVisibilityFilter(actor);
  const conditions: Record<string, unknown>[] = [visibility];

  if (!query.includeDeleted || !permissionsInclude(actor.permissions, PERMISSIONS.CASE_DELETE)) {
    conditions.push({ isDeleted: false });
  }

  if (query.status) conditions.push({ status: query.status });
  if (query.priority) conditions.push({ priority: query.priority });

  if (query.q?.trim()) {
    const term = query.q.trim();
    conditions.push({
      $or: [
        { caseId: { $regex: term, $options: 'i' } },
        { patientName: { $regex: term, $options: 'i' } },
        { doctorName: { $regex: term, $options: 'i' } },
        { doctorDisplayId: { $regex: term, $options: 'i' } },
        { doctorEmail: { $regex: term, $options: 'i' } },
        { treatmentSummary: { $regex: term, $options: 'i' } },
        { clinicName: { $regex: term, $options: 'i' } },
      ],
    });
  }

  const filter = conditions.length === 1 ? conditions[0]! : { $and: conditions };

  const [items, total] = await Promise.all([
    Case.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Case.countDocuments(filter),
  ]);

  return {
    items: await Promise.all(items.map((item) => toListItem(item, actor))),
    total,
    page,
    pageSize,
  };
}

export async function getCaseById(actor: CaseActor, caseIdOrMongoId: string) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (
    caseDoc.isDeleted &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_DELETE)
  ) {
    throw new AppError('Case not found', 404);
  }

  return await toDetail(caseDoc, actor);
}

async function findCase(caseIdOrMongoId: string) {
  const filter = Types.ObjectId.isValid(caseIdOrMongoId)
    ? { $or: [{ _id: caseIdOrMongoId }, { caseId: caseIdOrMongoId }] }
    : { caseId: caseIdOrMongoId };

  const caseDoc = await Case.findOne(filter);
  if (!caseDoc) {
    throw new AppError('Case not found', 404);
  }
  return caseDoc;
}

export async function createCase(
  actor: CaseActor,
  input: CreateCaseInput,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_CREATE)) {
    throw new AppError('You do not have permission to create cases', 403);
  }

  const { assertCanSubmitWork } = await import('../users/users.service');
  await assertCanSubmitWork(actor.id);

  let doctor;
  if (input.doctorId) {
    if (actor.role === ROLES.DOCTOR && input.doctorId !== actor.id) {
      throw new AppError('Doctors can only create cases for themselves', 403);
    }
    doctor = await User.findById(input.doctorId);
    if (!doctor || doctor.accountStatus !== 'active' || doctor.role !== ROLES.DOCTOR) {
      throw new AppError('Select a valid active doctor account', 400);
    }
  } else if (actor.role === ROLES.DOCTOR) {
    doctor = await User.findById(actor.id);
    if (!doctor || doctor.accountStatus !== 'active') {
      throw new AppError('Doctor account not found', 404);
    }
  } else {
    throw new AppError('Select the treating doctor for this case', 400);
  }

  let priority = input.priority ?? CASE_PRIORITIES.NORMAL;
  if (
    priority === CASE_PRIORITIES.URGENT &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_SET_PRIORITY)
  ) {
    priority = CASE_PRIORITIES.NORMAL;
  }

  const caseId = await generateCaseId();
  const caseDoc = new Case({
    caseId,
    doctorId: doctor._id,
    doctorName: `${doctor.firstName} ${doctor.lastName}`.trim(),
    doctorDisplayId: doctor.doctorId,
    doctorEmail: doctor.email,
    patientName: input.patientName.trim(),
    patientAge: input.patientAge ?? undefined,
    patientGender: input.patientGender?.trim() ?? '',
    clinicName: input.clinicName?.trim() ?? '',
    country: input.country?.trim() ?? '',
    treatmentSummary: input.treatmentSummary.trim(),
    instructions: input.instructions?.trim() ?? '',
    treatmentInstructions: normalizeTreatmentInstructions(input.treatmentInstructions),
    payment: {
      status: PAYMENT_STATUSES.NOT_BILLED,
      currency: 'USD',
      invoiceNumber: '',
      notes: '',
    },
    assignmentMode: ASSIGNMENT_MODES.NONE,
    status: CASE_STATUSES.SUBMITTED,
    priority,
    notes: [],
    files: [],
    history: [],
  });

  pushHistory(caseDoc, {
    action: 'created',
    summary: `Case ${caseId} submitted`,
    actor,
    metadata: {
      changes: [
        {
          field: 'status',
          label: CASE_FIELD_LABELS.status,
          from: null,
          to: CASE_STATUSES.SUBMITTED,
        },
      ] satisfies CaseHistoryChange[],
    },
  });

  if (input.initialNote?.trim()) {
    caseDoc.notes.push({
      _id: new Types.ObjectId(),
      body: input.initialNote.trim(),
      authorId: new Types.ObjectId(actor.id),
      authorName: actorName(actor),
      createdAt: new Date(),
    } as ICase['notes'][number]);

    pushHistory(caseDoc, {
      action: 'note_added',
      summary: 'Initial case note added',
      actor,
    });
  }

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_CREATE,
    summary: `${actor.email} created case ${caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseId,
    metadata: { mongoId: caseDoc.id, patientName: caseDoc.patientName },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  const intakeStaffIds = await findUserIdsByRoles([
    ROLES.COORDINATOR,
    ROLES.SUPERVISOR,
    ROLES.ADMIN,
  ]);
  await createNotificationsForUsers(intakeStaffIds, {
    type: NOTIFICATION_TYPES.CASE_SUBMITTED,
    title: `New case submitted: ${caseId}`,
    body: `${caseDoc.doctorName} submitted ${caseDoc.patientName} for review.`,
    link: `/app/cases/${caseId}`,
    caseId,
  });
  await emailUsers(intakeStaffIds, {
    subject: `New case submitted: ${caseId}`,
    headline: 'New case submitted',
    message: `${caseDoc.doctorName} submitted a new case for ${caseDoc.patientName}.`,
    caseId,
    patientName: caseDoc.patientName,
  });

  return await toDetail(caseDoc, actor);
}

export async function updateCase(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: UpdateCaseInput,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_UPDATE)) {
    throw new AppError('You do not have permission to edit cases', 403);
  }

  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (caseDoc.isDeleted) {
    throw new AppError('Cannot edit a deleted case', 400);
  }

  if (
    input.priority !== undefined &&
    input.priority !== caseDoc.priority &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_SET_PRIORITY)
  ) {
    throw new AppError('You do not have permission to change case priority', 403);
  }

  const changes: CaseHistoryChange[] = [];
  const assignable: Array<keyof UpdateCaseInput> = [
    'patientName',
    'patientAge',
    'patientGender',
    'clinicName',
    'country',
    'treatmentSummary',
    'instructions',
    'priority',
    'status',
  ];

  for (const key of assignable) {
    if (input[key] === undefined) continue;

    const previous = (caseDoc as unknown as Record<string, unknown>)[key];
    const next = normalizeFieldValue(key, input[key]);

    if (valuesEqual(previous ?? null, next ?? null)) continue;

    (caseDoc as unknown as Record<string, unknown>)[key] = next === null ? undefined : next;

    changes.push({
      field: key,
      label: CASE_FIELD_LABELS[key] ?? key,
      from: previous ?? null,
      to: next ?? null,
    });
  }

  if (input.treatmentInstructions) {
    const previous = normalizeTreatmentInstructions(caseDoc.treatmentInstructions);
    const next = normalizeTreatmentInstructions({
      ...previous,
      ...input.treatmentInstructions,
    });
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      caseDoc.treatmentInstructions = next;
      changes.push({
        field: 'treatmentInstructions',
        label: 'Treatment instructions',
        from: previous,
        to: next,
      });
    }
  }

  if (changes.length === 0) {
    throw new AppError('No changes provided', 400);
  }

  const statusChange = changes.find((c) => c.field === 'status');
  const priorityChange = changes.find((c) => c.field === 'priority');

  if (statusChange) {
    pushHistory(caseDoc, {
      action: 'status_changed',
      summary: `Status changed to ${formatHistoryValue('status', statusChange.to)}`,
      actor,
      metadata: { changes: [statusChange] },
    });
  }

  if (priorityChange) {
    pushHistory(caseDoc, {
      action: 'priority_changed',
      summary: `Priority set to ${formatHistoryValue('priority', priorityChange.to)}`,
      actor,
      metadata: { changes: [priorityChange] },
    });
  }

  const otherChanges = changes.filter((c) => c.field !== 'status' && c.field !== 'priority');
  if (otherChanges.length > 0) {
    pushHistory(caseDoc, {
      action: 'updated',
      summary:
        otherChanges.length === 1
          ? `Updated ${otherChanges[0]!.label}`
          : `Updated ${otherChanges.length} fields`,
      actor,
      metadata: { changes: otherChanges },
    });
  }

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_UPDATE,
    summary: `${actor.email} updated case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { changes },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return await toDetail(caseDoc, actor);
}

export async function setCasePriority(
  actor: CaseActor,
  caseIdOrMongoId: string,
  priority: CasePriority,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_SET_PRIORITY)) {
    throw new AppError('You do not have permission to set case priority', 403);
  }

  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (caseDoc.isDeleted) {
    throw new AppError('Cannot change priority on a deleted case', 400);
  }

  if (caseDoc.priority === priority) {
    return toDetail(caseDoc, actor);
  }

  const from = caseDoc.priority;
  caseDoc.priority = priority;

  const change: CaseHistoryChange = {
    field: 'priority',
    label: CASE_FIELD_LABELS.priority,
    from,
    to: priority,
  };

  pushHistory(caseDoc, {
    action: 'priority_changed',
    summary:
      priority === CASE_PRIORITIES.URGENT
        ? 'Marked as Urgent Priority'
        : `Priority set to ${CASE_PRIORITY_LABELS[priority]}`,
    actor,
    metadata: { changes: [change] },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_PRIORITY_SET,
    summary: `${actor.email} set priority of case ${caseDoc.caseId} to ${priority}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { from, to: priority },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return await toDetail(caseDoc, actor);
}

export async function cancelCase(
  actor: CaseActor,
  caseIdOrMongoId: string,
  reason: string,
  audit?: RequestAuditContext,
) {
  const canCancel =
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_DELETE) ||
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_UPDATE);

  if (!canCancel) {
    throw new AppError('You do not have permission to cancel cases', 403);
  }

  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (caseDoc.isDeleted) {
    throw new AppError('Cannot cancel a deleted case', 400);
  }

  if (caseDoc.status === CASE_STATUSES.CANCELLED) {
    throw new AppError('Case is already cancelled', 400);
  }

  const from = caseDoc.status;
  caseDoc.status = CASE_STATUSES.CANCELLED;
  caseDoc.cancelReason = reason.trim();

  pushHistory(caseDoc, {
    action: 'cancelled',
    summary: `Case cancelled: ${reason.trim()}`,
    actor,
    metadata: {
      changes: [
        {
          field: 'status',
          label: CASE_FIELD_LABELS.status,
          from,
          to: CASE_STATUSES.CANCELLED,
        },
      ] satisfies CaseHistoryChange[],
      reason: reason.trim(),
    },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_CANCEL,
    summary: `${actor.email} cancelled case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { reason: reason.trim() },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return await toDetail(caseDoc, actor);
}

export async function softDeleteCase(
  actor: CaseActor,
  caseIdOrMongoId: string,
  reason: string,
  audit?: RequestAuditContext,
) {
  // Deletion requires admin approval — create a pending delete request.
  const { requestCaseDelete } = await import('../deletions/deletions.service');
  const request = await requestCaseDelete(actor, caseIdOrMongoId, reason, audit);
  return {
    pendingApproval: true as const,
    request,
    message: 'Delete request submitted for admin approval',
  };
}

/** Called after admin approves a delete request — keep for internal use. */
export async function executeSoftDeleteCase(
  actor: CaseActor,
  caseIdOrMongoId: string,
  reason: string,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_DELETE)) {
    throw new AppError('You do not have permission to delete cases', 403);
  }

  const caseDoc = await findCase(caseIdOrMongoId);

  if (caseDoc.isDeleted) {
    throw new AppError('Case is already deleted', 400);
  }

  caseDoc.isDeleted = true;
  caseDoc.deletedAt = new Date();
  caseDoc.deletedById = new Types.ObjectId(actor.id);
  caseDoc.deletedByName = actorName(actor);
  caseDoc.deleteReason = reason.trim();

  if (caseDoc.status !== CASE_STATUSES.CANCELLED) {
    caseDoc.status = CASE_STATUSES.CANCELLED;
    caseDoc.cancelReason = caseDoc.cancelReason || reason.trim();
  }

  pushHistory(caseDoc, {
    action: 'deleted',
    summary: `Case soft-deleted: ${reason.trim()}`,
    actor,
    metadata: { reason: reason.trim() },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_DELETE,
    summary: `${actor.email} deleted case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { reason: reason.trim() },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return await toDetail(caseDoc, actor);
}

export async function addCaseNote(
  actor: CaseActor,
  caseIdOrMongoId: string,
  body: string,
  audit?: RequestAuditContext,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (caseDoc.isDeleted) {
    throw new AppError('Cannot add notes to a deleted case', 400);
  }

  const trimmed = body.trim();
  if (!trimmed) {
    throw new AppError('Note cannot be empty', 400);
  }

  caseDoc.notes.unshift({
    _id: new Types.ObjectId(),
    body: trimmed,
    authorId: new Types.ObjectId(actor.id),
    authorName: actorName(actor),
    createdAt: new Date(),
  } as ICase['notes'][number]);

  pushHistory(caseDoc, {
    action: 'note_added',
    summary: 'Case note added',
    actor,
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_NOTE_ADD,
    summary: `${actor.email} added a note on case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return await toDetail(caseDoc, actor);
}

export async function uploadCaseFiles(
  actor: CaseActor,
  caseIdOrMongoId: string,
  files: Array<{
    originalname: string;
    mimetype: string;
    size: number;
    buffer?: Buffer;
    path?: string;
  }>,
  options: { category?: string; note?: string } = {},
  audit?: RequestAuditContext,
) {
  if (!files.length) {
    throw new AppError('At least one file is required', 400);
  }

  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanUploadFiles(actor, caseDoc);

  if (caseDoc.isDeleted) {
    throw new AppError('Cannot upload files to a deleted case', 400);
  }

  const uploadedNames: string[] = [];

  for (const file of files) {
    if (!isAllowedUploadFilename(file.originalname) && !file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
      throw new AppError(
        `Unsupported file type: ${file.originalname}. Allowed: STL, OBJ, images, PDF, video, DICOM, ZIP, HTML.`,
        400,
      );
    }

    const category = detectCategory(file.originalname, file.mimetype, options.category);
    const { storageKey } = await persistUploadedFile({
      caseId: caseDoc.caseId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      tempPath: file.path,
    });

    const sameNameCount = caseDoc.files.filter(
      (existing) => existing.originalName === file.originalname,
    ).length;

    const createdAt = new Date();
    const hot = initialHotFields(createdAt);
    caseDoc.files.unshift({
      _id: new Types.ObjectId(),
      filename: file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'),
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      sizeBytes: file.size,
      category,
      storageKey,
      uploadedById: new Types.ObjectId(actor.id),
      uploadedByName: actorName(actor),
      version: sameNameCount + 1,
      note: options.note?.trim() || undefined,
      createdAt,
      storageTier: hot.storageTier,
      restoreStatus: hot.restoreStatus,
      hotUntil: hot.hotUntil,
    } as ICase['files'][number]);

    uploadedNames.push(file.originalname);
  }

  pushHistory(caseDoc, {
    action: 'file_uploaded',
    summary:
      uploadedNames.length === 1
        ? `Uploaded file: ${uploadedNames[0]}`
        : `Uploaded ${uploadedNames.length} files`,
    actor,
    metadata: {
      files: uploadedNames,
      category: options.category,
    },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_FILE_UPLOAD,
    summary: `${actor.email} uploaded ${uploadedNames.length} file(s) to case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { files: uploadedNames },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return await toDetail(caseDoc, actor);
}

export async function getCaseFileForDownload(
  actor: CaseActor,
  caseIdOrMongoId: string,
  fileId: string,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (
    caseDoc.isDeleted &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_DELETE)
  ) {
    throw new AppError('Case not found', 404);
  }

  const file = caseDoc.files.find((item) => String(item._id) === fileId);
  if (!file || !file.storageKey) {
    throw new AppError('File not found', 404);
  }

  const fields = lifecycleFromFile(file);
  try {
    await ensureReadableForDownload(fields, file.storageKey);
  } catch (err) {
    copyLifecycleToFile(file, fields);
    markCaseModified(caseDoc);
    await caseDoc.save();
    throw err;
  }
  copyLifecycleToFile(file, fields);
  markCaseModified(caseDoc);
  await caseDoc.save();

  if (fields.storageTier === 'purged') {
    throw new AppError('File has been removed from cold storage', 410);
  }

  if (!(await storedFileExists(file.storageKey))) {
    throw new AppError('File is missing from storage', 404);
  }

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_FILES_DOWNLOAD,
    summary: `${actor.email} downloaded ${file.originalName || file.filename} from case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { fileId, storageKey: file.storageKey },
  }).catch(() => undefined);

  return {
    storageKey: file.storageKey,
    originalName: file.originalName || file.filename,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
  };
}

export async function createCaseFileSignedUrl(
  actor: CaseActor,
  caseIdOrMongoId: string,
  fileId: string,
) {
  const file = await getCaseFileForDownload(actor, caseIdOrMongoId, fileId);
  const { createSignedFileAccess } = await import('../../services/storage.service');
  return createSignedFileAccess({
    storageKey: file.storageKey,
    originalName: file.originalName,
    mimeType: file.mimeType,
  });
}

export async function createDeliveryVideoSignedUrl(
  actor: CaseActor,
  caseIdOrMongoId: string,
) {
  const file = await getDeliveryVideoForDownload(actor, caseIdOrMongoId);
  const { createSignedFileAccess } = await import('../../services/storage.service');
  return createSignedFileAccess({
    storageKey: file.storageKey,
    originalName: file.originalName,
    mimeType: file.mimeType,
  });
}

export async function getDeliveryVideoForDownload(
  actor: CaseActor,
  caseIdOrMongoId: string,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  const key = caseDoc.delivery?.videoStorageKey;
  if (!key || !caseDoc.delivery) throw new AppError('Delivery video not found', 404);

  const fields = lifecycleFromDelivery(caseDoc.delivery);
  try {
    await ensureReadableForDownload(fields, key);
  } catch (err) {
    copyLifecycleToDelivery(caseDoc.delivery, fields);
    markCaseModified(caseDoc);
    await caseDoc.save();
    throw err;
  }
  copyLifecycleToDelivery(caseDoc.delivery, fields);
  markCaseModified(caseDoc);

  if (
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_OWN) &&
    String(caseDoc.doctorId) === actor.id
  ) {
    if (!caseDoc.doctorEngagement) caseDoc.doctorEngagement = {};
    const now = new Date();
    if (!caseDoc.doctorEngagement.videoViewedAt) {
      caseDoc.doctorEngagement.videoViewedAt = now;
    }
    caseDoc.doctorEngagement.lastViewedAt = now;
  }

  await caseDoc.save();

  return {
    storageKey: key,
    originalName: caseDoc.delivery?.videoFilename || 'delivery-video',
    mimeType: 'video/mp4',
  };
}

export async function getCaseFilesForZipDownload(
  actor: CaseActor,
  caseIdOrMongoId: string,
  audit?: RequestAuditContext,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (
    caseDoc.isDeleted &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_DELETE)
  ) {
    throw new AppError('Case not found', 404);
  }

  if (caseDoc.files.length === 0) {
    throw new AppError('This case has no files to download', 404);
  }

  const entries: Array<{ storageKey: string; name: string }> = [];
  const usedNames = new Set<string>();
  const pending: Array<{ fileId: string; name: string }> = [];
  let dirty = false;

  for (const file of caseDoc.files) {
    if (!file.storageKey) continue;
    if (file.storageTier === 'purged') continue;
    const fields = lifecycleFromFile(file);
    try {
      await ensureReadableForDownload(fields, file.storageKey);
      copyLifecycleToFile(file, fields);
      dirty = true;
    } catch (err) {
      copyLifecycleToFile(file, fields);
      dirty = true;
      if (err instanceof AppError && err.code === 'FILE_RESTORE_PENDING') {
        pending.push({
          fileId: String(file._id),
          name: file.originalName || file.filename,
        });
        continue;
      }
      throw err;
    }
    if (!(await storedFileExists(file.storageKey))) continue;
    let name = file.originalName || file.filename || 'file';
    if (usedNames.has(name)) {
      const extIndex = name.lastIndexOf('.');
      const base = extIndex > 0 ? name.slice(0, extIndex) : name;
      const ext = extIndex > 0 ? name.slice(extIndex) : '';
      name = `${base}-v${file.version || 1}${ext}`;
    }
    usedNames.add(name);
    entries.push({ storageKey: file.storageKey, name });
  }

  if (dirty) {
    markCaseModified(caseDoc);
    await caseDoc.save();
  }

  if (pending.length > 0) {
    throw new AppError(
      `${pending.length} file(s) are in cold storage and must be restored before downloading all.`,
      409,
      { pending },
      'FILE_RESTORE_PENDING',
    );
  }

  if (entries.length === 0) {
    throw new AppError('No accessible files found on storage', 404);
  }

  if (
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_OWN) &&
    String(caseDoc.doctorId) === actor.id &&
    (caseDoc.status === CASE_STATUSES.DELIVERED ||
      caseDoc.status === CASE_STATUSES.APPROVED ||
      caseDoc.status === CASE_STATUSES.COMPLETED)
  ) {
    if (!caseDoc.doctorEngagement) caseDoc.doctorEngagement = {};
    caseDoc.doctorEngagement.filesDownloadedAt = new Date();
    await caseDoc.save();
  }

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_FILES_DOWNLOAD,
    summary: `${actor.email} downloaded all files from case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { count: entries.length },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  }).catch(() => undefined);

  return { caseId: caseDoc.caseId, zipName: `${caseDoc.caseId}-files.zip`, entries };
}

export async function restoreCaseFile(
  actor: CaseActor,
  caseIdOrMongoId: string,
  fileId: string,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);
  const file = caseDoc.files.find((item) => String(item._id) === fileId);
  if (!file?.storageKey) throw new AppError('File not found', 404);

  const fields = lifecycleFromFile(file);
  await startRestore(fields, file.storageKey);
  copyLifecycleToFile(file, fields);
  markCaseModified(caseDoc);
  await caseDoc.save();
  return await toDetail(caseDoc, actor);
}

export async function getCaseFileRestoreStatus(
  actor: CaseActor,
  caseIdOrMongoId: string,
  fileId: string,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);
  const file = caseDoc.files.find((item) => String(item._id) === fileId);
  if (!file?.storageKey) throw new AppError('File not found', 404);

  const fields = lifecycleFromFile(file);
  await syncRestoreStatus(fields, file.storageKey);
  if (
    fields.storageTier !== file.storageTier ||
    fields.restoreStatus !== file.restoreStatus ||
    fields.hotUntil?.getTime() !== file.hotUntil?.getTime()
  ) {
    copyLifecycleToFile(file, fields);
    markCaseModified(caseDoc);
    await caseDoc.save();
  }
  return {
    fileId,
    ...toLifecycleDto(fields, file.createdAt),
  };
}

export async function restoreDeliveryVideo(actor: CaseActor, caseIdOrMongoId: string) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);
  if (!caseDoc.delivery?.videoStorageKey) {
    throw new AppError('Delivery video not found', 404);
  }
  const fields = lifecycleFromDelivery(caseDoc.delivery);
  await startRestore(fields, caseDoc.delivery.videoStorageKey);
  copyLifecycleToDelivery(caseDoc.delivery, fields);
  markCaseModified(caseDoc);
  await caseDoc.save();
  return await toDetail(caseDoc, actor);
}

export async function getDeliveryVideoRestoreStatus(
  actor: CaseActor,
  caseIdOrMongoId: string,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);
  if (!caseDoc.delivery?.videoStorageKey) {
    throw new AppError('Delivery video not found', 404);
  }
  const fields = lifecycleFromDelivery(caseDoc.delivery);
  await syncRestoreStatus(fields, caseDoc.delivery.videoStorageKey);
  if (
    fields.storageTier !== caseDoc.delivery.storageTier ||
    fields.restoreStatus !== caseDoc.delivery.restoreStatus
  ) {
    copyLifecycleToDelivery(caseDoc.delivery, fields);
    markCaseModified(caseDoc);
    await caseDoc.save();
  }
  return toLifecycleDto(fields, caseDoc.delivery.uploadedAt);
}

function assertCanDesignCase(actor: CaseActor, caseDoc: ICase) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_DESIGN)) {
    throw new AppError('You do not have permission to update production on this case', 403);
  }

  assertCanViewCase(actor, caseDoc);

  const isAssignee =
    caseDoc.assignedDesignerId && String(caseDoc.assignedDesignerId) === actor.id;
  const isAutoQueue =
    caseDoc.assignmentMode === ASSIGNMENT_MODES.AUTO_QUEUE && !caseDoc.assignedDesignerId;
  const canOverride = permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL);

  if (!isAssignee && !isAutoQueue && !canOverride) {
    throw new AppError('Only the assigned designer can update production on this case', 403);
  }
}

export async function startProduction(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: { notes?: string } = {},
  audit?: RequestAuditContext,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanDesignCase(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot start production on a deleted case', 400);
  if (caseDoc.status === CASE_STATUSES.CANCELLED) {
    throw new AppError('Cannot start production on a cancelled case', 400);
  }
  if (caseDoc.status === CASE_STATUSES.WAITING_CLARIFICATION) {
    throw new AppError('Resolve clarifications before starting production', 400);
  }
  if (caseDoc.status === CASE_STATUSES.QC_REVIEW) {
    throw new AppError('Case is already in the QC queue', 400);
  }
  if (
    caseDoc.status === CASE_STATUSES.APPROVED ||
    caseDoc.status === CASE_STATUSES.DELIVERED ||
    caseDoc.status === CASE_STATUSES.COMPLETED
  ) {
    throw new AppError('Case has already passed QC', 400);
  }

  if (caseDoc.status !== CASE_STATUSES.SENT_FOR_MODIFICATION) {
    caseDoc.status = CASE_STATUSES.DESIGNER_WORKING;
  }
  caseDoc.productionStartedAt = new Date();
  caseDoc.productionStartedById = new Types.ObjectId(actor.id);
  caseDoc.productionStartedByName = actorName(actor);
  if (input.notes?.trim()) {
    caseDoc.productionNotes = input.notes.trim();
  }

  // If auto-queue and unassigned, claim for this designer when they start.
  if (
    caseDoc.assignmentMode === ASSIGNMENT_MODES.AUTO_QUEUE &&
    !caseDoc.assignedDesignerId
  ) {
    caseDoc.assignmentMode = ASSIGNMENT_MODES.DESIGNER;
    caseDoc.assignedDesignerId = new Types.ObjectId(actor.id);
    caseDoc.assignedDesignerName = actorName(actor);
  }

  pushHistory(caseDoc, {
    action: 'production_started',
    summary: 'Designer marked case as in production',
    actor,
    metadata: { notes: input.notes?.trim() || undefined },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_PRODUCTION_START,
    summary: `${actor.email} started production on case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return await toDetail(caseDoc, actor);
}

export async function updateProductionNotes(
  actor: CaseActor,
  caseIdOrMongoId: string,
  notes: string,
  audit?: RequestAuditContext,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanDesignCase(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot update a deleted case', 400);

  caseDoc.productionNotes = notes.trim();
  if (!caseDoc.productionStartedAt) {
    caseDoc.productionStartedAt = new Date();
    caseDoc.productionStartedById = new Types.ObjectId(actor.id);
    caseDoc.productionStartedByName = actorName(actor);
  }
  if (
    caseDoc.status !== CASE_STATUSES.QC_REVIEW &&
    caseDoc.status !== CASE_STATUSES.SENT_FOR_MODIFICATION
  ) {
    caseDoc.status = CASE_STATUSES.DESIGNER_WORKING;
  }

  pushHistory(caseDoc, {
    action: 'production_updated',
    summary: 'Production notes updated',
    actor,
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_UPDATE,
    summary: `${actor.email} updated production notes on case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return await toDetail(caseDoc, actor);
}

export async function submitCaseToQc(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: { notes?: string } = {},
  audit?: RequestAuditContext,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanDesignCase(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot submit a deleted case', 400);
  if (caseDoc.status === CASE_STATUSES.CANCELLED) {
    throw new AppError('Cannot submit a cancelled case', 400);
  }
  if (caseDoc.status === CASE_STATUSES.WAITING_CLARIFICATION) {
    throw new AppError('Resolve clarifications before submitting to QC', 400);
  }
  if (caseDoc.status === CASE_STATUSES.QC_REVIEW) {
    return await toDetail(caseDoc, actor);
  }
  if (
    caseDoc.status === CASE_STATUSES.APPROVED ||
    caseDoc.status === CASE_STATUSES.DELIVERED ||
    caseDoc.status === CASE_STATUSES.COMPLETED
  ) {
    throw new AppError('Case has already passed QC', 400);
  }

  if (input.notes?.trim()) {
    caseDoc.productionNotes = input.notes.trim();
  }

  const isResubmit =
    caseDoc.status === CASE_STATUSES.SENT_FOR_MODIFICATION ||
    (caseDoc.qcRejectionCount ?? 0) > 0;

  caseDoc.status = CASE_STATUSES.QC_REVIEW;
  caseDoc.submittedToQcAt = new Date();
  caseDoc.submittedToQcById = new Types.ObjectId(actor.id);
  caseDoc.submittedToQcByName = actorName(actor);

  if (!caseDoc.productionStartedAt) {
    caseDoc.productionStartedAt = caseDoc.submittedToQcAt;
    caseDoc.productionStartedById = new Types.ObjectId(actor.id);
    caseDoc.productionStartedByName = actorName(actor);
  }

  pushHistory(caseDoc, {
    action: isResubmit ? 'resubmitted_to_qc' : 'submitted_to_qc',
    summary: isResubmit
      ? 'Case resubmitted to QC after rejection'
      : 'Case submitted to QC queue',
    actor,
    metadata: {
      notes: input.notes?.trim() || undefined,
      qcRejectionCount: caseDoc.qcRejectionCount ?? 0,
    },
  });

  await caseDoc.save();

  await recordActivity({
    action: isResubmit
      ? AUDIT_ACTIONS.CASE_PRODUCTION_RESUBMIT_QC
      : AUDIT_ACTIONS.CASE_PRODUCTION_SUBMIT_QC,
    summary: `${actor.email} ${isResubmit ? 'resubmitted' : 'submitted'} case ${caseDoc.caseId} to QC`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return await toDetail(caseDoc, actor);
}

function assertCanQcReview(actor: CaseActor) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_QC_REVIEW)) {
    throw new AppError('You do not have permission to perform QC review', 403);
  }
}

function toQcQueueCaseDto(caseDoc: ICase): QcQueueCaseDto {
  return {
    id: caseDoc.id,
    caseId: caseDoc.caseId,
    patientName: caseDoc.patientName,
    doctorName: caseDoc.doctorName,
    designerName: caseDoc.assignedDesignerName ?? null,
    status: caseDoc.status,
    priority: caseDoc.priority,
    treatmentSummary: caseDoc.treatmentSummary,
    qcRejectionCount: caseDoc.qcRejectionCount ?? 0,
    escalatedForOversight: Boolean(caseDoc.escalatedForOversight),
    submittedToQcAt: caseDoc.submittedToQcAt ? caseDoc.submittedToQcAt.toISOString() : null,
    fileCount: caseDoc.files?.length ?? 0,
    createdAt: caseDoc.createdAt.toISOString(),
    updatedAt: caseDoc.updatedAt.toISOString(),
  };
}

function pushQcReview(
  caseDoc: ICase,
  input: {
    outcome: IQcReview['outcome'];
    errorCode?: QcErrorCode;
    comments: string;
    requiredChanges?: string;
    actor: CaseActor;
    deliveryViewLink?: string;
    deliveryVideoFilename?: string;
    deliveryVideoStorageKey?: string;
  },
) {
  caseDoc.qcReviews.unshift({
    _id: new Types.ObjectId(),
    outcome: input.outcome,
    errorCode: input.errorCode,
    comments: input.comments,
    requiredChanges: input.requiredChanges ?? '',
    reviewerId: new Types.ObjectId(input.actor.id),
    reviewerName: actorName(input.actor),
    deliveryViewLink: input.deliveryViewLink,
    deliveryVideoFilename: input.deliveryVideoFilename,
    deliveryVideoStorageKey: input.deliveryVideoStorageKey,
    createdAt: new Date(),
  } as IQcReview);
}

async function findUserIdsByRoles(roles: string[]): Promise<string[]> {
  const users = await User.find({ role: { $in: roles }, isActive: { $ne: false } })
    .select('_id')
    .lean();
  return users.map((u) => String(u._id));
}

async function emailUsers(
  userIds: string[],
  input: {
    subject: string;
    headline: string;
    message: string;
    caseId: string;
    patientName?: string;
    ctaLabel?: string;
  },
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  const users = await User.find({ _id: { $in: unique }, isActive: { $ne: false } }).select(
    'email firstName lastName',
  );
  await Promise.all(
    users.map((user) =>
      sendTemplatedEmail(
        user.email,
        caseEventTemplate({
          recipientName: `${user.firstName} ${user.lastName}`.trim() || user.email,
          subject: input.subject,
          headline: input.headline,
          message: input.message,
          caseId: input.caseId,
          patientName: input.patientName,
          portalUrl: `${env.clientUrl}/app/cases/${input.caseId}`,
          ctaLabel: input.ctaLabel,
        }),
      ).catch(() => undefined),
    ),
  );
}

export async function getQcDashboard(actor: CaseActor): Promise<QcDashboardDto> {
  assertCanQcReview(actor);

  const [pending, escalated] = await Promise.all([
    Case.find({
      isDeleted: false,
      status: CASE_STATUSES.QC_REVIEW,
    })
      .sort({ priority: -1, submittedToQcAt: 1, updatedAt: 1 })
      .limit(100),
    Case.find({
      isDeleted: false,
      escalatedForOversight: true,
      status: { $nin: [CASE_STATUSES.CANCELLED, CASE_STATUSES.COMPLETED] },
    })
      .sort({ escalatedAt: -1, updatedAt: -1 })
      .limit(50),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    pendingCount: pending.length,
    escalatedCount: escalated.length,
    items: pending.map(toQcQueueCaseDto),
    escalatedItems: escalated.map(toQcQueueCaseDto),
  };
}

export async function getEscalatedCasesQueue(actor: CaseActor): Promise<QcQueueCaseDto[]> {
  const canSee =
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL) ||
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_CONSULT) ||
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_QC_REVIEW);

  if (!canSee) {
    throw new AppError('You do not have permission to view escalated cases', 403);
  }

  const cases = await Case.find({
    isDeleted: false,
    escalatedForOversight: true,
    status: { $nin: [CASE_STATUSES.CANCELLED, CASE_STATUSES.COMPLETED] },
  })
    .sort({ escalatedAt: -1, updatedAt: -1 })
    .limit(100);

  return cases.map(toQcQueueCaseDto);
}

export async function addQcComment(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: { comments: string },
  audit?: RequestAuditContext,
) {
  assertCanQcReview(actor);
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot review a deleted case', 400);
  if (
    caseDoc.status !== CASE_STATUSES.QC_REVIEW &&
    caseDoc.status !== CASE_STATUSES.ORTHODONTIST_REVIEW
  ) {
    throw new AppError('Case is not in a QC review queue', 400);
  }

  const comments = input.comments.trim();
  if (!comments) throw new AppError('Comments are required', 400);

  pushQcReview(caseDoc, {
    outcome: QC_REVIEW_OUTCOMES.COMMENT,
    comments,
    actor,
  });

  pushHistory(caseDoc, {
    action: 'qc_comment',
    summary: 'QC review comment added',
    actor,
    metadata: { comments },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_QC_COMMENT,
    summary: `${actor.email} added a QC comment on case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  if (caseDoc.assignedDesignerId) {
    await createNotification({
      userId: String(caseDoc.assignedDesignerId),
      type: NOTIFICATION_TYPES.CASE_NOTE,
      title: `QC comment on ${caseDoc.caseId}`,
      body: comments.slice(0, 240),
      link: `/app/cases/${caseDoc.caseId}`,
      caseId: caseDoc.caseId,
    });
  }

  return await toDetail(caseDoc, actor);
}

export async function approveQcCase(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: { comments?: string; deliveryViewLink?: string },
  videoFile?: Express.Multer.File,
  audit?: RequestAuditContext,
) {
  assertCanQcReview(actor);
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot approve a deleted case', 400);
  if (
    caseDoc.status !== CASE_STATUSES.QC_REVIEW &&
    caseDoc.status !== CASE_STATUSES.ORTHODONTIST_REVIEW
  ) {
    throw new AppError('Only cases in QC or consultant review can be approved', 400);
  }

  const deliveryViewLink = input.deliveryViewLink?.trim() || '';
  let deliveryVideoFilename: string | undefined;
  let deliveryVideoStorageKey: string | undefined;

  if (videoFile) {
    const saved = await persistUploadedFile({
      caseId: caseDoc.caseId,
      originalName: videoFile.originalname,
      mimeType: videoFile.mimetype,
      buffer: videoFile.buffer,
      tempPath: videoFile.path,
    });
    deliveryVideoFilename = videoFile.originalname;
    deliveryVideoStorageKey = saved.storageKey;
  }

  if (!deliveryViewLink && !deliveryVideoStorageKey) {
    throw new AppError('Provide a delivery video or an HTML/view link when approving', 400);
  }

  const comments = input.comments?.trim() || 'Approved';
  const uploadedAt = new Date();
  const hot = initialHotFields(uploadedAt);

  caseDoc.status = CASE_STATUSES.DELIVERED;
  caseDoc.doctorDecision = undefined;
  caseDoc.doctorDecisionNote = undefined;
  caseDoc.doctorDecisionAt = undefined;
  caseDoc.delivery = {
    viewLink: deliveryViewLink,
    videoFilename: deliveryVideoFilename,
    videoStorageKey: deliveryVideoStorageKey,
    uploadedAt,
    uploadedById: new Types.ObjectId(actor.id),
    uploadedByName: actorName(actor),
    storageTier: hot.storageTier,
    restoreStatus: hot.restoreStatus,
    hotUntil: hot.hotUntil,
  };

  pushQcReview(caseDoc, {
    outcome: QC_REVIEW_OUTCOMES.APPROVED,
    comments,
    actor,
    deliveryViewLink: deliveryViewLink || undefined,
    deliveryVideoFilename,
    deliveryVideoStorageKey,
  });

  pushHistory(caseDoc, {
    action: 'qc_approved',
    summary: 'Case approved and delivered to doctor',
    actor,
    metadata: {
      comments,
      deliveryViewLink: deliveryViewLink || undefined,
      hasVideo: Boolean(deliveryVideoStorageKey),
    },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_DELIVERED,
    summary: `${actor.email} delivered case ${caseDoc.caseId} to doctor`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  const portalUrl = `${env.clientUrl}/app/cases/${caseDoc.caseId}`;

  await createNotification({
    userId: String(caseDoc.doctorId),
    type: NOTIFICATION_TYPES.CASE_DELIVERED,
    title: `${caseDoc.caseId} delivered for your review`,
    body: 'Your case is ready. Open it to view the delivery video or link, then record your decision.',
    link: `/app/cases/${caseDoc.caseId}`,
    caseId: caseDoc.caseId,
  });

  try {
    await sendTemplatedEmail(
      caseDoc.doctorEmail,
      caseDeliveredTemplate({
        doctorName: caseDoc.doctorName,
        caseId: caseDoc.caseId,
        patientName: caseDoc.patientName,
        deliveredByName: actorName(actor),
        hasVideo: Boolean(deliveryVideoStorageKey),
        hasLink: Boolean(deliveryViewLink),
        portalUrl,
      }),
    );
  } catch {
    // Non-blocking email failure
  }

  return await toDetail(caseDoc, actor);
}

export async function rejectQcCase(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: RejectQcInput,
  audit?: RequestAuditContext,
) {
  assertCanQcReview(actor);
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot reject a deleted case', 400);
  if (
    caseDoc.status !== CASE_STATUSES.QC_REVIEW &&
    caseDoc.status !== CASE_STATUSES.ORTHODONTIST_REVIEW
  ) {
    throw new AppError('Only cases in QC or consultant review can be rejected', 400);
  }

  const comments = input.comments.trim();
  const requiredChanges = input.requiredChanges.trim();
  if (!comments) throw new AppError('Comments are required', 400);
  if (!requiredChanges) throw new AppError('Required changes are required', 400);

  const nextCount = (caseDoc.qcRejectionCount ?? 0) + 1;
  caseDoc.qcRejectionCount = nextCount;
  caseDoc.status = CASE_STATUSES.SENT_FOR_MODIFICATION;
  caseDoc.lastQcErrorCode = input.errorCode;
  caseDoc.lastQcComments = comments;
  caseDoc.lastQcRequiredChanges = requiredChanges;

  const justEscalated =
    nextCount >= QC_ESCALATION_REJECTION_THRESHOLD && !caseDoc.escalatedForOversight;
  if (nextCount >= QC_ESCALATION_REJECTION_THRESHOLD) {
    caseDoc.escalatedForOversight = true;
    if (!caseDoc.escalatedAt) caseDoc.escalatedAt = new Date();
  }

  pushQcReview(caseDoc, {
    outcome: QC_REVIEW_OUTCOMES.REJECTED,
    errorCode: input.errorCode,
    comments,
    requiredChanges,
    actor,
  });

  pushHistory(caseDoc, {
    action: 'qc_rejected',
    summary: `QC rejected case (${QC_ERROR_CODE_LABELS[input.errorCode]})`,
    actor,
    metadata: {
      errorCode: input.errorCode,
      comments,
      requiredChanges,
      qcRejectionCount: nextCount,
      escalated: caseDoc.escalatedForOversight,
    },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_QC_REJECT,
    summary: `${actor.email} rejected case ${caseDoc.caseId} (${input.errorCode})`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  if (caseDoc.assignedDesignerId) {
    await createNotification({
      userId: String(caseDoc.assignedDesignerId),
      type: NOTIFICATION_TYPES.CASE_QC_REJECTED,
      title: `${caseDoc.caseId} returned by QC`,
      body: `${QC_ERROR_CODE_LABELS[input.errorCode]}: ${requiredChanges}`.slice(0, 240),
      link: `/app/cases/${caseDoc.caseId}`,
      caseId: caseDoc.caseId,
    });
    await emailUsers([String(caseDoc.assignedDesignerId)], {
      subject: `QC returned case ${caseDoc.caseId}`,
      headline: 'QC rejected / returned case',
      message: `QC returned ${caseDoc.caseId}: ${QC_ERROR_CODE_LABELS[input.errorCode]}. ${requiredChanges}`,
      caseId: caseDoc.caseId,
      patientName: caseDoc.patientName,
    });
  }

  if (justEscalated) {
    const oversightIds = await findUserIdsByRoles([ROLES.ORTHODONTIST, ROLES.SUPERVISOR]);
    await createNotificationsForUsers(oversightIds, {
      type: NOTIFICATION_TYPES.CASE_ESCALATED,
      title: `${caseDoc.caseId} escalated after ${nextCount} QC rejections`,
      body: 'This case is now visible in consultant and supervisor oversight queues.',
      link: `/app/cases/${caseDoc.caseId}`,
      caseId: caseDoc.caseId,
    });
  }

  return await toDetail(caseDoc, actor);
}

export async function getDesignerPerformance(
  actor: CaseActor,
  query: { month?: string } = {},
): Promise<DesignerPerformanceDto> {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_DESIGN)) {
    throw new AppError('You do not have permission to view designer performance', 403);
  }

  const availableMonths = recentMonthOptions(3);
  const periodKey =
    query.month && availableMonths.some((m) => m.key === query.month)
      ? query.month
      : availableMonths[0]!.key;
  const { start, end } = monthRangeUtc(periodKey);
  const designerId = new Types.ObjectId(actor.id);

  const cases = await Case.find({
    assignedDesignerId: designerId,
    isDeleted: false,
    $or: [
      { createdAt: { $gte: start, $lt: end } },
      { updatedAt: { $gte: start, $lt: end } },
      { submittedToQcAt: { $gte: start, $lt: end } },
      { productionStartedAt: { $gte: start, $lt: end } },
    ],
  }).select(
    'status qcRejectionCount submittedToQcAt productionStartedAt history createdAt updatedAt',
  );

  let completedCases = 0;
  let inProductionCases = 0;
  let submittedToQc = 0;
  let qcRejections = 0;
  let resubmissions = 0;

  for (const caseDoc of cases) {
    if (
      caseDoc.status === CASE_STATUSES.APPROVED ||
      caseDoc.status === CASE_STATUSES.DELIVERED ||
      caseDoc.status === CASE_STATUSES.COMPLETED
    ) {
      completedCases += 1;
    }
    if (
      caseDoc.status === CASE_STATUSES.DESIGNER_WORKING ||
      caseDoc.status === CASE_STATUSES.SENT_FOR_MODIFICATION
    ) {
      inProductionCases += 1;
    }
    if (
      caseDoc.submittedToQcAt &&
      caseDoc.submittedToQcAt >= start &&
      caseDoc.submittedToQcAt < end
    ) {
      submittedToQc += 1;
    }

    for (const entry of caseDoc.history ?? []) {
      if (entry.createdAt < start || entry.createdAt >= end) continue;
      if (entry.action === 'qc_rejected') qcRejections += 1;
      if (entry.action === 'resubmitted_to_qc') resubmissions += 1;
    }
  }

  return {
    periodKey,
    periodLabel: labelForMonthKey(periodKey),
    availableMonths,
    totalCases: cases.length,
    completedCases,
    inProductionCases,
    modifications: qcRejections + resubmissions,
    qcRejections,
    resubmissions,
    submittedToQc,
  };
}

export async function getQcPerformance(
  actor: CaseActor,
  query: { month?: string; view?: 'month' | 'quarter' } = {},
): Promise<QcPerformanceDto> {
  assertCanQcReview(actor);

  const availableMonths = recentMonthOptions(3);
  const periodKey =
    query.month && availableMonths.some((m) => m.key === query.month)
      ? query.month
      : availableMonths[0]!.key;
  const view = query.view === 'quarter' ? 'quarter' : 'month';

  const range =
    view === 'quarter' ? quarterRangeUtc(periodKey) : { ...monthRangeUtc(periodKey), label: labelForMonthKey(periodKey) };
  const reviewerId = new Types.ObjectId(actor.id);

  const cases = await Case.find({
    isDeleted: false,
    'qcReviews.reviewerId': reviewerId,
    'qcReviews.createdAt': { $gte: range.start, $lt: range.end },
  }).select('qcReviews');

  let approvedCount = 0;
  let revertedCount = 0;
  let commentsOnly = 0;
  const errorCounts = new Map<QcErrorCode, number>();

  for (const caseDoc of cases) {
    for (const review of caseDoc.qcReviews ?? []) {
      if (String(review.reviewerId) !== actor.id) continue;
      if (review.createdAt < range.start || review.createdAt >= range.end) continue;

      if (review.outcome === QC_REVIEW_OUTCOMES.APPROVED) approvedCount += 1;
      else if (review.outcome === QC_REVIEW_OUTCOMES.REJECTED) {
        revertedCount += 1;
        if (review.errorCode) {
          errorCounts.set(review.errorCode, (errorCounts.get(review.errorCode) ?? 0) + 1);
        }
      } else if (review.outcome === QC_REVIEW_OUTCOMES.COMMENT) {
        commentsOnly += 1;
      }
    }
  }

  const errorTrends: QcErrorTrendItem[] = ALL_QC_ERROR_CODES.map((errorCode) => ({
    errorCode,
    label: QC_ERROR_CODE_LABELS[errorCode],
    count: errorCounts.get(errorCode) ?? 0,
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    view,
    periodKey,
    periodLabel: range.label,
    availableMonths,
    casesReviewed: approvedCount + revertedCount + commentsOnly,
    approvedCount,
    revertedCount,
    commentsOnly,
    errorTrends,
  };
}

export async function updateCasePayment(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: UpdateCasePaymentInput,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_MANAGE_PAYMENT)) {
    throw new AppError('You do not have permission to manage payments', 403);
  }

  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (!caseDoc.payment) {
    caseDoc.payment = {
      status: PAYMENT_STATUSES.NOT_BILLED,
      currency: 'USD',
      invoiceNumber: '',
      notes: '',
    };
  }

  if (input.status !== undefined) caseDoc.payment.status = input.status;
  if (input.currency !== undefined) caseDoc.payment.currency = input.currency.trim() || 'USD';
  if (input.amountDue !== undefined) caseDoc.payment.amountDue = input.amountDue ?? undefined;
  if (input.amountPaid !== undefined) caseDoc.payment.amountPaid = input.amountPaid ?? undefined;
  if (input.invoiceNumber !== undefined) {
    caseDoc.payment.invoiceNumber = input.invoiceNumber.trim();
  }
  if (input.notes !== undefined) caseDoc.payment.notes = input.notes.trim();
  caseDoc.payment.updatedAt = new Date();
  caseDoc.markModified('payment');

  pushHistory(caseDoc, {
    action: 'payment_updated',
    summary: `Payment status set to ${caseDoc.payment.status}`,
    actor,
    metadata: { payment: toPaymentDto(caseDoc) },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_PAYMENT_UPDATE,
    summary: `${actor.email} updated payment for case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { payment: toPaymentDto(caseDoc) },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return await toDetail(caseDoc, actor);
}

export async function updateTreatmentInstructions(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: Partial<TreatmentInstructions>,
  audit?: RequestAuditContext,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  const canEdit =
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_UPDATE) ||
    (permissionsInclude(actor.permissions, PERMISSIONS.CASE_CREATE) &&
      String(caseDoc.doctorId) === actor.id);

  if (!canEdit) {
    throw new AppError('You do not have permission to update treatment instructions', 403);
  }

  if (caseDoc.isDeleted) {
    throw new AppError('Cannot edit a deleted case', 400);
  }

  const previous = normalizeTreatmentInstructions(caseDoc.treatmentInstructions);
  const next = normalizeTreatmentInstructions({ ...previous, ...input });
  caseDoc.treatmentInstructions = next;

  pushHistory(caseDoc, {
    action: 'treatment_instructions_updated',
    summary: 'Treatment instructions updated',
    actor,
    metadata: {
      changes: [
        {
          field: 'treatmentInstructions',
          label: 'Treatment instructions',
          from: previous,
          to: next,
        },
      ],
    },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_UPDATE,
    summary: `${actor.email} updated treatment instructions for ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return await toDetail(caseDoc, actor);
}

export async function startCaseValidation(
  actor: CaseActor,
  caseIdOrMongoId: string,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_VALIDATE)) {
    throw new AppError('You do not have permission to validate cases', 403);
  }

  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot validate a deleted case', 400);
  if (caseDoc.status === CASE_STATUSES.CANCELLED) {
    throw new AppError('Cannot validate a cancelled case', 400);
  }

  if (caseDoc.status === CASE_STATUSES.SUBMITTED) {
    caseDoc.status = CASE_STATUSES.UNDER_VALIDATION;
    pushHistory(caseDoc, {
      action: 'validation_started',
      summary: 'Case moved to under validation',
      actor,
    });
    await caseDoc.save();

    await recordActivity({
      action: AUDIT_ACTIONS.CASE_VALIDATE,
      summary: `${actor.email} started validation for case ${caseDoc.caseId}`,
      actorId: actor.id,
      actorEmail: actor.email,
      actorName: actorName(actor),
      actorRole: actor.role,
      targetType: 'case',
      targetId: caseDoc.caseId,
      metadata: { step: 'started' },
      ipAddress: audit?.ipAddress,
      userAgent: audit?.userAgent,
    });
  }

  return await toDetail(caseDoc, actor);
}

export async function markCaseValidated(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: ValidateCaseInput = {},
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_VALIDATE)) {
    throw new AppError('You do not have permission to validate cases', 403);
  }

  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot validate a deleted case', 400);
  if (caseDoc.status === CASE_STATUSES.CANCELLED) {
    throw new AppError('Cannot validate a cancelled case', 400);
  }
  if (caseDoc.status === CASE_STATUSES.WAITING_CLARIFICATION) {
    throw new AppError('Resolve open clarifications before validating', 400);
  }

  const validation = await buildValidationSummary(caseDoc);
  const hardFail = validation.checks.filter(
    (check) =>
      !check.passed &&
      (check.id === 'patient_name' || check.id === 'treatment_summary'),
  );
  if (hardFail.length > 0) {
    throw new AppError(
      `Cannot validate: ${hardFail.map((c) => c.label).join(', ')}`,
      400,
    );
  }

  if (!validation.ready && !input.force) {
    throw new AppError(
      'Case is not ready for validation. Fix checklist items or force validate with a note.',
      400,
    );
  }

  if (caseDoc.status === CASE_STATUSES.SUBMITTED) {
    caseDoc.status = CASE_STATUSES.UNDER_VALIDATION;
  }

  caseDoc.validatedAt = new Date();
  caseDoc.validatedById = new Types.ObjectId(actor.id);
  caseDoc.validatedByName = actorName(actor);

  pushHistory(caseDoc, {
    action: 'validated',
    summary: input.force
      ? 'Case marked as validated (forced)'
      : 'Case marked as validated',
    actor,
    metadata: {
      notes: input.notes?.trim() || undefined,
      force: Boolean(input.force),
      checks: validation.checks,
    },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_VALIDATE,
    summary: `${actor.email} validated case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { force: Boolean(input.force), notes: input.notes },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return await toDetail(caseDoc, actor);
}

export async function assignCase(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: AssignCaseInput,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_ASSIGN)) {
    throw new AppError('You do not have permission to assign cases', 403);
  }

  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot assign a deleted case', 400);
  if (caseDoc.status === CASE_STATUSES.CANCELLED) {
    throw new AppError('Cannot assign a cancelled case', 400);
  }
  if (caseDoc.status === CASE_STATUSES.WAITING_CLARIFICATION) {
    throw new AppError('Cannot assign while waiting for doctor clarification', 400);
  }
  if (!caseDoc.validatedAt) {
    throw new AppError('Validate the case before assigning', 400);
  }

  if (input.mode === 'designer') {
    if (!input.designerId) {
      throw new AppError('designerId is required when assigning to a designer', 400);
    }
    const designer = await User.findById(input.designerId);
    if (!designer || !designer.isActive || designer.role !== ROLES.DESIGNER) {
      throw new AppError('Active designer not found', 404);
    }

    caseDoc.assignmentMode = ASSIGNMENT_MODES.DESIGNER;
    caseDoc.assignedDesignerId = designer._id as Types.ObjectId;
    caseDoc.assignedDesignerName = `${designer.firstName} ${designer.lastName}`.trim();
    caseDoc.status = CASE_STATUSES.DESIGNER_WORKING;

    pushHistory(caseDoc, {
      action: 'assigned',
      summary: `Assigned to designer ${caseDoc.assignedDesignerName}`,
      actor,
      metadata: { designerId: designer.id, note: input.note?.trim() || undefined },
    });
  } else if (input.mode === 'auto_queue') {
    caseDoc.assignmentMode = ASSIGNMENT_MODES.AUTO_QUEUE;
    caseDoc.assignedDesignerId = undefined;
    caseDoc.assignedDesignerName = undefined;
    caseDoc.status = CASE_STATUSES.DESIGNER_WORKING;

    pushHistory(caseDoc, {
      action: 'assigned',
      summary: 'Sent to auto case-pick queue',
      actor,
      metadata: { mode: 'auto_queue', note: input.note?.trim() || undefined },
    });
  } else {
    throw new AppError('Invalid assignment mode', 400);
  }

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_ASSIGN,
    summary: `${actor.email} assigned case ${caseDoc.caseId} (${input.mode})`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: {
      mode: input.mode,
      designerId: input.designerId,
      note: input.note,
    },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  if (input.mode === 'designer' && caseDoc.assignedDesignerId) {
    const designerId = String(caseDoc.assignedDesignerId);
    await createNotification({
      userId: designerId,
      type: NOTIFICATION_TYPES.CASE_ASSIGNED,
      title: `Case assigned: ${caseDoc.caseId}`,
      body: `${actorName(actor)} assigned ${caseDoc.patientName} to you.`,
      link: `/app/cases/${caseDoc.caseId}`,
      caseId: caseDoc.caseId,
    });
    await emailUsers([designerId], {
      subject: `Case assigned: ${caseDoc.caseId}`,
      headline: 'Case assigned to you',
      message: `${actorName(actor)} assigned case ${caseDoc.caseId} (${caseDoc.patientName}) to you.`,
      caseId: caseDoc.caseId,
      patientName: caseDoc.patientName,
    });
  } else if (input.mode === 'auto_queue') {
    const designerIds = await findUserIdsByRoles([ROLES.DESIGNER]);
    await createNotificationsForUsers(designerIds, {
      type: NOTIFICATION_TYPES.CASE_ASSIGNED,
      title: `Case in pick queue: ${caseDoc.caseId}`,
      body: `${caseDoc.patientName} is available in the auto case-pick queue.`,
      link: `/app/cases/${caseDoc.caseId}`,
      caseId: caseDoc.caseId,
    });
  }

  return await toDetail(caseDoc, actor);
}

function toQueueCaseDto(
  caseDoc: ICase,
  openClarificationCount: number,
): CoordinatorQueueCaseDto {
  const assignmentMode = (caseDoc.assignmentMode ?? ASSIGNMENT_MODES.NONE) as AssignmentMode;
  const queue = resolveCoordinatorQueue({
    status: caseDoc.status,
    validatedAt: caseDoc.validatedAt,
    assignmentMode,
    assignedDesignerId: caseDoc.assignedDesignerId
      ? String(caseDoc.assignedDesignerId)
      : null,
  });
  const ref = queueReferenceDate(caseDoc);
  const hours = delayHoursSince(ref);

  return {
    id: caseDoc.id,
    caseId: caseDoc.caseId,
    patientName: caseDoc.patientName,
    doctorName: caseDoc.doctorName,
    doctorEmail: caseDoc.doctorEmail,
    status: caseDoc.status,
    priority: caseDoc.priority,
    treatmentSummary: caseDoc.treatmentSummary,
    queue,
    delayLevel: computeDelayLevel(ref),
    delayHours: Math.round(hours * 10) / 10,
    fileCount: caseDoc.files.length,
    openClarificationCount,
    assignedDesignerName: caseDoc.assignedDesignerName ?? null,
    assignmentMode,
    validatedAt: caseDoc.validatedAt ? caseDoc.validatedAt.toISOString() : null,
    createdAt: caseDoc.createdAt.toISOString(),
    updatedAt: caseDoc.updatedAt.toISOString(),
  };
}

export async function getCoordinatorDashboard(
  actor: CaseActor,
): Promise<CoordinatorDashboardDto> {
  if (
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL) &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VALIDATE) &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_ASSIGN)
  ) {
    throw new AppError('You do not have permission to view the coordinator dashboard', 403);
  }

  const cases = await Case.find({
    isDeleted: false,
    status: { $ne: CASE_STATUSES.CANCELLED },
  }).sort({ updatedAt: -1 });

  const openCounts = await Promise.all(
    cases.map(async (caseDoc) => ({
      id: String(caseDoc._id),
      count: await countOpenClarifications(caseDoc._id as Types.ObjectId),
    })),
  );
  const openMap = new Map(openCounts.map((entry) => [entry.id, entry.count]));

  const items = cases.map((caseDoc) =>
    toQueueCaseDto(caseDoc, openMap.get(String(caseDoc._id)) ?? 0),
  );

  // Only intake-relevant cases in coordinator buckets; assigned includes production.
  const intakeQueues = new Set<CoordinatorQueue>(ALL_COORDINATOR_QUEUES);
  const relevant = items.filter((item) => intakeQueues.has(item.queue));

  const totals = Object.fromEntries(
    ALL_COORDINATOR_QUEUES.map((queue) => [queue, 0]),
  ) as Record<CoordinatorQueue, number>;

  const delayBreakdown = Object.fromEntries(
    ALL_DELAY_LEVELS.map((level) => [level, 0]),
  ) as Record<DelayLevel, number>;

  for (const item of relevant) {
    totals[item.queue] += 1;
    delayBreakdown[item.delayLevel] += 1;
  }

  const buckets = ALL_COORDINATOR_QUEUES.map((queue) => {
    const queueItems = relevant.filter((item) => item.queue === queue);
    const bucketDelay = Object.fromEntries(
      ALL_DELAY_LEVELS.map((level) => [level, 0]),
    ) as Record<DelayLevel, number>;
    for (const item of queueItems) {
      bucketDelay[item.delayLevel] += 1;
    }
    return {
      queue,
      label: COORDINATOR_QUEUE_LABELS[queue],
      description: COORDINATOR_QUEUE_DESCRIPTIONS[queue],
      count: queueItems.length,
      delayBreakdown: bucketDelay,
      items: queueItems.slice(0, 25),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    totals,
    delayBreakdown,
    buckets,
  };
}

export async function listDesignerAssignees(
  actor: CaseActor,
): Promise<DesignerAssigneeDto[]> {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_ASSIGN)) {
    throw new AppError('You do not have permission to list designers', 403);
  }

  const designers = await User.find({
    role: ROLES.DESIGNER,
    isActive: true,
  }).sort({ firstName: 1, lastName: 1 });

  return designers.map((designer) => ({
    id: designer.id,
    firstName: designer.firstName,
    lastName: designer.lastName,
    email: designer.email,
    isActive: designer.isActive,
  }));
}

export async function listDoctorAssignees(
  actor: CaseActor,
): Promise<DesignerAssigneeDto[]> {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_CREATE)) {
    throw new AppError('You do not have permission to list doctors', 403);
  }

  const doctors = await User.find({
    role: ROLES.DOCTOR,
    accountStatus: 'active',
  }).sort({ firstName: 1, lastName: 1 });

  const canSeeName = actor.role === ROLES.ADMIN;

  return doctors.map((doctor) => {
    const label = canSeeName
      ? `${doctor.firstName} ${doctor.lastName}`.trim()
      : doctor.doctorId || doctor.id;
    return {
      id: doctor.id,
      firstName: canSeeName ? doctor.firstName : label,
      lastName: canSeeName ? doctor.lastName : '',
      email: canSeeName ? doctor.email : '',
      isActive: doctor.accountStatus === 'active',
    };
  });
}

export async function resolveCaseActor(userId: string): Promise<CaseActor> {
  const user = await User.findById(userId);
  if (!user || (user.accountStatus !== 'active' && user.accountStatus !== 'suspended')) {
    throw new AppError('User not found or inactive', 401);
  }

  const permissions = await resolvePermissionsForUserId(userId);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    permissions,
  };
}

function assertCanConsult(actor: CaseActor) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_CONSULT)) {
    throw new AppError('You do not have permission to consult on cases', 403);
  }
}

function toConsultantQueueCaseDto(caseDoc: ICase): ConsultantQueueCaseDto {
  return {
    id: caseDoc.id,
    caseId: caseDoc.caseId,
    patientName: caseDoc.patientName,
    doctorName: caseDoc.doctorName,
    designerName: caseDoc.assignedDesignerName ?? null,
    status: caseDoc.status,
    priority: caseDoc.priority,
    treatmentSummary: caseDoc.treatmentSummary,
    consultantIndicator: caseDoc.consultantIndicator ?? null,
    escalatedForOversight: Boolean(caseDoc.escalatedForOversight),
    qcRejectionCount: caseDoc.qcRejectionCount ?? 0,
    clinicalRemarkCount: caseDoc.clinicalRemarks?.length ?? 0,
    assignedConsultantName: caseDoc.assignedConsultantName ?? null,
    updatedAt: caseDoc.updatedAt.toISOString(),
  };
}

export async function getConsultantDashboard(
  actor: CaseActor,
): Promise<ConsultantDashboardDto> {
  assertCanConsult(actor);

  const cases = await Case.find({
    isDeleted: false,
    status: { $nin: [CASE_STATUSES.CANCELLED, CASE_STATUSES.COMPLETED] },
    $or: [
      { escalatedForOversight: true },
      { assignedConsultantId: new Types.ObjectId(actor.id) },
      { status: CASE_STATUSES.ORTHODONTIST_REVIEW },
      { 'clinicalRemarks.0': { $exists: true } },
    ],
  })
    .sort({ priority: -1, updatedAt: -1 })
    .limit(100);

  const items = cases.map(toConsultantQueueCaseDto);
  let greenCount = 0;
  let yellowCount = 0;
  let redCount = 0;
  let unreviewedCount = 0;

  for (const item of items) {
    if (item.consultantIndicator === CONSULTANT_INDICATORS.GREEN) greenCount += 1;
    else if (item.consultantIndicator === CONSULTANT_INDICATORS.YELLOW) yellowCount += 1;
    else if (item.consultantIndicator === CONSULTANT_INDICATORS.RED) redCount += 1;
    else unreviewedCount += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    totalCount: items.length,
    greenCount,
    yellowCount,
    redCount,
    unreviewedCount,
    items,
  };
}

export async function addClinicalRemark(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: { body: string; indicator: ConsultantIndicator },
  audit?: RequestAuditContext,
) {
  assertCanConsult(actor);
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot remark on a deleted case', 400);
  if (caseDoc.status === CASE_STATUSES.CANCELLED) {
    throw new AppError('Cannot remark on a cancelled case', 400);
  }

  const body = input.body.trim();
  if (!body) throw new AppError('Clinical remark is required', 400);

  caseDoc.clinicalRemarks.unshift({
    _id: new Types.ObjectId(),
    body,
    indicator: input.indicator,
    authorId: new Types.ObjectId(actor.id),
    authorName: actorName(actor),
    createdAt: new Date(),
  } as IClinicalRemark);

  caseDoc.consultantIndicator = input.indicator;
  if (input.indicator === CONSULTANT_INDICATORS.GREEN) {
    caseDoc.consultantReviewedAt = new Date();
  }
  if (!caseDoc.assignedConsultantId) {
    caseDoc.assignedConsultantId = new Types.ObjectId(actor.id);
    caseDoc.assignedConsultantName = actorName(actor);
  }

  pushHistory(caseDoc, {
    action: 'clinical_remark',
    summary: `Clinical remark added (${CONSULTANT_INDICATOR_LABELS[input.indicator]})`,
    actor,
    metadata: { indicator: input.indicator, body },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_CLINICAL_REMARK,
    summary: `${actor.email} added a clinical remark on case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  const notifyIds: string[] = [];
  if (caseDoc.assignedDesignerId) notifyIds.push(String(caseDoc.assignedDesignerId));
  const qcUsers = await findUserIdsByRoles([ROLES.QC, ROLES.SUPERVISOR]);
  notifyIds.push(...qcUsers);

  await createNotificationsForUsers(notifyIds, {
    type: NOTIFICATION_TYPES.CLINICAL_REMARK,
    title: `Clinical remark on ${caseDoc.caseId}`,
    body: `${CONSULTANT_INDICATOR_LABELS[input.indicator]}: ${body}`.slice(0, 240),
    link: `/app/cases/${caseDoc.caseId}`,
    caseId: caseDoc.caseId,
  });

  return await toDetail(caseDoc, actor);
}

export async function getConsultantPerformance(
  actor: CaseActor,
  query: { month?: string; view?: 'month' | 'quarter' } = {},
): Promise<ConsultantPerformanceDto> {
  assertCanConsult(actor);

  const availableMonths = recentMonthOptions(3);
  const periodKey =
    query.month && availableMonths.some((m) => m.key === query.month)
      ? query.month
      : availableMonths[0]!.key;
  const view = query.view === 'quarter' ? 'quarter' : 'month';
  const range =
    view === 'quarter'
      ? quarterRangeUtc(periodKey)
      : { ...monthRangeUtc(periodKey), label: labelForMonthKey(periodKey) };

  const reviewerId = new Types.ObjectId(actor.id);

  const cases = await Case.find({
    isDeleted: false,
    $or: [
      { 'qcReviews.reviewerId': reviewerId },
      { 'clinicalRemarks.authorId': reviewerId },
    ],
  }).select('qcReviews clinicalRemarks');

  let reviewCount = 0;
  let consultationCount = 0;
  let qcRevertedCount = 0;
  let approvedCount = 0;
  const errorCounts = new Map<string, number>();
  const indicatorBreakdown: Record<ConsultantIndicator, number> = {
    [CONSULTANT_INDICATORS.GREEN]: 0,
    [CONSULTANT_INDICATORS.YELLOW]: 0,
    [CONSULTANT_INDICATORS.RED]: 0,
  };

  for (const caseDoc of cases) {
    for (const review of caseDoc.qcReviews ?? []) {
      if (String(review.reviewerId) !== actor.id) continue;
      if (review.createdAt < range.start || review.createdAt >= range.end) continue;
      reviewCount += 1;
      if (review.outcome === QC_REVIEW_OUTCOMES.APPROVED) approvedCount += 1;
      if (review.outcome === QC_REVIEW_OUTCOMES.REJECTED) {
        qcRevertedCount += 1;
        if (review.errorCode) {
          errorCounts.set(review.errorCode, (errorCounts.get(review.errorCode) ?? 0) + 1);
        }
      }
    }

    for (const remark of caseDoc.clinicalRemarks ?? []) {
      if (String(remark.authorId) !== actor.id) continue;
      if (remark.createdAt < range.start || remark.createdAt >= range.end) continue;
      consultationCount += 1;
      indicatorBreakdown[remark.indicator] += 1;
    }
  }

  return {
    view,
    periodKey,
    periodLabel: range.label,
    availableMonths,
    reviewCount,
    consultationCount,
    qcRevertedCount,
    approvedCount,
    errorTrends: ALL_QC_ERROR_CODES.map((errorCode) => ({
      errorCode,
      label: QC_ERROR_CODE_LABELS[errorCode],
      count: errorCounts.get(errorCode) ?? 0,
    }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count),
    indicatorBreakdown,
  };
}

export async function recordDoctorCaseView(
  actor: CaseActor,
  caseIdOrMongoId: string,
  audit?: RequestAuditContext,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (String(caseDoc.doctorId) !== actor.id) {
    return await toDetail(caseDoc, actor);
  }

  if (
    caseDoc.status !== CASE_STATUSES.DELIVERED &&
    caseDoc.status !== CASE_STATUSES.APPROVED
  ) {
    return await toDetail(caseDoc, actor);
  }

  if (!caseDoc.doctorEngagement) caseDoc.doctorEngagement = {};
  const now = new Date();
  const firstOpen = !caseDoc.doctorEngagement.openedAt;
  if (firstOpen) caseDoc.doctorEngagement.openedAt = now;
  caseDoc.doctorEngagement.lastViewedAt = now;

  const shouldNotifyView =
    firstOpen &&
    !caseDoc.doctorDecision &&
    !caseDoc.doctorEngagement.viewedWithoutActionNotifiedAt;

  if (shouldNotifyView) {
    caseDoc.doctorEngagement.viewedWithoutActionNotifiedAt = now;
  }

  pushHistory(caseDoc, {
    action: 'doctor_viewed',
    summary: firstOpen
      ? 'Doctor opened delivered case'
      : 'Doctor viewed delivered case',
    actor,
  });

  await caseDoc.save();

  if (shouldNotifyView) {
    await recordActivity({
      action: AUDIT_ACTIONS.CASE_DOCTOR_VIEWED,
      summary: `Doctor has viewed Case ID ${caseDoc.caseId}`,
      actorId: actor.id,
      actorEmail: actor.email,
      actorName: actorName(actor),
      actorRole: actor.role,
      targetType: 'case',
      targetId: caseDoc.caseId,
      ipAddress: audit?.ipAddress,
      userAgent: audit?.userAgent,
    });

    const teamIds = await findUserIdsByRoles([
      ROLES.QC,
      ROLES.COORDINATOR,
      ROLES.SUPERVISOR,
      ROLES.ORTHODONTIST,
    ]);
    if (caseDoc.assignedDesignerId) teamIds.push(String(caseDoc.assignedDesignerId));

    await createNotificationsForUsers(teamIds, {
      type: NOTIFICATION_TYPES.CASE_DOCTOR_VIEWED,
      title: `Doctor has viewed Case ID ${caseDoc.caseId}`,
      body: `${caseDoc.doctorName} opened the delivery without selecting an option yet (“Viewed”).`,
      link: `/app/cases/${caseDoc.caseId}`,
      caseId: caseDoc.caseId,
    });
    await emailUsers(teamIds, {
      subject: `Doctor viewed case ${caseDoc.caseId}`,
      headline: 'Doctor viewed delivery',
      message: `${caseDoc.doctorName} opened case ${caseDoc.caseId} without selecting an option yet.`,
      caseId: caseDoc.caseId,
      patientName: caseDoc.patientName,
    });
  }

  return await toDetail(caseDoc, actor);
}

export async function submitDoctorDecision(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: { decision: DoctorDecision; note?: string },
  audit?: RequestAuditContext,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (String(caseDoc.doctorId) !== actor.id) {
    throw new AppError('Only the owning doctor can decide on this case', 403);
  }

  if (
    caseDoc.status !== CASE_STATUSES.DELIVERED &&
    caseDoc.status !== CASE_STATUSES.APPROVED
  ) {
    throw new AppError('Case is not awaiting doctor review', 400);
  }

  const note = input.note?.trim() || '';
  const now = new Date();

  caseDoc.doctorDecision = input.decision;
  caseDoc.doctorDecisionNote = note || undefined;
  caseDoc.doctorDecisionAt = now;
  if (!caseDoc.doctorEngagement) caseDoc.doctorEngagement = {};
  caseDoc.doctorEngagement.respondedAt = now;
  caseDoc.doctorEngagement.lastViewedAt = now;

  if (input.decision === DOCTOR_DECISIONS.APPROVE) {
    caseDoc.status = CASE_STATUSES.COMPLETED;
  } else if (input.decision === DOCTOR_DECISIONS.REQUEST_MODIFICATION) {
    if (!note) throw new AppError('Describe the modification you need', 400);
    caseDoc.status = CASE_STATUSES.SENT_FOR_MODIFICATION;
  } else if (input.decision === DOCTOR_DECISIONS.CANCEL) {
    if (!note) throw new AppError('Provide a cancellation reason', 400);
    caseDoc.status = CASE_STATUSES.CANCELLED;
    caseDoc.cancelReason = note;
  } else if (input.decision === DOCTOR_DECISIONS.UNDER_REVIEW) {
    caseDoc.status = CASE_STATUSES.DELIVERED;
  }

  pushHistory(caseDoc, {
    action: 'doctor_decision',
    summary: `Doctor decision: ${DOCTOR_DECISION_LABELS[input.decision]}`,
    actor,
    metadata: { decision: input.decision, note: note || undefined },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_DOCTOR_DECISION,
    summary: `${actor.email} recorded decision "${input.decision}" on case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  const teamIds = await findUserIdsByRoles([
    ROLES.QC,
    ROLES.COORDINATOR,
    ROLES.SUPERVISOR,
    ROLES.DESIGNER,
  ]);
  if (caseDoc.assignedDesignerId) teamIds.push(String(caseDoc.assignedDesignerId));
  if (caseDoc.assignedConsultantId) teamIds.push(String(caseDoc.assignedConsultantId));

  await createNotificationsForUsers(teamIds, {
    type: NOTIFICATION_TYPES.CASE_DOCTOR_DECISION,
    title: `${caseDoc.caseId}: ${DOCTOR_DECISION_LABELS[input.decision]}`,
    body: (note || `Doctor selected ${DOCTOR_DECISION_LABELS[input.decision]}`).slice(0, 240),
    link: `/app/cases/${caseDoc.caseId}`,
    caseId: caseDoc.caseId,
  });
  await emailUsers(teamIds, {
    subject: `${caseDoc.caseId}: ${DOCTOR_DECISION_LABELS[input.decision]}`,
    headline: 'Doctor decision recorded',
    message:
      note ||
      `${caseDoc.doctorName} selected ${DOCTOR_DECISION_LABELS[input.decision]} on case ${caseDoc.caseId}.`,
    caseId: caseDoc.caseId,
    patientName: caseDoc.patientName,
  });

  return await toDetail(caseDoc, actor);
}

export async function getDoctorDeliveryQueue(
  actor: CaseActor,
): Promise<DoctorDeliveryQueueItemDto[]> {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_OWN)) {
    throw new AppError('You do not have permission to view deliveries', 403);
  }

  const cases = await Case.find({
    doctorId: new Types.ObjectId(actor.id),
    isDeleted: false,
    status: {
      $in: [CASE_STATUSES.DELIVERED, CASE_STATUSES.APPROVED, CASE_STATUSES.COMPLETED],
    },
  })
    .sort({ updatedAt: -1 })
    .limit(50);

  return cases.map((caseDoc) => ({
    id: caseDoc.id,
    caseId: caseDoc.caseId,
    patientName: caseDoc.patientName,
    status: caseDoc.status,
    treatmentSummary: caseDoc.treatmentSummary,
    hasDeliveryVideo: Boolean(caseDoc.delivery?.videoStorageKey),
    hasDeliveryLink: Boolean(caseDoc.delivery?.viewLink),
    doctorDecision: caseDoc.doctorDecision ?? null,
    deliveredAt: caseDoc.delivery?.uploadedAt
      ? caseDoc.delivery.uploadedAt.toISOString()
      : null,
    updatedAt: caseDoc.updatedAt.toISOString(),
  }));
}

export { CASE_STATUS_LABELS };
