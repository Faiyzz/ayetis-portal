import {
  ASSIGNMENT_MODES,
  AUDIT_ACTIONS,
  CASE_FIELD_LABELS,
  CASE_PRIORITIES,
  CASE_PRIORITY_LABELS,
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  CASE_CATEGORIES,
  CLARIFICATION_STATUSES,
  CASE_TYPES,
  CASE_CANCEL_WINDOW_MINUTES,
  EMPTY_CASE_COMMERCIAL,
  EMPTY_CLINICAL_PREFERENCES,
  EMPTY_IMPLANT_DETAILS,
  EMPTY_OCCLUSION_GOALS,
  EMPTY_PROSTHO_DETAILS,
  EMPTY_RECORDS_NUMBERING,
  REFUND_STATUSES,
  isWithinCancelWindow,
  remainingCancelWindowSeconds,
  slaProgressColor,
  CONSULTANT_INDICATORS,
  CONSULTANT_INDICATOR_LABELS,
  COORDINATOR_QUEUE_DESCRIPTIONS,
  COORDINATOR_QUEUE_LABELS,
  COORDINATOR_QUEUES,
  DELAY_LEVELS,
  EMAIL_TEMPLATE_KEYS,
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
  QC_SCOPES,
  ROLES,
  ASSIGNMENT_QUEUES,
  CUT_ASSIGNMENT_MODES,
  CUT_PHASES,
  canQcCase,
  getCaseWorkflowLabel,
  type CutAssignmentMode,
  type CutDashboardDto,
  type CutOperatorAssigneeDto,
  type CutPerformanceDto,
  type CutPhase,
  type CutQueueCaseDto,
  type CutRevisionDto,
  type QcScope,
  type RequestCutReworkInput,
  type SaveCutProgressInput,
  type StartCutInput,
  type SubmitCutInput,
  ALL_COORDINATOR_QUEUES,
  ALL_DELAY_LEVELS,
  ALL_QC_ERROR_CODES,
  buildCaseTimeline,
  computeDelayLevel,
  formatHistoryValue,
  isAllowedUploadFilename,
  isArchiveFilename,
  classifyUploadFile,
  labelForMonthKey,
  monthRangeUtc,
  formatDoctorDisplay,
  canViewDoctorName,
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
import fs from 'fs';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { computeSlaDeadline, slaUtilizationPercent as computeSlaUtilization } from '../../utils/businessHours';
import { resolveSlaHoursForUser } from '../settings/settings.service';
import { Case, type ICase, type IClinicalRemark, type IQcReview } from '../../models/Case';
import { generateCaseId } from '../../models/CaseCounter';
import { User } from '../../models/User';
import { extractArchiveMembers } from '../../services/archiveExtract.service';
import { scanUploadedFile } from '../../services/malwareScan.service';
import {
  caseDeliveredTemplate,
  caseEventTemplate,
  sendCmsOrFallback,
} from '../../services/email';
import {
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';
import {
  countOpenClarifications,
  getClarificationButtonStateForCase,
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
import { resolveCountryGeo } from '../settings/geoResolve';

export interface CaseActor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roles?: string[];
  permissions: Permission[];
  qcScope: QcScope;
  organizationId?: string | null;
  facilityId?: string | null;
  corporateCustomerId?: string | null;
  assignedCountry?: string | null;
}

function actorName(actor: CaseActor) {
  return `${actor.firstName} ${actor.lastName}`.trim();
}

type DoctorViewer = { id: string; role: string; roles?: string[] };

function doctorNameForViewer(
  caseDoc: Pick<ICase, 'doctorId' | 'doctorName' | 'doctorDisplayId'>,
  viewer?: DoctorViewer,
): string {
  if (!viewer) return caseDoc.doctorDisplayId || 'Doctor';
  return formatDoctorDisplay(
    viewer.role as Role,
    viewer.id,
    {
      doctorUserId: String(caseDoc.doctorId),
      doctorName: caseDoc.doctorName,
      doctorId: caseDoc.doctorDisplayId,
    },
    viewer.roles,
  );
}

function doctorEmailForViewer(
  caseDoc: Pick<ICase, 'doctorId' | 'doctorEmail'>,
  viewer?: DoctorViewer,
): string {
  if (
    !viewer ||
    !canViewDoctorName(viewer.role as Role, viewer.id, String(caseDoc.doctorId), viewer.roles)
  ) {
    return '';
  }
  return caseDoc.doctorEmail;
}

function staffDoctorLabel(caseDoc: Pick<ICase, 'doctorDisplayId'>): string {
  return caseDoc.doctorDisplayId || 'Doctor';
}

function personNameForViewer(
  personId: string | null | undefined,
  personName: string | null | undefined,
  caseDoc: Pick<ICase, 'doctorId' | 'doctorName' | 'doctorDisplayId'>,
  viewer?: DoctorViewer,
): string | null {
  if (!personId || personId !== String(caseDoc.doctorId)) return personName ?? null;
  return doctorNameForViewer(caseDoc, viewer);
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

function nestedToPlain<T extends Record<string, unknown>>(value: unknown, empty: T): T {
  if (!value || typeof value !== 'object') return { ...empty };
  const rec = value as { toObject?: (opts?: object) => Record<string, unknown> };
  const raw =
    typeof rec.toObject === 'function'
      ? rec.toObject({ flattenMaps: true, versionKey: false })
      : { ...(value as Record<string, unknown>) };
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (key.startsWith('$') || key === '_id' || key === '__v' || key === '_doc') continue;
    cleaned[key] = val;
  }
  return { ...empty, ...cleaned };
}

function normalizeTreatmentInstructions(
  input?: Partial<TreatmentInstructions> | null,
): TreatmentInstructions {
  const plain = nestedToPlain(input, { ...EMPTY_TREATMENT_INSTRUCTIONS });
  return {
    arches: (plain.arches as TreatmentInstructions['arches']) || '',
    applianceType: plain.applianceType?.trim() ?? '',
    treatmentGoal: plain.treatmentGoal?.trim() ?? '',
    biteDetails: plain.biteDetails?.trim() ?? '',
    retainers: plain.retainers?.trim() ?? '',
    specialRequirements: plain.specialRequirements?.trim() ?? '',
    additionalNotes: plain.additionalNotes?.trim() ?? '',
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

function slaSnapshot(caseDoc: ICase) {
  const slaHours = caseDoc.slaHours ?? null;
  const slaDeadlineAt = caseDoc.slaDeadlineAt ? caseDoc.slaDeadlineAt.toISOString() : null;
  if (!caseDoc.submittedAt || !caseDoc.slaDeadlineAt) {
    return {
      slaHours,
      slaDeadlineAt,
      slaUtilizationPercent: null as number | null,
      slaProgressColor: null as ReturnType<typeof slaProgressColor> | null,
    };
  }
  const slaUtilizationPercent = computeSlaUtilization(
    caseDoc.submittedAt,
    caseDoc.slaDeadlineAt,
  );
  return {
    slaHours,
    slaDeadlineAt,
    slaUtilizationPercent,
    slaProgressColor: slaProgressColor(slaUtilizationPercent),
  };
}

async function toListItem(
  caseDoc: ICase,
  viewer?: { id: string; role: string; roles?: string[] },
): Promise<CaseListItemDto> {
  const openClarificationCount = await countOpenClarifications(caseDoc._id as Types.ObjectId);
  const clarificationButtonState = await getClarificationButtonStateForCase(
    caseDoc._id as Types.ObjectId,
  );
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
  const doctorName = doctorNameForViewer(caseDoc, viewer);
  const doctorEmail = doctorEmailForViewer(caseDoc, viewer);

  return {
    id: caseDoc.id,
    caseId: caseDoc.caseId,
    patientName: caseDoc.patientName,
    patientAge: caseDoc.patientAge ?? null,
    doctorId: String(caseDoc.doctorId),
    doctorName,
    doctorDisplayId,
    doctorEmail,
    organizationId: caseDoc.organizationId ? String(caseDoc.organizationId) : null,
    facilityId: caseDoc.facilityId ? String(caseDoc.facilityId) : null,
    corporateCustomerId: caseDoc.corporateCustomerId ?? null,
    status: caseDoc.status,
    priority: caseDoc.priority,
    caseCategory: caseDoc.caseCategory ?? null,
    caseType: caseDoc.caseType ?? null,
    chiefComplaint: caseDoc.chiefComplaint || caseDoc.treatmentSummary || '',
    treatmentSummary: caseDoc.treatmentSummary,
    paymentStatus: caseDoc.payment?.status ?? PAYMENT_STATUSES.NOT_BILLED,
    submittedAt: caseDoc.submittedAt ? caseDoc.submittedAt.toISOString() : null,
    ...slaSnapshot(caseDoc),
    cancelWindowRemainingSeconds:
      caseDoc.status === CASE_STATUSES.NEW_CASE
        ? remainingCancelWindowSeconds(caseDoc.submittedAt ?? caseDoc.createdAt)
        : null,
    openClarificationCount,
    clarificationButtonState,
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
    isDemo: Boolean(caseDoc.isDemo),
    invoiceId: caseDoc.invoiceId ? String(caseDoc.invoiceId) : null,
    previousStatus: caseDoc.statusPendingDoctorAck
      ? (caseDoc.previousStatusForAck ?? null)
      : null,
    statusPendingDoctorAck: Boolean(caseDoc.statusPendingDoctorAck),
    country: caseDoc.country || '',
    countryId: caseDoc.countryId ? String(caseDoc.countryId) : null,
    regionId: caseDoc.regionId ? String(caseDoc.regionId) : null,
    createdAt: caseDoc.createdAt.toISOString(),
    cutRequired: Boolean(caseDoc.cutRequired),
    cutPhase: (caseDoc.cutPhase ?? CUT_PHASES.NONE) as CutPhase,
    cutAssignmentMode: (caseDoc.cutAssignmentMode ??
      CUT_ASSIGNMENT_MODES.NONE) as CutAssignmentMode,
    assignedCutOperatorId: caseDoc.assignedCutOperatorId
      ? String(caseDoc.assignedCutOperatorId)
      : null,
    assignedCutOperatorName: caseDoc.assignedCutOperatorName ?? null,
    workflowLabel: getCaseWorkflowLabel(
      caseDoc.status,
      (caseDoc.cutPhase ?? CUT_PHASES.NONE) as CutPhase,
    ),
    updatedAt: caseDoc.updatedAt.toISOString(),
  };
}

function mapCutRevisions(caseDoc: ICase): CutRevisionDto[] {
  return (caseDoc.cutRevisions ?? []).map((revision) => ({
    id: String(revision._id),
    revision: revision.revision,
    reason: revision.reason,
    comments: revision.comments,
    requestedById: String(revision.requestedById),
    requestedByName: revision.requestedByName,
    requestedByRole: revision.requestedByRole,
    requestedAt: revision.requestedAt.toISOString(),
    completedAt: revision.completedAt ? revision.completedAt.toISOString() : null,
  }));
}

function mapClinicalRemarks(caseDoc: ICase, viewer?: DoctorViewer): ClinicalRemarkDto[] {
  return (caseDoc.clinicalRemarks ?? []).map((remark) => ({
    id: String(remark._id),
    body: remark.body,
    indicator: remark.indicator,
    authorId: String(remark.authorId),
    authorName:
      personNameForViewer(String(remark.authorId), remark.authorName, caseDoc, viewer) ??
      remark.authorName,
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

function mapHistory(caseDoc: ICase, viewer?: DoctorViewer): CaseHistoryDto[] {
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
      actorName: personNameForViewer(
        entry.actorId ? String(entry.actorId) : null,
        entry.actorName ?? null,
        caseDoc,
        viewer,
      ),
      createdAt: entry.createdAt.toISOString(),
      metadata,
      changes,
    };
  });
}

async function toDetail(
  caseDoc: ICase,
  viewer?: { id: string; role: string; roles?: string[] },
): Promise<CaseDetailDto> {
  const [listItem, clarifications, validation] = await Promise.all([
    toListItem(caseDoc, viewer),
    listClarificationDtosForCase(caseDoc._id as Types.ObjectId, viewer, {
      doctorDisplayId: caseDoc.doctorDisplayId,
    }),
    buildValidationSummary(caseDoc),
  ]);

  return {
    ...listItem,
    clinicName: caseDoc.clinicName,
    practiceName: caseDoc.practiceName || caseDoc.clinicName || '',
    patientGender: caseDoc.patientGender,
    patientDateOfBirth: caseDoc.patientDateOfBirth
      ? caseDoc.patientDateOfBirth.toISOString().slice(0, 10)
      : null,
    instructions: caseDoc.instructions,
    treatmentInstructions: normalizeTreatmentInstructions(caseDoc.treatmentInstructions),
    recordsNumbering: nestedToPlain(caseDoc.recordsNumbering, { ...EMPTY_RECORDS_NUMBERING }),
    clinicalPreferences: nestedToPlain(caseDoc.clinicalPreferences, {
      ...EMPTY_CLINICAL_PREFERENCES,
    }),
    occlusionGoals: nestedToPlain(caseDoc.occlusionGoals, { ...EMPTY_OCCLUSION_GOALS }),
    prosthoDetails: nestedToPlain(caseDoc.prosthoDetails, { ...EMPTY_PROSTHO_DETAILS }),
    implantDetails: nestedToPlain(caseDoc.implantDetails, { ...EMPTY_IMPLANT_DETAILS }),
    commercial: nestedToPlain(caseDoc.commercial, { ...EMPTY_CASE_COMMERCIAL }),
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
    clinicalRemarks: mapClinicalRemarks(caseDoc, viewer),
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
      authorName:
        personNameForViewer(String(note.authorId), note.authorName, caseDoc, viewer) ??
        note.authorName,
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
      viewUrl: file.viewUrl || null,
      extractedFrom: file.extractedFrom || null,
      uploadedById: file.uploadedById ? String(file.uploadedById) : null,
      uploadedByName:
        personNameForViewer(
          file.uploadedById ? String(file.uploadedById) : null,
          file.uploadedByName,
          caseDoc,
          viewer,
        ) ?? file.uploadedByName,
      version: file.version || 1,
      createdAt: file.createdAt.toISOString(),
      note: file.note,
      scanStatus: file.scanStatus,
      scanMessage: file.scanMessage,
      ...toLifecycleDto(file, file.createdAt),
    })),
    history: mapHistory(caseDoc, viewer),
    timeline: buildCaseTimeline(caseDoc.status),
    cutStartedAt: caseDoc.cutStartedAt ? caseDoc.cutStartedAt.toISOString() : null,
    cutSubmittedAt: caseDoc.cutSubmittedAt ? caseDoc.cutSubmittedAt.toISOString() : null,
    cutCompletedAt: caseDoc.cutCompletedAt ? caseDoc.cutCompletedAt.toISOString() : null,
    cutNotes: caseDoc.cutNotes || '',
    cutInternalComments: (caseDoc.cutInternalComments ?? []).map((comment) => ({
      id: String(comment._id),
      body: comment.body,
      authorName: comment.authorName,
      createdAt: comment.createdAt.toISOString(),
    })),
    cutRevisions: mapCutRevisions(caseDoc),
    clarifications,
  };
}

function actorHasCutAccess(actor: CaseActor): boolean {
  return (
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_CUT) ||
    actor.role === 'cut_operator' ||
    (actor.roles ?? []).includes('cut_operator')
  );
}

function isCutCaseVisibleToOperator(actor: CaseActor, caseDoc: ICase): boolean {
  if (!actorHasCutAccess(actor) || caseDoc.isDeleted) return false;
  if (caseDoc.assignedCutOperatorId && String(caseDoc.assignedCutOperatorId) === actor.id) {
    return true;
  }
  return (
    caseDoc.cutAssignmentMode === CUT_ASSIGNMENT_MODES.AUTO_QUEUE &&
    !caseDoc.assignedCutOperatorId &&
    (caseDoc.cutPhase === CUT_PHASES.CUT_QUEUE ||
      caseDoc.cutPhase === CUT_PHASES.CUT_REWORK)
  );
}

function assertCanViewCase(actor: CaseActor, caseDoc: ICase) {
  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL)) return;

  if (
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ORG) &&
    actor.organizationId &&
    caseDoc.organizationId &&
    String(caseDoc.organizationId) === actor.organizationId
  ) {
    return;
  }

  if (
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_FACILITY) &&
    actor.facilityId &&
    caseDoc.facilityId &&
    String(caseDoc.facilityId) === actor.facilityId
  ) {
    return;
  }

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
      caseDoc.status === CASE_STATUSES.IN_PROCESS
    ) {
      return;
    }
  }

  if (isCutCaseVisibleToOperator(actor, caseDoc)) {
    return;
  }

  if (
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_QC_REVIEW) &&
    !caseDoc.isDeleted &&
    (caseDoc.status === CASE_STATUSES.IN_PROCESS ||
      caseDoc.status === CASE_STATUSES.WAITING_FOR_APPROVAL ||
      caseDoc.status === CASE_STATUSES.APPROVED ||
      Boolean(caseDoc.escalatedForOversight))
  ) {
    return;
  }

  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_CONSULT) && !caseDoc.isDeleted) {
    if (Boolean(caseDoc.escalatedForOversight)) return;
    if (caseDoc.assignedConsultantId && String(caseDoc.assignedConsultantId) === actor.id) {
      return;
    }
    if (caseDoc.status === CASE_STATUSES.IN_PROCESS) return;
    if ((caseDoc.clinicalRemarks?.length ?? 0) > 0) return;
  }

  throw new AppError('You do not have permission to view this case', 403);
}

export function assertCanResumeDraft(actor: CaseActor, caseDoc: ICase) {
  assertCanViewCase(actor, caseDoc);

  const isOwner = String(caseDoc.doctorId) === actor.id;
  const canCreate = permissionsInclude(actor.permissions, PERMISSIONS.CASE_CREATE);
  const canUpdate = permissionsInclude(actor.permissions, PERMISSIONS.CASE_UPDATE);
  const isAdmin =
    actor.role === ROLES.ADMIN || Boolean(actor.roles?.includes(ROLES.ADMIN));

  if (!isOwner && !canCreate && !canUpdate && !isAdmin) {
    throw new AppError('You do not have permission to resume this draft', 403);
  }
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

  if (
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ORG) &&
    actor.organizationId
  ) {
    clauses.push({ organizationId: new Types.ObjectId(actor.organizationId) });
  }

  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_FACILITY)) {
    if (actor.facilityId) {
      clauses.push({ facilityId: new Types.ObjectId(actor.facilityId) });
    } else if (
      actor.organizationId &&
      actor.assignedCountry &&
      !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ORG)
    ) {
      // Country-scoped without a fixed facility: filter by matching facility ids at query time
      // via a marker that listCases will expand — see enrichCountryFacilityFilter.
      clauses.push({
        organizationId: new Types.ObjectId(actor.organizationId),
        __countryScope: actor.assignedCountry,
      });
    }
  }

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
          CASE_STATUSES.IN_PROCESS,
          CASE_STATUSES.IN_PROCESS,
          CASE_STATUSES.IN_PROCESS,
        ],
      },
      isDeleted: false,
    });
  }

  if (actorHasCutAccess(actor)) {
    clauses.push({ assignedCutOperatorId: new Types.ObjectId(actor.id), isDeleted: false });
    clauses.push({
      cutAssignmentMode: CUT_ASSIGNMENT_MODES.AUTO_QUEUE,
      $or: [
        { assignedCutOperatorId: { $exists: false } },
        { assignedCutOperatorId: null },
      ],
      cutPhase: { $in: [CUT_PHASES.CUT_QUEUE, CUT_PHASES.CUT_REWORK] },
      isDeleted: false,
    });
  }

  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_QC_REVIEW)) {
    clauses.push({
      status: {
        $in: [
          CASE_STATUSES.IN_PROCESS,
          CASE_STATUSES.IN_PROCESS,
          CASE_STATUSES.APPROVED,
          CASE_STATUSES.WAITING_FOR_APPROVAL,
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
      status: CASE_STATUSES.IN_PROCESS,
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

async function resolveVisibilityFilter(actor: CaseActor): Promise<Record<string, unknown>> {
  const raw = buildVisibilityFilter(actor);
  return expandCountryScopeFilter(raw);
}

async function expandCountryScopeFilter(
  filter: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (filter.$or && Array.isArray(filter.$or)) {
    const next = [];
    for (const clause of filter.$or as Record<string, unknown>[]) {
      next.push(await expandCountryScopeFilter(clause));
    }
    return { $or: next };
  }

  if (typeof filter.__countryScope === 'string') {
    const country = filter.__countryScope;
    const organizationId = filter.organizationId;
    const { Facility } = await import('../../models/Facility');
    const facilities = await Facility.find({
      organizationId,
      country: new RegExp(`^${escapeRegex(country)}$`, 'i'),
      status: 'active',
    }).select('_id');
    const ids = facilities.map((f) => f._id);
    return {
      organizationId,
      facilityId: { $in: ids },
    };
  }

  return filter;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function detectCategory(
  originalName: string,
  mimeType: string,
  explicit?: string,
  fromArchive = false,
): FileCategory {
  return classifyUploadFile(originalName, mimeType, { explicit, fromArchive });
}

function pushCaseFile(
  caseDoc: ICase,
  input: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    category: FileCategory;
    actor: CaseActor;
    note?: string;
    viewUrl?: string;
    extractedFrom?: string;
    scanStatus?: 'skipped' | 'clean' | 'infected' | 'error';
    scanMessage?: string;
  },
) {
  const sameNameCount = caseDoc.files.filter(
    (existing) => existing.originalName === input.originalName,
  ).length;
  const createdAt = new Date();
  const hot = initialHotFields(createdAt);
  caseDoc.files.unshift({
    _id: new Types.ObjectId(),
    filename: input.originalName.replace(/[^a-zA-Z0-9._-]/g, '_'),
    originalName: input.originalName,
    mimeType: input.mimeType || 'application/octet-stream',
    sizeBytes: input.sizeBytes,
    category: input.category,
    storageKey: input.storageKey,
    viewUrl: input.viewUrl,
    extractedFrom: input.extractedFrom,
    uploadedById: new Types.ObjectId(input.actor.id),
    uploadedByName: actorName(input.actor),
    version: sameNameCount + 1,
    note: input.note?.trim() || undefined,
    createdAt,
    scanStatus: input.scanStatus ?? 'skipped',
    scanMessage: input.scanMessage,
    storageTier: hot.storageTier,
    restoreStatus: hot.restoreStatus,
    hotUntil: hot.hotUntil,
  } as ICase['files'][number]);
}

export async function listCases(
  actor: CaseActor,
  query: {
    page?: number;
    pageSize?: number;
    status?: CaseStatus;
    priority?: CasePriority;
    q?: string;
    caseCategory?: string;
    caseType?: string;
    caseId?: string;
    patient?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    includeDeleted?: boolean;
    isDemo?: boolean;
    countryId?: string;
    regionId?: string;
  },
): Promise<CaseListResult> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const visibility = await resolveVisibilityFilter(actor);
  const conditions: Record<string, unknown>[] = [visibility];

  if (!query.includeDeleted || !permissionsInclude(actor.permissions, PERMISSIONS.CASE_DELETE)) {
    conditions.push({ isDeleted: false });
  }

  if (query.status) conditions.push({ status: query.status });
  if (query.priority) conditions.push({ priority: query.priority });
  if (query.caseCategory) conditions.push({ caseCategory: query.caseCategory });
  if (query.caseType) conditions.push({ caseType: query.caseType });
  if (query.caseId?.trim()) {
    conditions.push({ caseId: { $regex: query.caseId.trim(), $options: 'i' } });
  }
  if (query.patient?.trim()) {
    const patientTerm = query.patient.trim();
    conditions.push({
      $or: [
        { patientName: { $regex: patientTerm, $options: 'i' } },
        { caseId: { $regex: patientTerm, $options: 'i' } },
      ],
    });
  }
  if (query.isDemo === true) conditions.push({ isDemo: true });
  if (query.isDemo === false) conditions.push({ isDemo: { $ne: true } });
  if (query.countryId?.trim()) {
    const geo = await resolveCountryGeo({ countryId: query.countryId.trim() });
    const countryClause: Record<string, unknown>[] = [{ countryId: query.countryId.trim() }];
    if (geo.country) {
      countryClause.push({ country: new RegExp(`^${escapeRegex(geo.country)}$`, 'i') });
    }
    conditions.push({ $or: countryClause });
  }
  if (query.regionId?.trim()) {
    const { Country } = await import('../../models/Settings');
    const inRegion = await Country.find({ regionId: query.regionId.trim() }).select('_id name');
    conditions.push({
      $or: [
        { regionId: query.regionId.trim() },
        { countryId: { $in: inRegion.map((item) => item._id) } },
        { country: { $in: inRegion.map((item) => item.name) } },
      ],
    });
  }

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

  const allowedSort = new Set([
    'createdAt',
    'updatedAt',
    'caseId',
    'patientName',
    'status',
    'caseCategory',
    'caseType',
  ]);
  const sortField = query.sortBy && allowedSort.has(query.sortBy) ? query.sortBy : 'createdAt';
  const sortDir = query.sortDir === 'asc' ? 1 : -1;

  const [items, total] = await Promise.all([
    Case.find(filter)
      .sort({ [sortField]: sortDir })
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

export async function getDoctorCaseSummary(actor: CaseActor): Promise<{
  generatedAt: string;
  total: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  pendingStatusAckCount: number;
}> {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_OWN)) {
    throw new AppError('You do not have permission to view the doctor summary', 403);
  }

  const visibility = await resolveVisibilityFilter(actor);
  const filter = { $and: [visibility, { isDeleted: false }] };

  const [docs, pendingStatusAckCount] = await Promise.all([
    Case.find(filter).select('caseCategory caseType').lean(),
    Case.countDocuments({
      $and: [visibility, { isDeleted: false, statusPendingDoctorAck: true }],
    }),
  ]);

  const byCategory: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const doc of docs) {
    const cat = doc.caseCategory || 'unknown';
    const typ = doc.caseType || 'unknown';
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    byType[typ] = (byType[typ] ?? 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    total: docs.length,
    byCategory,
    byType,
    pendingStatusAckCount,
  };
}

export async function acknowledgeCaseStatus(
  actor: CaseActor,
  caseIdOrMongoId: string,
  audit?: RequestAuditContext,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (String(caseDoc.doctorId) !== actor.id && !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL)) {
    throw new AppError('Only the case doctor can acknowledge status updates', 403);
  }

  if (!caseDoc.statusPendingDoctorAck) {
    return await toDetail(caseDoc, actor);
  }

  caseDoc.statusPendingDoctorAck = false;
  caseDoc.previousStatusForAck = undefined;
  pushHistory(caseDoc, {
    action: 'status_acknowledged',
    summary: 'Doctor acknowledged updated case status',
    actor,
  });
  await caseDoc.save();
  await Case.updateOne(
    { _id: caseDoc._id },
    { $unset: { previousStatusForAck: 1 }, $set: { statusPendingDoctorAck: false } },
  );

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_UPDATE,
    summary: `${actor.email} acknowledged status for case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return await toDetail(caseDoc, actor);
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

export async function findCase(caseIdOrMongoId: string) {
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

  if (
    actor.organizationId &&
    doctor.organizationId &&
    String(doctor.organizationId) !== actor.organizationId &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL)
  ) {
    throw new AppError('Doctor is outside your organization', 403);
  }

  if (
    actor.facilityId &&
    doctor.facilityId &&
    String(doctor.facilityId) !== actor.facilityId &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ORG) &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL)
  ) {
    throw new AppError('Doctor is outside your facility', 403);
  }

  let priority = input.priority ?? CASE_PRIORITIES.NORMAL;
  if (
    priority === CASE_PRIORITIES.URGENT &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_SET_PRIORITY)
  ) {
    priority = CASE_PRIORITIES.NORMAL;
  }

  const asDraft = Boolean(input.asDraft);
  const now = new Date();
  const status = asDraft ? CASE_STATUSES.SAVED_FOR_SUBMISSION : CASE_STATUSES.NEW_CASE;
  const submittedAt = asDraft ? undefined : now;

  const {
    evaluateCreateEligibility,
    resolveCasePricing,
    debitPrepaidForCase,
    redeemDiscountCode,
  } = await import('../commercial/pricingBilling.service');
  const { DEMO_CASE_MESSAGES } = await import('@ayetis/shared');

  let isDemo = Boolean(input.isDemo);
  let resolvedCommercial = { ...EMPTY_CASE_COMMERCIAL, ...(input.commercial ?? {}) };
  let paymentStatus: string = PAYMENT_STATUSES.NOT_BILLED;
  let eligibilityReason: string | null = null;

  if (!asDraft && resolvedCommercial.treatmentPlanId) {
    const pricing = await resolveCasePricing({
      treatmentPlanId: resolvedCommercial.treatmentPlanId,
      discountCode: resolvedCommercial.discountCode,
      customerUserId: String(doctor._id),
      organizationId: doctor.organizationId ? String(doctor.organizationId) : null,
      caseCategory: input.caseCategory ?? CASE_CATEGORIES.DIGITAL_ALIGNER,
    });
    if (pricing.isFreeDemoPlan) isDemo = true;
    resolvedCommercial = {
      ...resolvedCommercial,
      treatmentPlanId: pricing.treatmentPlanId,
      treatmentPlanName: pricing.treatmentPlanName,
      unitPrice: pricing.unitPrice,
      discountCode: pricing.discountCode ?? '',
      discountAmount: pricing.discountAmount,
      finalPayableAmount: isDemo ? 0 : pricing.finalPayableAmount,
      currency: pricing.currency,
    };

    if (!input.paymentSessionId) {
      const eligibility = await evaluateCreateEligibility({
        userId: String(doctor._id),
        treatmentPlanId: pricing.treatmentPlanId,
        discountCode: pricing.discountCode,
        isDemo,
        caseCategory: input.caseCategory ?? CASE_CATEGORIES.DIGITAL_ALIGNER,
      });
      eligibilityReason = eligibility.reason;
      if (!eligibility.allowedWithoutPayment) {
        throw new AppError(
          'Payment is required before this case can be created. Create a payment session first.',
          402,
        );
      }
      if (eligibility.reason === 'invoice_schedule') {
        paymentStatus = PAYMENT_STATUSES.PENDING;
      } else if (eligibility.reason === 'prepaid' || eligibility.reason === 'zero_amount' || eligibility.reason === 'demo') {
        paymentStatus = eligibility.reason === 'prepaid' ? PAYMENT_STATUSES.PAID : PAYMENT_STATUSES.WAIVED;
      }
    } else {
      paymentStatus = PAYMENT_STATUSES.PAID;
    }
  }

  const slaHours = isDemo
    ? DEMO_CASE_MESSAGES.slaBusinessHours
    : await resolveSlaHoursForUser(doctor);

  const caseId = await generateCaseId();

  let facilityObjectId = doctor.facilityId || undefined;
  if (input.facilityId) {
    const { Facility } = await import('../../models/Facility');
    const facility = await Facility.findById(input.facilityId);
    if (!facility) throw new AppError('Facility not found', 404);
    const doctorOrg = doctor.organizationId ? String(doctor.organizationId) : null;
    if (doctorOrg && String(facility.organizationId) !== doctorOrg) {
      throw new AppError('Facility does not belong to the doctor organization', 400);
    }
    if (
      actor.organizationId &&
      String(facility.organizationId) !== actor.organizationId &&
      !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL)
    ) {
      throw new AppError('Facility is outside your organization', 403);
    }
    facilityObjectId = facility._id;
  } else if (!facilityObjectId && actor.facilityId) {
    facilityObjectId = new Types.ObjectId(actor.facilityId);
  }

  if (!asDraft && doctor.organizationId && !facilityObjectId) {
    throw new AppError('Select a facility for this corporate case', 400);
  }

  const patientName =
    (input.patientName ?? '').trim() || (asDraft ? 'Untitled draft' : '');
  const treatmentSummary =
    (input.treatmentSummary ?? '').trim() ||
    (input.chiefComplaint ?? '').trim() ||
    (asDraft ? 'Draft' : '');

  const geo = await resolveCountryGeo({
    countryId: input.countryId,
    countryName: input.country,
  });

  const caseDoc = new Case({
    caseId,
    doctorId: doctor._id,
    doctorName: `${doctor.firstName} ${doctor.lastName}`.trim(),
    doctorDisplayId: doctor.doctorId,
    doctorEmail: doctor.email,
    organizationId: doctor.organizationId || undefined,
    facilityId: facilityObjectId,
    corporateCustomerId: doctor.corporateCustomerId || actor.corporateCustomerId || undefined,
    caseCategory: input.caseCategory ?? CASE_CATEGORIES.DIGITAL_ALIGNER,
    caseType: input.caseType ?? CASE_TYPES.NEW,
    chiefComplaint: input.chiefComplaint?.trim() || treatmentSummary,
    practiceName: input.practiceName?.trim() || input.clinicName?.trim() || '',
    patientDateOfBirth: input.patientDateOfBirth ? new Date(input.patientDateOfBirth) : undefined,
    patientName,
    patientAge: input.patientAge ?? undefined,
    patientGender: input.patientGender?.trim() ?? '',
    clinicName: input.clinicName?.trim() ?? '',
    country: geo.country,
    countryId: geo.countryId,
    regionId: geo.regionId,
    treatmentSummary,
    instructions: input.instructions?.trim() ?? '',
    treatmentInstructions: normalizeTreatmentInstructions(input.treatmentInstructions),
    recordsNumbering: { ...EMPTY_RECORDS_NUMBERING, ...(input.recordsNumbering ?? {}) },
    clinicalPreferences: { ...EMPTY_CLINICAL_PREFERENCES, ...(input.clinicalPreferences ?? {}) },
    occlusionGoals: { ...EMPTY_OCCLUSION_GOALS, ...(input.occlusionGoals ?? {}) },
    prosthoDetails: { ...EMPTY_PROSTHO_DETAILS, ...(input.prosthoDetails ?? {}) },
    implantDetails: { ...EMPTY_IMPLANT_DETAILS, ...(input.implantDetails ?? {}) },
    commercial: resolvedCommercial,
    payment: {
      status: paymentStatus as never,
      currency: resolvedCommercial.currency || 'USD',
      amountDue: resolvedCommercial.finalPayableAmount ?? resolvedCommercial.unitPrice ?? null,
      amountPaid:
        paymentStatus === PAYMENT_STATUSES.PAID
          ? (resolvedCommercial.finalPayableAmount ?? 0)
          : null,
      invoiceNumber: '',
      notes: eligibilityReason === 'invoice_schedule' ? `Billing: ${eligibilityReason}` : '',
    },
    isDemo,
    paymentSessionId: input.paymentSessionId || undefined,
    assignmentMode: ASSIGNMENT_MODES.NONE,
    status,
    priority,
    submittedAt,
    slaHours: asDraft ? undefined : slaHours,
    slaDeadlineAt: asDraft || !submittedAt ? undefined : computeSlaDeadline(submittedAt, slaHours),
    notes: [],
    files: [],
    history: [],
  });

  pushHistory(caseDoc, {
    action: 'created',
    summary: asDraft ? `Draft ${caseId} saved` : `Case ${caseId} submitted`,
    actor,
    metadata: {
      changes: [
        {
          field: 'status',
          label: CASE_FIELD_LABELS.status,
          from: null,
          to: status,
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

  if (!asDraft && eligibilityReason === 'prepaid') {
    await debitPrepaidForCase(String(doctor._id), caseDoc.id, actor.email);
  }

  if (!asDraft && resolvedCommercial.discountCode && !input.paymentSessionId) {
    await redeemDiscountCode(resolvedCommercial.discountCode);
  }

  if (!asDraft && isDemo) {
    await recordActivity({
      action: AUDIT_ACTIONS.DEMO_CASE_CREATE,
      summary: `${actor.email} created demo case ${caseId}`,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetType: 'case',
      targetId: caseId,
      metadata: { message: DEMO_CASE_MESSAGES.confirmation },
      ipAddress: audit?.ipAddress,
      userAgent: audit?.userAgent,
    });
  }

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_CREATE,
    summary: `${actor.email} created case ${caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseId,
    metadata: { mongoId: caseDoc.id, patientName: caseDoc.patientName, isDemo },
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
    body: `${staffDoctorLabel(caseDoc)} submitted ${caseDoc.patientName} for review.`,
    link: `/app/cases/${caseId}`,
    caseId,
  });
  await emailUsers(intakeStaffIds, {
    subject: `New case submitted: ${caseId}`,
    headline: 'New case submitted',
    message: `${staffDoctorLabel(caseDoc)} submitted a new case for ${caseDoc.patientName}.`,
    caseId,
    patientName: caseDoc.patientName,
  });

  return await toDetail(caseDoc, actor);
}

export async function updateDraftCase(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: CreateCaseInput,
  audit?: RequestAuditContext,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  if (!caseDoc) {
    throw new AppError('Case not found', 404);
  }

  if (caseDoc.isDeleted) {
    throw new AppError('Cannot edit a deleted case', 400);
  }

  if (caseDoc.status !== CASE_STATUSES.SAVED_FOR_SUBMISSION) {
    throw new AppError('Only draft cases can be edited or submitted through the draft workflow', 400);
  }

  assertCanResumeDraft(actor, caseDoc);

  const asDraft = Boolean(input.asDraft);
  if (!asDraft) {
    const { assertCanSubmitWork } = await import('../users/users.service');
    await assertCanSubmitWork(actor.id);
  }
  const now = new Date();

  const doctor = await User.findById(caseDoc.doctorId);
  if (!doctor || !doctor.isActive) {
    throw new AppError('Active doctor not found for this case', 404);
  }

  if (doctor.accountStatus !== 'active') {
    throw new AppError('Doctor account is not active', 403);
  }

  const patientName =
    (input.patientName ?? '').trim() ||
    caseDoc.patientName?.trim() ||
    (asDraft ? 'Untitled draft' : 'Patient');
  const treatmentSummary =
    (input.treatmentSummary ?? '').trim() ||
    (input.chiefComplaint ?? '').trim() ||
    caseDoc.treatmentSummary?.trim() ||
    (asDraft ? 'Draft' : 'Case summary');

  caseDoc.patientName = patientName;
  caseDoc.treatmentSummary = treatmentSummary;
  if (input.patientAge !== undefined) caseDoc.patientAge = input.patientAge ?? undefined;
  if (input.patientGender !== undefined) caseDoc.patientGender = input.patientGender?.trim() ?? '';
  if (input.patientDateOfBirth !== undefined) {
    caseDoc.patientDateOfBirth = input.patientDateOfBirth ? new Date(input.patientDateOfBirth) : undefined;
  }
  if (input.clinicName !== undefined) caseDoc.clinicName = input.clinicName?.trim() ?? '';
  if (input.practiceName !== undefined) {
    caseDoc.practiceName = input.practiceName?.trim() || input.clinicName?.trim() || caseDoc.clinicName || '';
  }

  const countryProvided = input.country !== undefined;
  const isCountryChanged =
    countryProvided &&
    (input.country ?? '').trim().toLowerCase() !== (caseDoc.country ?? '').trim().toLowerCase();

  const geo = await resolveCountryGeo({
    countryId: isCountryChanged
      ? input.countryId
      : input.countryId || (caseDoc.countryId ? String(caseDoc.countryId) : undefined),
    countryName: countryProvided ? input.country : caseDoc.country,
  });
  caseDoc.country = geo.country;
  caseDoc.countryId = geo.countryId;
  caseDoc.regionId = geo.regionId;

  if (input.priority !== undefined && input.priority) {
    let nextPriority = input.priority;
    if (
      nextPriority === CASE_PRIORITIES.URGENT &&
      !permissionsInclude(actor.permissions, PERMISSIONS.CASE_SET_PRIORITY)
    ) {
      nextPriority = caseDoc.priority;
    }
    caseDoc.priority = nextPriority;
  }

  if (input.caseCategory !== undefined) caseDoc.caseCategory = input.caseCategory ?? caseDoc.caseCategory;
  if (input.caseType !== undefined) caseDoc.caseType = input.caseType ?? caseDoc.caseType;
  if (input.chiefComplaint !== undefined) caseDoc.chiefComplaint = input.chiefComplaint?.trim() ?? '';
  if (input.instructions !== undefined) caseDoc.instructions = input.instructions?.trim() ?? '';

  if (input.treatmentInstructions !== undefined) {
    caseDoc.treatmentInstructions = normalizeTreatmentInstructions(input.treatmentInstructions);
  }
  if (input.recordsNumbering !== undefined) {
    caseDoc.recordsNumbering = { ...EMPTY_RECORDS_NUMBERING, ...(input.recordsNumbering ?? {}) };
  }
  if (input.clinicalPreferences !== undefined) {
    caseDoc.clinicalPreferences = { ...EMPTY_CLINICAL_PREFERENCES, ...(input.clinicalPreferences ?? {}) };
  }
  if (input.occlusionGoals !== undefined) {
    caseDoc.occlusionGoals = { ...EMPTY_OCCLUSION_GOALS, ...(input.occlusionGoals ?? {}) };
  }
  if (input.prosthoDetails !== undefined) {
    caseDoc.prosthoDetails = { ...EMPTY_PROSTHO_DETAILS, ...(input.prosthoDetails ?? {}) };
  }
  if (input.implantDetails !== undefined) {
    caseDoc.implantDetails = { ...EMPTY_IMPLANT_DETAILS, ...(input.implantDetails ?? {}) };
  }

  let facilityObjectId = caseDoc.facilityId;
  if (input.facilityId) {
    const { Facility } = await import('../../models/Facility');
    const facility = await Facility.findById(input.facilityId);
    if (!facility) throw new AppError('Facility not found', 404);
    facilityObjectId = facility._id;
  }
  if (!asDraft && doctor.organizationId && !facilityObjectId) {
    throw new AppError('Select a facility for this corporate case', 400);
  }
  caseDoc.facilityId = facilityObjectId;

  const {
    evaluateCreateEligibility,
    resolveCasePricing,
    debitPrepaidForCase,
    redeemDiscountCode,
  } = await import('../commercial/pricingBilling.service');
  const { DEMO_CASE_MESSAGES } = await import('@ayetis/shared');

  let isDemo = Boolean(input.isDemo ?? caseDoc.isDemo);
  let resolvedCommercial = { ...EMPTY_CASE_COMMERCIAL, ...(input.commercial ?? caseDoc.commercial ?? {}) };
  let paymentStatus: string = caseDoc.payment?.status || PAYMENT_STATUSES.NOT_BILLED;
  let eligibilityReason: string | null = null;

  if (!asDraft && resolvedCommercial.treatmentPlanId) {
    const pricing = await resolveCasePricing({
      treatmentPlanId: resolvedCommercial.treatmentPlanId,
      discountCode: resolvedCommercial.discountCode,
      customerUserId: String(doctor._id),
      organizationId: doctor.organizationId ? String(doctor.organizationId) : null,
      caseCategory: caseDoc.caseCategory,
    });
    if (pricing.isFreeDemoPlan) isDemo = true;
    resolvedCommercial = {
      ...resolvedCommercial,
      treatmentPlanId: pricing.treatmentPlanId,
      treatmentPlanName: pricing.treatmentPlanName,
      unitPrice: pricing.unitPrice,
      discountCode: pricing.discountCode ?? '',
      discountAmount: pricing.discountAmount,
      finalPayableAmount: isDemo ? 0 : pricing.finalPayableAmount,
      currency: pricing.currency,
    };

    if (!input.paymentSessionId) {
      const eligibility = await evaluateCreateEligibility({
        userId: String(doctor._id),
        treatmentPlanId: pricing.treatmentPlanId,
        discountCode: pricing.discountCode,
        isDemo,
        caseCategory: caseDoc.caseCategory,
      });
      eligibilityReason = eligibility.reason;
      if (!eligibility.allowedWithoutPayment) {
        throw new AppError(
          'Payment is required before this case can be submitted. Create a payment session first.',
          402,
        );
      }
      if (eligibility.reason === 'invoice_schedule') {
        paymentStatus = PAYMENT_STATUSES.PENDING;
      } else if (eligibility.reason === 'prepaid' || eligibility.reason === 'zero_amount' || eligibility.reason === 'demo') {
        paymentStatus = eligibility.reason === 'prepaid' ? PAYMENT_STATUSES.PAID : PAYMENT_STATUSES.WAIVED;
      }
    } else {
      paymentStatus = PAYMENT_STATUSES.PAID;
    }
  }

  caseDoc.commercial = resolvedCommercial;
  caseDoc.isDemo = isDemo;
  if (input.paymentSessionId) {
    caseDoc.paymentSessionId = new Types.ObjectId(input.paymentSessionId);
  }

  if (caseDoc.payment) {
    caseDoc.payment.currency = resolvedCommercial.currency || caseDoc.payment.currency || 'USD';
    caseDoc.payment.amountDue = resolvedCommercial.finalPayableAmount ?? resolvedCommercial.unitPrice ?? caseDoc.payment.amountDue;
    caseDoc.payment.status = paymentStatus as never;
    if (paymentStatus === PAYMENT_STATUSES.PAID && caseDoc.payment.amountPaid == null) {
      caseDoc.payment.amountPaid = resolvedCommercial.finalPayableAmount ?? 0;
    }
  }

  if (!asDraft) {
    const slaHours = isDemo
      ? DEMO_CASE_MESSAGES.slaBusinessHours
      : await resolveSlaHoursForUser(doctor);
    caseDoc.status = CASE_STATUSES.NEW_CASE;
    caseDoc.submittedAt = now;
    caseDoc.slaHours = slaHours;
    caseDoc.slaDeadlineAt = computeSlaDeadline(now, slaHours);

    pushHistory(caseDoc, {
      action: 'status_changed',
      summary: `Case ${caseDoc.caseId} submitted`,
      actor,
      metadata: {
        changes: [
          {
            field: 'status',
            label: CASE_FIELD_LABELS.status,
            from: CASE_STATUSES.SAVED_FOR_SUBMISSION,
            to: CASE_STATUSES.NEW_CASE,
          },
        ] satisfies CaseHistoryChange[],
      },
    });

    if (eligibilityReason === 'prepaid') {
      await debitPrepaidForCase(String(doctor._id), caseDoc.id, actor.email);
    }
    if (resolvedCommercial.discountCode && !input.paymentSessionId) {
      await redeemDiscountCode(resolvedCommercial.discountCode);
    }
  } else {
    pushHistory(caseDoc, {
      action: 'updated',
      summary: `Draft ${caseDoc.caseId} updated`,
      actor,
    });
  }

  await caseDoc.save();

  await recordActivity({
    action: asDraft ? AUDIT_ACTIONS.CASE_UPDATE : AUDIT_ACTIONS.CASE_CREATE,
    summary: `${actor.email} ${asDraft ? 'updated draft' : 'submitted'} case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { mongoId: caseDoc.id, patientName: caseDoc.patientName, isDemo },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  if (!asDraft) {
    const intakeStaffIds = await findUserIdsByRoles([
      ROLES.COORDINATOR,
      ROLES.SUPERVISOR,
      ROLES.ADMIN,
    ]);
    await createNotificationsForUsers(intakeStaffIds, {
      type: NOTIFICATION_TYPES.CASE_SUBMITTED,
      title: `New case submitted: ${caseDoc.caseId}`,
      body: `${staffDoctorLabel(caseDoc)} submitted ${caseDoc.patientName} for review.`,
      link: `/app/cases/${caseDoc.caseId}`,
      caseId: caseDoc.caseId,
    });
    await emailUsers(intakeStaffIds, {
      subject: `New case submitted: ${caseDoc.caseId}`,
      headline: 'New case submitted',
      message: `${staffDoctorLabel(caseDoc)} submitted a new case for ${caseDoc.patientName}.`,
      caseId: caseDoc.caseId,
      patientName: caseDoc.patientName,
    });
  }

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
    'patientDateOfBirth',
    'clinicName',
    'practiceName',
    'country',
    'chiefComplaint',
    'caseCategory',
    'caseType',
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

  if (input.country !== undefined || input.countryId !== undefined) {
    const geo = await resolveCountryGeo({
      countryId: input.countryId,
      countryName: caseDoc.country,
    });
    caseDoc.country = geo.country;
    caseDoc.countryId = geo.countryId;
    caseDoc.regionId = geo.regionId;
  }

  if (input.treatmentInstructions) {
    const previous = normalizeTreatmentInstructions(caseDoc.treatmentInstructions);
    const next = normalizeTreatmentInstructions({
      ...previous,
      ...input.treatmentInstructions,
    });
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      caseDoc.set('treatmentInstructions', next);
      caseDoc.markModified('treatmentInstructions');
      changes.push({
        field: 'treatmentInstructions',
        label: 'Treatment instructions',
        from: previous,
        to: next,
      });
    }
  }

  if (input.recordsNumbering) {
    const previous = { ...EMPTY_RECORDS_NUMBERING, ...(caseDoc.recordsNumbering ?? {}) };
    const next = { ...previous, ...input.recordsNumbering };
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      caseDoc.recordsNumbering = next;
      changes.push({
        field: 'recordsNumbering',
        label: 'Records & numbering',
        from: previous,
        to: next,
      });
    }
  }

  if (input.clinicalPreferences) {
    const previous = { ...EMPTY_CLINICAL_PREFERENCES, ...(caseDoc.clinicalPreferences ?? {}) };
    const next = { ...previous, ...input.clinicalPreferences };
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      caseDoc.clinicalPreferences = next;
      changes.push({
        field: 'clinicalPreferences',
        label: 'Clinical preferences',
        from: previous,
        to: next,
      });
    }
  }

  if (input.occlusionGoals) {
    const previous = { ...EMPTY_OCCLUSION_GOALS, ...(caseDoc.occlusionGoals ?? {}) };
    const next = { ...previous, ...input.occlusionGoals };
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      caseDoc.occlusionGoals = next;
      changes.push({
        field: 'occlusionGoals',
        label: 'Occlusion goals',
        from: previous,
        to: next,
      });
    }
  }

  if (input.prosthoDetails) {
    const previous = { ...EMPTY_PROSTHO_DETAILS, ...(caseDoc.prosthoDetails ?? {}) };
    const next = { ...previous, ...input.prosthoDetails };
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      caseDoc.prosthoDetails = next;
      changes.push({
        field: 'prosthoDetails',
        label: 'Prosthodontic details',
        from: previous,
        to: next,
      });
    }
  }

  if (input.implantDetails) {
    const previous = { ...EMPTY_IMPLANT_DETAILS, ...(caseDoc.implantDetails ?? {}) };
    const next = { ...previous, ...input.implantDetails };
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      caseDoc.implantDetails = next;
      changes.push({
        field: 'implantDetails',
        label: 'Implant details',
        from: previous,
        to: next,
      });
    }
  }

  if (input.commercial) {
    const previous = { ...EMPTY_CASE_COMMERCIAL, ...(caseDoc.commercial ?? {}) };
    const next = { ...previous, ...input.commercial };
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      caseDoc.commercial = next;
      if (caseDoc.payment) {
        caseDoc.payment.currency = next.currency || caseDoc.payment.currency;
        caseDoc.payment.amountDue = next.finalPayableAmount ?? next.unitPrice ?? caseDoc.payment.amountDue;
      }
      changes.push({
        field: 'commercial',
        label: 'Commercial',
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
  remarks?: string,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  const isDoctorSelf =
    actor.role === ROLES.DOCTOR && String(caseDoc.doctorId) === actor.id;
  const canCancel =
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_DELETE) ||
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_UPDATE) ||
    isDoctorSelf;

  if (!canCancel) {
    throw new AppError('You do not have permission to cancel cases', 403);
  }

  if (caseDoc.isDeleted) {
    throw new AppError('Cannot cancel a deleted case', 400);
  }

  if (caseDoc.status === CASE_STATUSES.CANCELLED) {
    throw new AppError('Case is already cancelled', 400);
  }

  const isWindowCancel =
    caseDoc.status === CASE_STATUSES.NEW_CASE &&
    isWithinCancelWindow(caseDoc.submittedAt ?? caseDoc.createdAt);

  // URD: 15-minute cancellation window for New Case (doctor path highly critical).
  // Staff with CASE_DELETE may force-cancel outside the window (still audited).
  if (isDoctorSelf || !permissionsInclude(actor.permissions, PERMISSIONS.CASE_DELETE)) {
    if (caseDoc.status !== CASE_STATUSES.NEW_CASE || !isWindowCancel) {
      throw new AppError(
        `Cases can only be cancelled within ${CASE_CANCEL_WINDOW_MINUTES} minutes of submission while status is New Case.`,
        403,
      );
    }
  }

  const from = caseDoc.status;
  const remaining = remainingCancelWindowSeconds(caseDoc.submittedAt ?? caseDoc.createdAt);
  const caseValue =
    caseDoc.payment?.amountPaid ??
    caseDoc.payment?.amountDue ??
    caseDoc.commercial?.finalPayableAmount ??
    0;
  const refundAmount = Number(caseValue) > 0 ? Number(caseValue) : 0;
  const refundStatus =
    refundAmount > 0 ? REFUND_STATUSES.PENDING : REFUND_STATUSES.NOT_APPLICABLE;
  const remarksTrimmed = remarks?.trim() || undefined;

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
      remarks: remarksTrimmed,
      remainingWindowSeconds: remaining,
    },
  });

  await caseDoc.save();

  const { CancellationAudit } = await import('../../models/CancellationAudit');
  const { summarizeDevice } = await import('../cancellations/cancellations.service');
  let paymentTransactionReference: string | undefined;
  if (caseDoc.paymentSessionId) {
    const { PaymentSession } = await import('../../models/Commercial');
    const session = await PaymentSession.findById(caseDoc.paymentSessionId);
    paymentTransactionReference =
      session?.stripeSessionId ||
      session?.stripePaymentIntentId ||
      session?.bankReference ||
      undefined;
  }
  if (!paymentTransactionReference && caseDoc.payment?.notes) {
    paymentTransactionReference = caseDoc.payment.notes.slice(0, 200);
  }

  await CancellationAudit.create({
    caseMongoId: caseDoc._id,
    caseId: caseDoc.caseId,
    patientId: caseDoc.caseId,
    patientName: caseDoc.patientName,
    doctorUserId: caseDoc.doctorId,
    doctorName: caseDoc.doctorName,
    doctorDisplayId: caseDoc.doctorDisplayId,
    coordinatorId: caseDoc.validatedById,
    coordinatorName: caseDoc.validatedByName,
    organizationId: caseDoc.organizationId,
    companyName: caseDoc.practiceName || caseDoc.clinicName,
    facilityId: caseDoc.facilityId,
    caseCategory: caseDoc.caseCategory,
    caseType: caseDoc.caseType,
    treatmentPlanName: caseDoc.commercial?.treatmentPlanName,
    caseValue: refundAmount,
    currency: caseDoc.payment?.currency || caseDoc.commercial?.currency || 'USD',
    invoiceNumber: caseDoc.payment?.invoiceNumber,
    paymentStatus: caseDoc.payment?.status,
    refundAmount,
    refundStatus,
    cancellationReason: reason.trim(),
    cancellationRemarks: remarksTrimmed,
    statusAtCancellation: from,
    submittedAt: caseDoc.submittedAt ?? caseDoc.createdAt,
    cancelledAt: new Date(),
    remainingWindowSeconds: remaining,
    cancelledById: actor.id,
    cancelledByName: actorName(actor),
    cancelledByEmail: actor.email,
    cancelledByRole: actor.role,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    deviceSummary: summarizeDevice(audit?.userAgent) || undefined,
    paymentTransactionReference,
  });

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_CANCEL,
    summary: `${actor.email} cancelled case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { reason: reason.trim(), remainingWindowSeconds: remaining, refundStatus },
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
  const extractedNotes: string[] = [];

  for (const file of files) {
    if (
      !isAllowedUploadFilename(file.originalname) &&
      !file.mimetype.startsWith('image/') &&
      !file.mimetype.startsWith('video/')
    ) {
      throw new AppError(
        `Unsupported file type: ${file.originalname}. Allowed: STL, OBJ, PLY, DICOM, images, OPG/CBCT, PDF, video, ZIP/RAR/7Z, HTML.`,
        400,
      );
    }

    // URD §7.1: compresssed uploads are extracted; members are stored (not the archive).
    if (isArchiveFilename(file.originalname)) {
      if (!file.path) {
        throw new AppError('Archive upload requires disk-backed temp storage', 400);
      }
      const { members, cleanup } = await extractArchiveMembers({
        archivePath: file.path,
        originalName: file.originalname,
      });
      try {
        for (const member of members) {
          const scan = await scanUploadedFile(member.tempPath, member.originalName);
          const category = detectCategory(
            member.originalName,
            member.mimeType,
            options.category,
            true,
          );
          const { storageKey } = await persistUploadedFile({
            caseId: caseDoc.caseId,
            originalName: member.originalName,
            mimeType: member.mimeType,
            tempPath: member.tempPath,
          });
          pushCaseFile(caseDoc, {
            originalName: member.originalName,
            mimeType: member.mimeType,
            sizeBytes: member.sizeBytes,
            storageKey,
            category,
            actor,
            note: options.note?.trim() || undefined,
            extractedFrom: file.originalname,
            scanStatus: scan.status,
            scanMessage: scan.message,
          });
          uploadedNames.push(member.originalName);
        }
        extractedNotes.push(
          `${file.originalname} → ${members.length} file${members.length === 1 ? '' : 's'}`,
        );
      } finally {
        await cleanup();
        // remove multer temp for the archive itself
        await fs.promises.unlink(file.path).catch(() => undefined);
      }
      continue;
    }

    const scan = await scanUploadedFile(file.path, file.originalname);
    const category = detectCategory(file.originalname, file.mimetype, options.category);
    const { storageKey } = await persistUploadedFile({
      caseId: caseDoc.caseId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      tempPath: file.path,
    });

    pushCaseFile(caseDoc, {
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      sizeBytes: file.size,
      storageKey,
      category,
      actor,
      note: options.note?.trim() || undefined,
      scanStatus: scan.status,
      scanMessage: scan.message,
    });
    uploadedNames.push(file.originalname);
  }

  pushHistory(caseDoc, {
    action: extractedNotes.length ? 'archive_extracted' : 'file_uploaded',
    summary:
      extractedNotes.length > 0
        ? `Extracted ${extractedNotes.join('; ')}`
        : uploadedNames.length === 1
          ? `Uploaded file: ${uploadedNames[0]}`
          : `Uploaded ${uploadedNames.length} files`,
    actor,
    metadata: {
      files: uploadedNames,
      category: options.category,
      archives: extractedNotes,
    },
  });

  await caseDoc.save();

  await recordActivity({
    action: extractedNotes.length ? AUDIT_ACTIONS.CASE_FILE_EXTRACT : AUDIT_ACTIONS.CASE_FILE_UPLOAD,
    summary: `${actor.email} uploaded ${uploadedNames.length} file(s) to case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { files: uploadedNames, archives: extractedNotes },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return await toDetail(caseDoc, actor);
}

export async function attachCaseViewerLink(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: { url: string; label?: string; note?: string },
  audit?: RequestAuditContext,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanUploadFiles(actor, caseDoc);
  if (caseDoc.isDeleted) {
    throw new AppError('Cannot attach links to a deleted case', 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(input.url.trim());
  } catch {
    throw new AppError('Enter a valid absolute URL (https://…)', 400);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AppError('Viewer link must use http or https', 400);
  }

  const label = (input.label?.trim() || parsed.hostname || 'Viewer link').slice(0, 160);
  const url = parsed.toString();

  pushCaseFile(caseDoc, {
    originalName: label,
    mimeType: 'text/uri-list',
    sizeBytes: 0,
    storageKey: `link:${new Types.ObjectId().toHexString()}`,
    category: FILE_CATEGORIES.HTML_LINK,
    actor,
    note: input.note?.trim() || undefined,
    viewUrl: url,
  });

  pushHistory(caseDoc, {
    action: 'viewer_link_attached',
    summary: `Attached viewer link: ${label}`,
    actor,
    metadata: { url, label },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_FILE_LINK,
    summary: `${actor.email} attached viewer link on case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { url, label },
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
  if (!file) {
    throw new AppError('File not found', 404);
  }

  if (file.category === FILE_CATEGORIES.HTML_LINK || file.viewUrl) {
    throw new AppError(
      'This is a viewer link — open the URL instead of downloading',
      400,
    );
  }

  if (!file.storageKey || file.storageKey.startsWith('link:')) {
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
    (caseDoc.status === CASE_STATUSES.WAITING_FOR_APPROVAL ||
      caseDoc.status === CASE_STATUSES.APPROVED)
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
  if (
    caseDoc.status === CASE_STATUSES.WAITING_FOR_APPROVAL ||
    caseDoc.status === CASE_STATUSES.APPROVED
  ) {
    throw new AppError('Case has already been delivered to the doctor', 400);
  }
  if (caseDoc.submittedToQcAt && !caseDoc.qcRejectionCount) {
    throw new AppError('Case is already in the QC queue', 400);
  }
  const openClarifications = await countOpenClarifications(caseDoc._id as Types.ObjectId);
  if (openClarifications > 0) {
    throw new AppError('Resolve clarifications before starting production', 400);
  }

  caseDoc.status = CASE_STATUSES.IN_PROCESS
  caseDoc.productionStartedAt = new Date();
  caseDoc.productionStartedById = new Types.ObjectId(actor.id);
  caseDoc.productionStartedByName = actorName(actor);
  if (input.notes?.trim()) {
    caseDoc.productionNotes = input.notes.trim();
  }

  if (caseDoc.cutPhase === CUT_PHASES.WAITING_FOR_DESIGNER) {
    caseDoc.cutPhase = CUT_PHASES.CUT_COMPLETE;
    caseDoc.cutCompletedAt = new Date();
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
  if (caseDoc.status === CASE_STATUSES.NEW_CASE || caseDoc.status === CASE_STATUSES.SAVED_FOR_SUBMISSION) {
    caseDoc.status = CASE_STATUSES.IN_PROCESS;
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
  if (
    caseDoc.status === CASE_STATUSES.WAITING_FOR_APPROVAL ||
    caseDoc.status === CASE_STATUSES.APPROVED
  ) {
    throw new AppError('Case has already been delivered to the doctor', 400);
  }
  if (caseDoc.submittedToQcAt && !(caseDoc.qcRejectionCount ?? 0)) {
    return await toDetail(caseDoc, actor);
  }
  const openForQc = await countOpenClarifications(caseDoc._id as Types.ObjectId);
  if (openForQc > 0) {
    throw new AppError('Resolve clarifications before submitting to QC', 400);
  }

  if (input.notes?.trim()) {
    caseDoc.productionNotes = input.notes.trim();
  }

  const isResubmit = (caseDoc.qcRejectionCount ?? 0) > 0;

  caseDoc.status = CASE_STATUSES.IN_PROCESS;
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
    summary: `${actor.email} ${isResubmit ? 'resubmitted' : 'new_case'} case ${caseDoc.caseId} to QC`,
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

function assertCanQcReview(actor: CaseActor, caseDoc?: ICase) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_QC_REVIEW)) {
    throw new AppError('You do not have permission to perform QC review', 403);
  }
  if (!caseDoc) return;
  const designerId = caseDoc.assignedDesignerId
    ? String(caseDoc.assignedDesignerId)
    : null;
  const check = canQcCase(actor.qcScope ?? QC_SCOPES.NONE, {
    actorId: actor.id,
    designerId,
  });
  if (!check.allowed) {
    throw new AppError(check.reason || 'QC not allowed for this case', 403);
  }
}

function toQcQueueCaseDto(caseDoc: ICase, viewer: DoctorViewer): QcQueueCaseDto {
  return {
    id: caseDoc.id,
    caseId: caseDoc.caseId,
    patientName: caseDoc.patientName,
    doctorName: doctorNameForViewer(caseDoc, viewer),
    designerName: caseDoc.assignedDesignerName ?? null,
    status: caseDoc.status,
    priority: caseDoc.priority,
    treatmentSummary: caseDoc.treatmentSummary,
    qcRejectionCount: caseDoc.qcRejectionCount ?? 0,
    escalatedForOversight: Boolean(caseDoc.escalatedForOversight),
    submittedToQcAt: caseDoc.submittedToQcAt ? caseDoc.submittedToQcAt.toISOString() : null,
    fileCount: caseDoc.files?.length ?? 0,
    ...slaSnapshot(caseDoc),
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
    templateKey?: string;
  },
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  const users = await User.find({ _id: { $in: unique }, isActive: { $ne: false } }).select(
    'email firstName lastName',
  );
  await Promise.all(
    users.map((user) => {
      const recipientName = `${user.firstName} ${user.lastName}`.trim() || user.email;
      const portalUrl = `${env.clientUrl}/app/cases/${input.caseId}`;
      const patientLine = input.patientName ? ` (${input.patientName})` : '';
      return sendCmsOrFallback(
        user.email,
        input.templateKey ?? EMAIL_TEMPLATE_KEYS.CASE_EVENT,
        {
          recipientName,
          subject: input.subject,
          headline: input.headline,
          caseId: input.caseId,
          patientLine,
          patientName: input.patientName ?? '',
          message: input.message,
          portalUrl,
        },
        caseEventTemplate({
          recipientName,
          subject: input.subject,
          headline: input.headline,
          message: input.message,
          caseId: input.caseId,
          patientName: input.patientName,
          portalUrl,
          ctaLabel: input.ctaLabel,
        }),
      ).catch(() => undefined);
    }),
  );
}

export async function getQcDashboard(actor: CaseActor): Promise<QcDashboardDto> {
  assertCanQcReview(actor);

  const [pending, escalated] = await Promise.all([
    Case.find({
      isDeleted: false,
      status: CASE_STATUSES.IN_PROCESS,
    })
      .sort({ priority: -1, submittedToQcAt: 1, updatedAt: 1 })
      .limit(100),
    Case.find({
      isDeleted: false,
      escalatedForOversight: true,
      status: { $nin: [CASE_STATUSES.CANCELLED, CASE_STATUSES.APPROVED] },
    })
      .sort({ escalatedAt: -1, updatedAt: -1 })
      .limit(50),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    pendingCount: pending.length,
    escalatedCount: escalated.length,
    items: pending.map((doc) => toQcQueueCaseDto(doc, actor)),
    escalatedItems: escalated.map((doc) => toQcQueueCaseDto(doc, actor)),
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
    status: { $nin: [CASE_STATUSES.CANCELLED, CASE_STATUSES.APPROVED] },
  })
    .sort({ escalatedAt: -1, updatedAt: -1 })
    .limit(100);

  return cases.map((doc) => toQcQueueCaseDto(doc, actor));
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
  assertCanQcReview(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot review a deleted case', 400);
  if (caseDoc.status !== CASE_STATUSES.IN_PROCESS || !caseDoc.submittedToQcAt) {
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
  assertCanQcReview(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot approve a deleted case', 400);
  if (caseDoc.status !== CASE_STATUSES.IN_PROCESS || !caseDoc.submittedToQcAt) {
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

  caseDoc.status = CASE_STATUSES.WAITING_FOR_APPROVAL;
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
    const deliveryNote = [
      deliveryVideoStorageKey ? 'A video explanation is available.' : '',
      deliveryViewLink ? 'A view link is available.' : '',
    ]
      .filter(Boolean)
      .join(' ');
    await sendCmsOrFallback(
      caseDoc.doctorEmail,
      EMAIL_TEMPLATE_KEYS.CASE_DELIVERED,
      {
        doctorName: caseDoc.doctorName,
        caseId: caseDoc.caseId,
        patientName: caseDoc.patientName,
        deliveryNote,
        portalUrl,
      },
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

export async function updateCaseDelivery(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: { viewLink?: string },
  videoFile?: Express.Multer.File,
  audit?: RequestAuditContext,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  const canQc = permissionsInclude(actor.permissions, PERMISSIONS.CASE_QC_REVIEW);
  const canConsult = permissionsInclude(actor.permissions, PERMISSIONS.CASE_CONSULT);
  if (!canQc && !canConsult) {
    throw new AppError('You do not have permission to update the delivery package', 403);
  }
  if (canQc && !canConsult) {
    assertCanQcReview(actor, caseDoc);
  }
  if (caseDoc.isDeleted) throw new AppError('Cannot update delivery on a deleted case', 400);

  const existing = caseDoc.delivery;
  const viewLink =
    input.viewLink !== undefined ? input.viewLink.trim() : existing?.viewLink || '';
  let videoFilename = existing?.videoFilename;
  let videoStorageKey = existing?.videoStorageKey;
  const uploadedAt = new Date();
  let hot = existing
    ? {
        storageTier: existing.storageTier,
        restoreStatus: existing.restoreStatus,
        hotUntil: existing.hotUntil,
      }
    : initialHotFields(uploadedAt);

  if (videoFile) {
    const saved = await persistUploadedFile({
      caseId: caseDoc.caseId,
      originalName: videoFile.originalname,
      mimeType: videoFile.mimetype,
      buffer: videoFile.buffer,
      tempPath: videoFile.path,
    });
    videoFilename = videoFile.originalname;
    videoStorageKey = saved.storageKey;
    hot = initialHotFields(uploadedAt);
  }

  if (!viewLink && !videoStorageKey) {
    throw new AppError('Provide a view link or a delivery video', 400);
  }

  caseDoc.delivery = {
    viewLink,
    videoFilename,
    videoStorageKey,
    uploadedAt,
    uploadedById: new Types.ObjectId(actor.id),
    uploadedByName: actorName(actor),
    storageTier: hot.storageTier,
    restoreStatus: hot.restoreStatus,
    hotUntil: hot.hotUntil,
    coldSince: videoFile ? undefined : existing?.coldSince,
    lastAccessedAt: existing?.lastAccessedAt,
    restoreRequestedAt: videoFile ? undefined : existing?.restoreRequestedAt,
    restoreError: videoFile ? undefined : existing?.restoreError,
  };
  caseDoc.markModified('delivery');

  pushHistory(caseDoc, {
    action: 'delivery_updated',
    summary: `${actorName(actor)} updated the delivery package`,
    actor,
    metadata: {
      hasLink: Boolean(viewLink),
      hasVideo: Boolean(videoStorageKey),
      videoReplaced: Boolean(videoFile),
    },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_UPDATE,
    summary: `${actor.email} updated delivery for ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { viewLink: viewLink || undefined, hasVideo: Boolean(videoStorageKey) },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

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
  assertCanQcReview(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot reject a deleted case', 400);
  if (caseDoc.status !== CASE_STATUSES.IN_PROCESS || !caseDoc.submittedToQcAt) {
    throw new AppError('Only cases in QC or consultant review can be rejected', 400);
  }

  const comments = input.comments.trim();
  const requiredChanges = input.requiredChanges.trim();
  if (!comments) throw new AppError('Comments are required', 400);
  if (!requiredChanges) throw new AppError('Required changes are required', 400);

  const nextCount = (caseDoc.qcRejectionCount ?? 0) + 1;
  caseDoc.qcRejectionCount = nextCount;
  caseDoc.status = CASE_STATUSES.IN_PROCESS;
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
      caseDoc.status === CASE_STATUSES.WAITING_FOR_APPROVAL
    ) {
      completedCases += 1;
    }
    if (
      caseDoc.status === CASE_STATUSES.IN_PROCESS
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
  caseDoc.set('treatmentInstructions', next);
  caseDoc.markModified('treatmentInstructions');

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

  if (caseDoc.status === CASE_STATUSES.NEW_CASE) {
    caseDoc.status = CASE_STATUSES.IN_PROCESS;
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
  if (caseDoc.status === CASE_STATUSES.IN_PROCESS) {
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

  if (caseDoc.status === CASE_STATUSES.NEW_CASE) {
    caseDoc.status = CASE_STATUSES.IN_PROCESS;
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
  if (!caseDoc.validatedAt) {
    throw new AppError('Validate the case before assigning', 400);
  }

  const openClarifications = await countOpenClarifications(caseDoc._id as Types.ObjectId);
  if (openClarifications > 0) {
    throw new AppError('Cannot assign while waiting for doctor clarification', 400);
  }

  const isDesignerHandoff = caseDoc.cutPhase === CUT_PHASES.WAITING_FOR_DESIGNER;
  const isCutAssignMode = input.mode === 'cut_operator' || input.mode === 'cut_auto_queue';
  const allowInProcessAssign =
    isDesignerHandoff ||
    isCutAssignMode ||
    (!caseDoc.assignedDesignerId &&
      !caseDoc.productionStartedAt &&
      !caseDoc.cutRequired &&
      caseDoc.cutPhase === CUT_PHASES.NONE);

  if (caseDoc.status === CASE_STATUSES.IN_PROCESS && !allowInProcessAssign) {
    throw new AppError('Cannot assign while case is in process', 400);
  }

  if (input.mode === 'designer') {
    if (!input.designerId) {
      throw new AppError('designerId is required when assigning to a designer', 400);
    }
    const designer = await User.findById(input.designerId);
    const designerRoles = [
      designer?.primaryRole || designer?.role,
      ...(designer?.roles ?? []),
    ].filter(Boolean) as string[];
    const isDesignerLike =
      designerRoles.includes(ROLES.DESIGNER) || designerRoles.includes('senior_designer');
    if (!designer || !designer.isActive || !isDesignerLike) {
      throw new AppError('Active designer not found', 404);
    }

    caseDoc.assignmentMode = ASSIGNMENT_MODES.DESIGNER;
    caseDoc.assignedDesignerId = designer._id as Types.ObjectId;
    caseDoc.assignedDesignerName = `${designer.firstName} ${designer.lastName}`.trim();
    caseDoc.status = CASE_STATUSES.IN_PROCESS;

    pushHistory(caseDoc, {
      action: 'assigned',
      summary: `Assigned to designer ${caseDoc.assignedDesignerName}`,
      actor,
      metadata: { designerId: designer.id, note: input.note?.trim() || undefined },
    });
  } else if (input.mode === 'auto_queue') {
    const { assignCaseByRules } = await import('../rbac/rbac.service');
    const matchedId = await assignCaseByRules(
      {
        country: caseDoc.country || '',
        countryId: caseDoc.countryId ? String(caseDoc.countryId) : null,
        regionId: caseDoc.regionId ? String(caseDoc.regionId) : null,
      },
      ASSIGNMENT_QUEUES.DESIGNER,
    );

    if (matchedId) {
      const designer = await User.findById(matchedId);
      if (designer) {
        caseDoc.assignmentMode = ASSIGNMENT_MODES.DESIGNER;
        caseDoc.assignedDesignerId = designer._id as Types.ObjectId;
        caseDoc.assignedDesignerName = `${designer.firstName} ${designer.lastName}`.trim();
        caseDoc.status = CASE_STATUSES.IN_PROCESS;
        pushHistory(caseDoc, {
          action: 'assigned',
          summary: `Auto-assigned to ${caseDoc.assignedDesignerName} by rules`,
          actor,
          metadata: {
            mode: 'auto_rules',
            designerId: designer.id,
            note: input.note?.trim() || undefined,
          },
        });
      } else {
        caseDoc.assignmentMode = ASSIGNMENT_MODES.AUTO_QUEUE;
        caseDoc.assignedDesignerId = undefined;
        caseDoc.assignedDesignerName = undefined;
        caseDoc.status = CASE_STATUSES.IN_PROCESS;
        pushHistory(caseDoc, {
          action: 'assigned',
          summary: 'Sent to auto case-pick queue',
          actor,
          metadata: { mode: 'auto_queue', note: input.note?.trim() || undefined },
        });
      }
    } else {
      caseDoc.assignmentMode = ASSIGNMENT_MODES.AUTO_QUEUE;
      caseDoc.assignedDesignerId = undefined;
      caseDoc.assignedDesignerName = undefined;
      caseDoc.status = CASE_STATUSES.IN_PROCESS;

      pushHistory(caseDoc, {
        action: 'assigned',
        summary: 'Sent to auto case-pick queue',
        actor,
        metadata: { mode: 'auto_queue', note: input.note?.trim() || undefined },
      });
    }
  } else if (input.mode === 'cut_operator') {
    if (!input.cutOperatorId) {
      throw new AppError('cutOperatorId is required when assigning to a cut operator', 400);
    }
    const operator = await User.findById(input.cutOperatorId);
    const operatorRoles = [
      operator?.primaryRole || operator?.role,
      ...(operator?.roles ?? []),
    ].filter(Boolean) as string[];
    if (
      !operator ||
      !operator.isActive ||
      !operatorRoles.includes('cut_operator')
    ) {
      throw new AppError('Active cut operator not found', 404);
    }

    caseDoc.cutRequired = input.cutRequired !== false;
    caseDoc.cutPhase = CUT_PHASES.CUT_ASSIGNED;
    caseDoc.cutAssignmentMode = CUT_ASSIGNMENT_MODES.OPERATOR;
    caseDoc.assignedCutOperatorId = operator._id as Types.ObjectId;
    caseDoc.assignedCutOperatorName = `${operator.firstName} ${operator.lastName}`.trim();
    caseDoc.status = CASE_STATUSES.IN_PROCESS;

    pushHistory(caseDoc, {
      action: 'cut_assigned',
      summary: `Assigned to cut operator ${caseDoc.assignedCutOperatorName}`,
      actor,
      metadata: {
        cutOperatorId: operator.id,
        note: input.note?.trim() || undefined,
      },
    });
  } else if (input.mode === 'cut_auto_queue') {
    caseDoc.cutRequired = input.cutRequired !== false;
    caseDoc.cutAssignmentMode = CUT_ASSIGNMENT_MODES.AUTO_QUEUE;
    caseDoc.status = CASE_STATUSES.IN_PROCESS;

    const { assignCaseByRules } = await import('../rbac/rbac.service');
    const matchedId = await assignCaseByRules(
      {
        country: caseDoc.country || '',
        countryId: caseDoc.countryId ? String(caseDoc.countryId) : null,
        regionId: caseDoc.regionId ? String(caseDoc.regionId) : null,
      },
      ASSIGNMENT_QUEUES.CUT,
    );

    if (matchedId) {
      const operator = await User.findById(matchedId);
      if (operator) {
        caseDoc.cutPhase = CUT_PHASES.CUT_ASSIGNED;
        caseDoc.assignedCutOperatorId = operator._id as Types.ObjectId;
        caseDoc.assignedCutOperatorName = `${operator.firstName} ${operator.lastName}`.trim();
        pushHistory(caseDoc, {
          action: 'cut_assigned',
          summary: `Cut auto-assigned to ${caseDoc.assignedCutOperatorName} by rules`,
          actor,
          metadata: {
            mode: 'auto_rules',
            cutOperatorId: operator.id,
            note: input.note?.trim() || undefined,
          },
        });
      } else {
        caseDoc.cutPhase = CUT_PHASES.CUT_QUEUE;
        caseDoc.assignedCutOperatorId = undefined;
        caseDoc.assignedCutOperatorName = undefined;
        pushHistory(caseDoc, {
          action: 'cut_assigned',
          summary: 'Sent to cut auto case-pick queue',
          actor,
          metadata: { mode: 'cut_auto_queue', note: input.note?.trim() || undefined },
        });
      }
    } else {
      caseDoc.cutPhase = CUT_PHASES.CUT_QUEUE;
      caseDoc.assignedCutOperatorId = undefined;
      caseDoc.assignedCutOperatorName = undefined;
      pushHistory(caseDoc, {
        action: 'cut_assigned',
        summary: 'Sent to cut auto case-pick queue',
        actor,
        metadata: { mode: 'cut_auto_queue', note: input.note?.trim() || undefined },
      });
    }
  } else {
    throw new AppError('Invalid assignment mode', 400);
  }

  await caseDoc.save();

  const auditAction =
    input.mode === 'cut_operator' || input.mode === 'cut_auto_queue'
      ? AUDIT_ACTIONS.CASE_CUT_ASSIGN
      : AUDIT_ACTIONS.CASE_ASSIGN;

  await recordActivity({
    action: auditAction,
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
      cutOperatorId: input.cutOperatorId,
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
      templateKey: EMAIL_TEMPLATE_KEYS.CASE_ASSIGNED,
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
  } else if (input.mode === 'cut_operator' && caseDoc.assignedCutOperatorId) {
    const operatorId = String(caseDoc.assignedCutOperatorId);
    await createNotification({
      userId: operatorId,
      type: NOTIFICATION_TYPES.CASE_CUT_ASSIGNED,
      title: `Cut case assigned: ${caseDoc.caseId}`,
      body: `${actorName(actor)} assigned ${caseDoc.patientName} for cutting.`,
      link: `/app/cases/${caseDoc.caseId}`,
      caseId: caseDoc.caseId,
    });
    await emailUsers([operatorId], {
      subject: `Cut case assigned: ${caseDoc.caseId}`,
      headline: 'Cut case assigned to you',
      message: `${actorName(actor)} assigned case ${caseDoc.caseId} (${caseDoc.patientName}) for cutting.`,
      caseId: caseDoc.caseId,
      patientName: caseDoc.patientName,
      templateKey: EMAIL_TEMPLATE_KEYS.CASE_ASSIGNED,
    });
  } else if (input.mode === 'cut_auto_queue') {
    const operatorIds = await findUserIdsByRoles(['cut_operator']);
    await createNotificationsForUsers(operatorIds, {
      type: NOTIFICATION_TYPES.CASE_CUT_ASSIGNED,
      title: `Cut case in pick queue: ${caseDoc.caseId}`,
      body: `${caseDoc.patientName} is available in the cut auto case-pick queue.`,
      link: `/app/cases/${caseDoc.caseId}`,
      caseId: caseDoc.caseId,
    });
  }

  return await toDetail(caseDoc, actor);
}

async function toCutQueueCaseDto(
  caseDoc: ICase,
  viewer: DoctorViewer,
): Promise<CutQueueCaseDto> {
  const openClarificationCount = await countOpenClarifications(caseDoc._id as Types.ObjectId);
  return {
    id: caseDoc.id,
    caseId: caseDoc.caseId,
    patientName: caseDoc.patientName,
    doctorName: doctorNameForViewer(caseDoc, viewer),
    status: caseDoc.status,
    priority: caseDoc.priority,
    treatmentSummary: caseDoc.treatmentSummary,
    cutPhase: (caseDoc.cutPhase ?? CUT_PHASES.NONE) as CutPhase,
    cutAssignmentMode: (caseDoc.cutAssignmentMode ??
      CUT_ASSIGNMENT_MODES.NONE) as CutAssignmentMode,
    assignedCutOperatorName: caseDoc.assignedCutOperatorName ?? null,
    openClarificationCount,
    fileCount: caseDoc.files?.length ?? 0,
    cutStartedAt: caseDoc.cutStartedAt ? caseDoc.cutStartedAt.toISOString() : null,
    cutSubmittedAt: caseDoc.cutSubmittedAt ? caseDoc.cutSubmittedAt.toISOString() : null,
    createdAt: caseDoc.createdAt.toISOString(),
    updatedAt: caseDoc.updatedAt.toISOString(),
  };
}

function assertCanCutWork(actor: CaseActor, caseDoc: ICase) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_CUT)) {
    throw new AppError('You do not have permission to perform cut work', 403);
  }
  assertCanViewCase(actor, caseDoc);
  if (
    !caseDoc.assignedCutOperatorId ||
    String(caseDoc.assignedCutOperatorId) !== actor.id
  ) {
    throw new AppError('Only the assigned cut operator can update this case', 403);
  }
}

export async function listCutOperatorAssignees(
  actor: CaseActor,
): Promise<CutOperatorAssigneeDto[]> {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_ASSIGN)) {
    throw new AppError('You do not have permission to list cut operators', 403);
  }

  const operators = await User.find({
    $or: [{ role: 'cut_operator' }, { roles: 'cut_operator' }, { primaryRole: 'cut_operator' }],
    isActive: true,
  }).sort({ firstName: 1, lastName: 1 });

  return operators.map((operator) => ({
    id: operator.id,
    firstName: operator.firstName,
    lastName: operator.lastName,
    email: operator.email,
    isActive: operator.isActive,
  }));
}

export async function getCutDashboard(actor: CaseActor): Promise<CutDashboardDto> {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_CUT)) {
    throw new AppError('You do not have permission to view the cut dashboard', 403);
  }

  const operatorId = new Types.ObjectId(actor.id);
  const baseFilter = { isDeleted: false, cutRequired: true };

  const [assignedDocs, autoQueueDocs, inProgressDocs, operatorCases] = await Promise.all([
    Case.find({
      ...baseFilter,
      assignedCutOperatorId: operatorId,
      cutPhase: CUT_PHASES.CUT_ASSIGNED,
    }).sort({ priority: -1, updatedAt: 1 }),
    Case.find({
      ...baseFilter,
      cutAssignmentMode: CUT_ASSIGNMENT_MODES.AUTO_QUEUE,
      $or: [{ assignedCutOperatorId: { $exists: false } }, { assignedCutOperatorId: null }],
      cutPhase: { $in: [CUT_PHASES.CUT_QUEUE, CUT_PHASES.CUT_REWORK] },
    }).sort({ priority: -1, updatedAt: 1 }),
    Case.find({
      ...baseFilter,
      assignedCutOperatorId: operatorId,
      cutPhase: CUT_PHASES.CUT_IN_PROGRESS,
    }).sort({ cutStartedAt: 1, updatedAt: 1 }),
    Case.find({
      ...baseFilter,
      assignedCutOperatorId: operatorId,
    }).select('_id caseId'),
  ]);

  const operatorCaseIds = operatorCases.map((doc) => doc._id as Types.ObjectId);
  let pendingClarificationDocs: ICase[] = [];
  if (operatorCaseIds.length > 0) {
    const { Clarification } = await import('../../models/Clarification');
    const clarificationCaseIds = await Clarification.distinct('caseMongoId', {
      caseMongoId: { $in: operatorCaseIds },
      status: {
        $in: [
          CLARIFICATION_STATUSES.OPEN,
          CLARIFICATION_STATUSES.AWAITING_DOCTOR,
          CLARIFICATION_STATUSES.AWAITING_TEAM,
        ],
      },
    });
    if (clarificationCaseIds.length > 0) {
      pendingClarificationDocs = await Case.find({
        _id: { $in: clarificationCaseIds },
        assignedCutOperatorId: operatorId,
        isDeleted: false,
      }).sort({ updatedAt: -1 });
    }
  }

  const completedDocs = await Case.find({
    ...baseFilter,
    assignedCutOperatorId: operatorId,
    cutPhase: { $in: [CUT_PHASES.CUT_COMPLETE, CUT_PHASES.WAITING_FOR_DESIGNER] },
  }).sort({ cutSubmittedAt: -1, updatedAt: -1 });

  const waitingForDesignerDocs = await Case.find({
    ...baseFilter,
    assignedCutOperatorId: operatorId,
    cutPhase: CUT_PHASES.WAITING_FOR_DESIGNER,
  }).sort({ cutSubmittedAt: -1, updatedAt: -1 });

  const [
    assigned,
    autoQueue,
    inProgress,
    pendingClarification,
    completed,
    waitingForDesigner,
  ] = await Promise.all([
    Promise.all(assignedDocs.map((doc) => toCutQueueCaseDto(doc, actor))),
    Promise.all(autoQueueDocs.map((doc) => toCutQueueCaseDto(doc, actor))),
    Promise.all(inProgressDocs.map((doc) => toCutQueueCaseDto(doc, actor))),
    Promise.all(pendingClarificationDocs.map((doc) => toCutQueueCaseDto(doc, actor))),
    Promise.all(completedDocs.map((doc) => toCutQueueCaseDto(doc, actor))),
    Promise.all(waitingForDesignerDocs.map((doc) => toCutQueueCaseDto(doc, actor))),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    assigned,
    autoQueue,
    inProgress,
    pendingClarification,
    completed,
    waitingForDesigner,
    counts: {
      assigned: assigned.length,
      autoQueue: autoQueue.length,
      inProgress: inProgress.length,
      pendingClarification: pendingClarification.length,
      completed: completed.length,
      waitingForDesigner: waitingForDesigner.length,
    },
  };
}

export async function getCutPerformance(
  actor: CaseActor,
  query: { month?: string; view?: 'month' | 'quarter' } = {},
): Promise<CutPerformanceDto> {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_CUT_REPORT_VIEW)) {
    throw new AppError('You do not have permission to view cut performance', 403);
  }

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
  const operatorId = new Types.ObjectId(actor.id);

  const cases = await Case.find({
    isDeleted: false,
    assignedCutOperatorId: operatorId,
    cutRequired: true,
    $or: [
      { cutStartedAt: { $gte: range.start, $lt: range.end } },
      { cutSubmittedAt: { $gte: range.start, $lt: range.end } },
    ],
  }).select('cutStartedAt cutSubmittedAt cutPhase');

  let totalAssigned = 0;
  let totalCompleted = 0;
  let pending = 0;
  const completionHours: number[] = [];

  for (const caseDoc of cases) {
    const startedInPeriod =
      caseDoc.cutStartedAt &&
      caseDoc.cutStartedAt >= range.start &&
      caseDoc.cutStartedAt < range.end;
    const submittedInPeriod =
      caseDoc.cutSubmittedAt &&
      caseDoc.cutSubmittedAt >= range.start &&
      caseDoc.cutSubmittedAt < range.end;

    if (startedInPeriod) totalAssigned += 1;
    if (submittedInPeriod) {
      totalCompleted += 1;
      if (caseDoc.cutStartedAt && caseDoc.cutSubmittedAt) {
        completionHours.push(
          (caseDoc.cutSubmittedAt.getTime() - caseDoc.cutStartedAt.getTime()) / 3_600_000,
        );
      }
    }
    if (
      caseDoc.cutPhase === CUT_PHASES.CUT_IN_PROGRESS ||
      caseDoc.cutPhase === CUT_PHASES.CUT_ASSIGNED ||
      caseDoc.cutPhase === CUT_PHASES.CUT_REWORK
    ) {
      pending += 1;
    }
  }

  const { Clarification } = await import('../../models/Clarification');
  const clarificationsRaised = await Clarification.countDocuments({
    createdById: operatorId,
    createdAt: { $gte: range.start, $lt: range.end },
  });

  const averageCompletionHours =
    completionHours.length > 0
      ? Math.round(
          (completionHours.reduce((sum, value) => sum + value, 0) / completionHours.length) * 10,
        ) / 10
      : null;

  return {
    view,
    periodKey,
    periodLabel: range.label,
    availableMonths,
    totalAssigned,
    totalCompleted,
    averageCompletionHours,
    pending,
    clarificationsRaised,
  };
}

export async function startCutWork(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: StartCutInput = {},
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_CUT)) {
    throw new AppError('You do not have permission to start cut work', 403);
  }

  const actorObjectId = new Types.ObjectId(actor.id);
  const idFilter = Types.ObjectId.isValid(caseIdOrMongoId)
    ? { $or: [{ _id: caseIdOrMongoId }, { caseId: caseIdOrMongoId }] }
    : { caseId: caseIdOrMongoId };
  const filter = {
    $and: [
      idFilter,
      { isDeleted: false },
      { cutRequired: true },
      {
        cutPhase: {
          $in: [CUT_PHASES.CUT_QUEUE, CUT_PHASES.CUT_ASSIGNED, CUT_PHASES.CUT_REWORK],
        },
      },
      {
        $or: [
          { assignedCutOperatorId: { $exists: false } },
          { assignedCutOperatorId: null },
          { assignedCutOperatorId: actorObjectId },
        ],
      },
    ],
  };

  const now = new Date();
  const update: Record<string, unknown> = {
    assignedCutOperatorId: actorObjectId,
    assignedCutOperatorName: actorName(actor),
    cutPhase: CUT_PHASES.CUT_IN_PROGRESS,
    cutAssignmentMode: CUT_ASSIGNMENT_MODES.OPERATOR,
    cutStartedAt: now,
    status: CASE_STATUSES.IN_PROCESS,
  };
  if (input.notes?.trim()) {
    update.cutNotes = input.notes.trim();
  }

  const caseDoc = await Case.findOneAndUpdate(filter, { $set: update }, { new: true });
  if (!caseDoc) {
    throw new AppError('Case is not available to claim for cut work', 409);
  }

  pushHistory(caseDoc, {
    action: 'cut_started',
    summary: 'Cut operator claimed case and started cut work',
    actor,
    metadata: { notes: input.notes?.trim() || undefined },
  });
  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_CUT_START,
    summary: `${actor.email} started cut work on case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  await createNotification({
    userId: actor.id,
    type: NOTIFICATION_TYPES.CASE_CUT_CLAIMED,
    title: `Cut case claimed: ${caseDoc.caseId}`,
    body: `You claimed ${caseDoc.patientName} for cutting.`,
    link: `/app/cases/${caseDoc.caseId}`,
    caseId: caseDoc.caseId,
  });

  return await toDetail(caseDoc, actor);
}

export async function saveCutProgress(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: SaveCutProgressInput = {},
  audit?: RequestAuditContext,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanCutWork(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot update a deleted case', 400);
  if (
    caseDoc.cutPhase !== CUT_PHASES.CUT_IN_PROGRESS &&
    caseDoc.cutPhase !== CUT_PHASES.CUT_REWORK
  ) {
    throw new AppError('Case is not in an active cut work phase', 400);
  }

  if (input.notes !== undefined) {
    caseDoc.cutNotes = input.notes.trim();
  }
  if (input.comment?.trim()) {
    caseDoc.cutInternalComments.push({
      _id: new Types.ObjectId(),
      body: input.comment.trim(),
      authorId: new Types.ObjectId(actor.id),
      authorName: actorName(actor),
      createdAt: new Date(),
    } as (typeof caseDoc.cutInternalComments)[number]);
  }

  pushHistory(caseDoc, {
    action: 'cut_progress_saved',
    summary: 'Cut progress saved',
    actor,
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_UPDATE,
    summary: `${actor.email} saved cut progress on case ${caseDoc.caseId}`,
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

export async function submitCutWork(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: SubmitCutInput = {},
  audit?: RequestAuditContext,
) {
  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanCutWork(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot submit cut work on a deleted case', 400);
  if (
    caseDoc.cutPhase !== CUT_PHASES.CUT_IN_PROGRESS &&
    caseDoc.cutPhase !== CUT_PHASES.CUT_REWORK
  ) {
    throw new AppError('Case is not ready to submit cut work', 400);
  }

  const cutFiles = (caseDoc.files ?? []).filter(
    (file) => file.category === FILE_CATEGORIES.CUT,
  );
  if (cutFiles.length === 0) {
    throw new AppError('Upload at least one cut output file before submitting', 400);
  }

  const now = new Date();
  if (input.notes?.trim()) {
    caseDoc.cutNotes = input.notes.trim();
  }
  caseDoc.cutPhase = CUT_PHASES.WAITING_FOR_DESIGNER;
  caseDoc.cutSubmittedAt = now;
  caseDoc.status = CASE_STATUSES.IN_PROCESS;

  const openRevision = (caseDoc.cutRevisions ?? []).find((revision) => !revision.completedAt);
  if (openRevision) {
    openRevision.completedAt = now;
  }

  const designerAutoQueue = input.designerAutoQueue !== false;
  if (designerAutoQueue) {
    caseDoc.assignmentMode = ASSIGNMENT_MODES.AUTO_QUEUE;
    caseDoc.assignedDesignerId = undefined;
    caseDoc.assignedDesignerName = undefined;
  } else {
    caseDoc.assignmentMode = ASSIGNMENT_MODES.NONE;
    caseDoc.assignedDesignerId = undefined;
    caseDoc.assignedDesignerName = undefined;
  }

  pushHistory(caseDoc, {
    action: 'cut_submitted',
    summary: designerAutoQueue
      ? 'Cut work submitted — waiting for designer (auto queue)'
      : 'Cut work submitted — waiting for coordinator designer assignment',
    actor,
    metadata: {
      notes: input.notes?.trim() || undefined,
      designerAutoQueue,
    },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_CUT_SUBMIT,
    summary: `${actor.email} submitted cut work on case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  const coordinatorIds = await findUserIdsByRoles([ROLES.COORDINATOR, ROLES.SUPERVISOR]);
  await createNotificationsForUsers(coordinatorIds, {
    type: NOTIFICATION_TYPES.CASE_CUT_SUBMITTED,
    title: `Cut complete — ${caseDoc.caseId}`,
    body: `${caseDoc.patientName} is waiting for designer assignment.`,
    link: `/app/cases/${caseDoc.caseId}`,
    caseId: caseDoc.caseId,
  });

  if (designerAutoQueue) {
    const designerIds = await findUserIdsByRoles([ROLES.DESIGNER, 'senior_designer']);
    await createNotificationsForUsers(designerIds, {
      type: NOTIFICATION_TYPES.CASE_ASSIGNED,
      title: `Case ready for design: ${caseDoc.caseId}`,
      body: `${caseDoc.patientName} completed cutting and is in the designer auto queue.`,
      link: `/app/cases/${caseDoc.caseId}`,
      caseId: caseDoc.caseId,
    });
  }

  return await toDetail(caseDoc, actor);
}

export async function requestCutRework(
  actor: CaseActor,
  caseIdOrMongoId: string,
  input: RequestCutReworkInput,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_CUT_REWORK_REQUEST)) {
    throw new AppError('You do not have permission to request cut rework', 403);
  }

  const caseDoc = await findCase(caseIdOrMongoId);
  assertCanViewCase(actor, caseDoc);

  if (caseDoc.isDeleted) throw new AppError('Cannot request rework on a deleted case', 400);
  if (caseDoc.cutPhase !== CUT_PHASES.WAITING_FOR_DESIGNER) {
    throw new AppError('Cut rework can only be requested while waiting for designer assignment', 400);
  }
  if (!caseDoc.assignedCutOperatorId) {
    throw new AppError('No cut operator is associated with this case', 400);
  }

  const reason = input.reason.trim();
  const comments = input.comments.trim();
  if (!reason) throw new AppError('Rework reason is required', 400);
  if (!comments) throw new AppError('Rework comments are required', 400);

  const nextRevision = (caseDoc.cutRevisions?.length ?? 0) + 1;
  caseDoc.cutRevisions.unshift({
    _id: new Types.ObjectId(),
    revision: nextRevision,
    reason,
    comments,
    requestedById: new Types.ObjectId(actor.id),
    requestedByName: actorName(actor),
    requestedByRole: actor.role,
    requestedAt: new Date(),
  } as (typeof caseDoc.cutRevisions)[number]);

  caseDoc.cutPhase = CUT_PHASES.CUT_REWORK;
  caseDoc.cutSubmittedAt = undefined;
  caseDoc.assignmentMode = ASSIGNMENT_MODES.NONE;
  caseDoc.assignedDesignerId = undefined;
  caseDoc.assignedDesignerName = undefined;

  pushHistory(caseDoc, {
    action: 'cut_rework_requested',
    summary: `Cut rework requested (revision ${nextRevision})`,
    actor,
    metadata: { reason, comments },
  });

  await caseDoc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_CUT_REWORK_REQUEST,
    summary: `${actor.email} requested cut rework on case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  const operatorId = String(caseDoc.assignedCutOperatorId);
  await createNotification({
    userId: operatorId,
    type: NOTIFICATION_TYPES.CASE_CUT_REWORK,
    title: `Cut rework requested — ${caseDoc.caseId}`,
    body: reason,
    link: `/app/cases/${caseDoc.caseId}`,
    caseId: caseDoc.caseId,
  });
  await emailUsers([operatorId], {
    subject: `Cut rework requested: ${caseDoc.caseId}`,
    headline: 'Cut rework requested',
    message: `${actorName(actor)} requested cut rework on case ${caseDoc.caseId}: ${reason}`,
    caseId: caseDoc.caseId,
    patientName: caseDoc.patientName,
  });

  return await toDetail(caseDoc, actor);
}

function toQueueCaseDto(
  caseDoc: ICase,
  openClarificationCount: number,
  viewer: DoctorViewer,
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
    doctorName: doctorNameForViewer(caseDoc, viewer),
    doctorEmail: doctorEmailForViewer(caseDoc, viewer),
    status: caseDoc.status,
    priority: caseDoc.priority,
    treatmentSummary: caseDoc.treatmentSummary,
    queue,
    delayLevel: computeDelayLevel(ref),
    delayHours: Math.round(hours * 10) / 10,
    ...slaSnapshot(caseDoc),
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
    toQueueCaseDto(caseDoc, openMap.get(String(caseDoc._id)) ?? 0, actor),
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

  return doctors.map((doctor) => {
    const canSeeName = canViewDoctorName(
      actor.role as Role,
      actor.id,
      doctor.id,
      actor.roles,
    );
    const label = canSeeName
      ? `${doctor.firstName} ${doctor.lastName}`.trim()
      : doctor.doctorId || 'Doctor';
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
  const { resolveUserQcScope, resolveUserRoleKeys } = await import('../rbac/rbac.service');
  const qcScope = await resolveUserQcScope(user);
  const roles = resolveUserRoleKeys(user);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.primaryRole || user.role,
    roles,
    permissions,
    qcScope,
    organizationId: user.organizationId ? String(user.organizationId) : null,
    facilityId: user.facilityId ? String(user.facilityId) : null,
    corporateCustomerId: user.corporateCustomerId ?? null,
    assignedCountry: user.assignedCountry ?? null,
  };
}

function assertCanConsult(actor: CaseActor) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.CASE_CONSULT)) {
    throw new AppError('You do not have permission to consult on cases', 403);
  }
}

function toConsultantQueueCaseDto(
  caseDoc: ICase,
  viewer: DoctorViewer,
): ConsultantQueueCaseDto {
  return {
    id: caseDoc.id,
    caseId: caseDoc.caseId,
    patientName: caseDoc.patientName,
    doctorName: doctorNameForViewer(caseDoc, viewer),
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
    status: { $nin: [CASE_STATUSES.CANCELLED, CASE_STATUSES.APPROVED] },
    $or: [
      { escalatedForOversight: true },
      { assignedConsultantId: new Types.ObjectId(actor.id) },
      { status: CASE_STATUSES.IN_PROCESS },
      { 'clinicalRemarks.0': { $exists: true } },
    ],
  })
    .sort({ priority: -1, updatedAt: -1 })
    .limit(100);

  const items = cases.map((doc) => toConsultantQueueCaseDto(doc, actor));
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
    caseDoc.status !== CASE_STATUSES.WAITING_FOR_APPROVAL &&
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
      body: `${staffDoctorLabel(caseDoc)} opened the delivery without selecting an option yet (“Viewed”).`,
      link: `/app/cases/${caseDoc.caseId}`,
      caseId: caseDoc.caseId,
    });
    await emailUsers(teamIds, {
      subject: `Doctor viewed case ${caseDoc.caseId}`,
      headline: 'Doctor viewed delivery',
      message: `${staffDoctorLabel(caseDoc)} opened case ${caseDoc.caseId} without selecting an option yet.`,
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
    caseDoc.status !== CASE_STATUSES.WAITING_FOR_APPROVAL &&
    caseDoc.status !== CASE_STATUSES.APPROVED
  ) {
    throw new AppError('Case is not awaiting doctor review', 400);
  }

  const note = input.note?.trim() || '';
  const now = new Date();
  const statusBeforeDecision = caseDoc.status;

  caseDoc.doctorDecision = input.decision;
  caseDoc.doctorDecisionNote = note || undefined;
  caseDoc.doctorDecisionAt = now;
  if (!caseDoc.doctorEngagement) caseDoc.doctorEngagement = {};
  caseDoc.doctorEngagement.respondedAt = now;
  caseDoc.doctorEngagement.lastViewedAt = now;

  if (input.decision === DOCTOR_DECISIONS.APPROVE) {
    caseDoc.status = CASE_STATUSES.APPROVED;
  } else if (input.decision === DOCTOR_DECISIONS.REQUEST_MODIFICATION) {
    if (!note) throw new AppError('Describe the modification you need', 400);
    caseDoc.status = CASE_STATUSES.IN_PROCESS;
  } else if (input.decision === DOCTOR_DECISIONS.CANCEL) {
    if (!note) throw new AppError('Provide a cancellation reason', 400);
    caseDoc.status = CASE_STATUSES.CANCELLED;
    caseDoc.cancelReason = note;
  } else if (input.decision === DOCTOR_DECISIONS.UNDER_REVIEW) {
    caseDoc.status = CASE_STATUSES.WAITING_FOR_APPROVAL;
  }

  pushHistory(caseDoc, {
    action: 'doctor_decision',
    summary: `Doctor decision: ${DOCTOR_DECISION_LABELS[input.decision]}`,
    actor,
    metadata: { decision: input.decision, note: note || undefined },
  });

  await caseDoc.save();

  if (input.decision === DOCTOR_DECISIONS.CANCEL) {
    const caseValue =
      caseDoc.payment?.amountPaid ??
      caseDoc.payment?.amountDue ??
      caseDoc.commercial?.finalPayableAmount ??
      0;
    const refundAmount = Number(caseValue) > 0 ? Number(caseValue) : 0;
    const { CancellationAudit } = await import('../../models/CancellationAudit');
    const { summarizeDevice } = await import('../cancellations/cancellations.service');
    let paymentTransactionReference: string | undefined;
    if (caseDoc.paymentSessionId) {
      const { PaymentSession } = await import('../../models/Commercial');
      const session = await PaymentSession.findById(caseDoc.paymentSessionId);
      paymentTransactionReference =
        session?.stripeSessionId ||
        session?.stripePaymentIntentId ||
        session?.bankReference ||
        undefined;
    }
    await CancellationAudit.create({
      caseMongoId: caseDoc._id,
      caseId: caseDoc.caseId,
      patientId: caseDoc.caseId,
      patientName: caseDoc.patientName,
      doctorUserId: caseDoc.doctorId,
      doctorName: caseDoc.doctorName,
      doctorDisplayId: caseDoc.doctorDisplayId,
      coordinatorId: caseDoc.validatedById,
      coordinatorName: caseDoc.validatedByName,
      organizationId: caseDoc.organizationId,
      companyName: caseDoc.practiceName || caseDoc.clinicName,
      facilityId: caseDoc.facilityId,
      caseCategory: caseDoc.caseCategory,
      caseType: caseDoc.caseType,
      treatmentPlanName: caseDoc.commercial?.treatmentPlanName,
      caseValue: refundAmount,
      currency: caseDoc.payment?.currency || caseDoc.commercial?.currency || 'USD',
      invoiceNumber: caseDoc.payment?.invoiceNumber,
      paymentStatus: caseDoc.payment?.status,
      refundAmount,
      refundStatus: refundAmount > 0 ? REFUND_STATUSES.PENDING : REFUND_STATUSES.NOT_APPLICABLE,
      cancellationReason: note,
      cancellationRemarks: 'post-delivery',
      statusAtCancellation: statusBeforeDecision,
      submittedAt: caseDoc.submittedAt ?? caseDoc.createdAt,
      cancelledAt: now,
      remainingWindowSeconds: 0,
      cancelledById: actor.id,
      cancelledByName: actorName(actor),
      cancelledByEmail: actor.email,
      cancelledByRole: actor.role,
      ipAddress: audit?.ipAddress,
      userAgent: audit?.userAgent,
      deviceSummary: summarizeDevice(audit?.userAgent) || undefined,
      paymentTransactionReference,
    });
  }

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
      `${staffDoctorLabel(caseDoc)} selected ${DOCTOR_DECISION_LABELS[input.decision]} on case ${caseDoc.caseId}.`,
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
      $in: [CASE_STATUSES.WAITING_FOR_APPROVAL, CASE_STATUSES.APPROVED, CASE_STATUSES.APPROVED],
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
