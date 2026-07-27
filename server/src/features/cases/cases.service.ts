import {
  ASSIGNMENT_MODES,
  AUDIT_ACTIONS,
  CASE_FIELD_LABELS,
  CASE_PRIORITIES,
  CASE_PRIORITY_LABELS,
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  COORDINATOR_QUEUE_DESCRIPTIONS,
  COORDINATOR_QUEUE_LABELS,
  COORDINATOR_QUEUES,
  DELAY_LEVELS,
  EMPTY_TREATMENT_INSTRUCTIONS,
  FILE_CATEGORIES,
  PAYMENT_STATUSES,
  PERMISSIONS,
  ROLES,
  ALL_COORDINATOR_QUEUES,
  ALL_DELAY_LEVELS,
  buildCaseTimeline,
  computeDelayLevel,
  formatHistoryValue,
  isFileCategory,
  permissionsInclude,
  resolveCoordinatorQueue,
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
  type CoordinatorDashboardDto,
  type CoordinatorQueue,
  type CoordinatorQueueCaseDto,
  type CreateCaseInput,
  type DelayLevel,
  type DesignerAssigneeDto,
  type FileCategory,
  type Permission,
  type TreatmentInstructions,
  type UpdateCaseInput,
  type UpdateCasePaymentInput,
  type ValidateCaseInput,
  type ValidationCheckItem,
} from '@ayetis/shared';
import fs from 'fs/promises';
import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { Case, type ICase } from '../../models/Case';
import { generateCaseId } from '../../models/CaseCounter';
import { User } from '../../models/User';
import {
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';
import {
  countOpenClarifications,
  listClarificationDtosForCase,
} from '../clarifications/clarifications.service';
import { resolvePermissionsForUserId } from '../users/users.service';
import { resolveStoragePath, saveCaseFile } from '../../services/storage.service';

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
    try {
      await fs.access(resolveStoragePath(file.storageKey));
      accessibleCount += 1;
    } catch {
      // missing on disk
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

async function toListItem(caseDoc: ICase): Promise<CaseListItemDto> {
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

  return {
    id: caseDoc.id,
    caseId: caseDoc.caseId,
    patientName: caseDoc.patientName,
    patientAge: caseDoc.patientAge ?? null,
    doctorId: String(caseDoc.doctorId),
    doctorName: caseDoc.doctorName,
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
    queue,
    delayLevel: caseDoc.isDeleted ? null : computeDelayLevel(ref),
    isDeleted: caseDoc.isDeleted,
    createdAt: caseDoc.createdAt.toISOString(),
    updatedAt: caseDoc.updatedAt.toISOString(),
  };
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

async function toDetail(caseDoc: ICase): Promise<CaseDetailDto> {
  const [listItem, clarifications, validation] = await Promise.all([
    toListItem(caseDoc),
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

  if (
    permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ASSIGNED) &&
    caseDoc.assignedDesignerId &&
    String(caseDoc.assignedDesignerId) === actor.id
  ) {
    return;
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
    /\.(jpe?g|png|gif|webp|heic)$/i.test(lower)
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
    items: await Promise.all(items.map((item) => toListItem(item))),
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

  return await toDetail(caseDoc);
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

  const doctor = await User.findById(actor.id);
  if (!doctor || !doctor.isActive) {
    throw new AppError('Doctor account not found', 404);
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

  return await toDetail(caseDoc);
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

  return await toDetail(caseDoc);
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
    return toDetail(caseDoc);
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

  return await toDetail(caseDoc);
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

  return await toDetail(caseDoc);
}

export async function softDeleteCase(
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

  return await toDetail(caseDoc);
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

  return await toDetail(caseDoc);
}

export async function uploadCaseFiles(
  actor: CaseActor,
  caseIdOrMongoId: string,
  files: Array<{
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
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
    const category = detectCategory(file.originalname, file.mimetype, options.category);
    const { storageKey } = await saveCaseFile({
      caseId: caseDoc.caseId,
      originalName: file.originalname,
      buffer: file.buffer,
    });

    const sameNameCount = caseDoc.files.filter(
      (existing) => existing.originalName === file.originalname,
    ).length;

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
      createdAt: new Date(),
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

  return await toDetail(caseDoc);
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

  return {
    absolutePath: resolveStoragePath(file.storageKey),
    originalName: file.originalName || file.filename,
    mimeType: file.mimeType,
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

  return await toDetail(caseDoc);
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

  return await toDetail(caseDoc);
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

  return await toDetail(caseDoc);
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

  return await toDetail(caseDoc);
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

  return await toDetail(caseDoc);
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

export async function resolveCaseActor(userId: string): Promise<CaseActor> {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
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

export { CASE_STATUS_LABELS };
