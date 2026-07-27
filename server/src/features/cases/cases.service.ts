import {
  AUDIT_ACTIONS,
  CASE_FIELD_LABELS,
  CASE_PRIORITIES,
  CASE_PRIORITY_LABELS,
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  EMPTY_TREATMENT_INSTRUCTIONS,
  FILE_CATEGORIES,
  PAYMENT_STATUSES,
  PERMISSIONS,
  buildCaseTimeline,
  formatHistoryValue,
  isFileCategory,
  permissionsInclude,
  type CaseDetailDto,
  type CaseHistoryChange,
  type CaseHistoryDto,
  type CaseListItemDto,
  type CaseListResult,
  type CasePriority,
  type CaseStatus,
  type CreateCaseInput,
  type FileCategory,
  type Permission,
  type TreatmentInstructions,
  type UpdateCaseInput,
  type UpdateCasePaymentInput,
} from '@ayetis/shared';
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

async function toListItem(caseDoc: ICase): Promise<CaseListItemDto> {
  const openClarificationCount = await countOpenClarifications(caseDoc._id as Types.ObjectId);
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
  const [listItem, clarifications] = await Promise.all([
    toListItem(caseDoc),
    listClarificationDtosForCase(caseDoc._id as Types.ObjectId),
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
    assignedDesignerId: caseDoc.assignedDesignerId
      ? String(caseDoc.assignedDesignerId)
      : null,
    assignedDesignerName: caseDoc.assignedDesignerName ?? null,
    cancelReason: caseDoc.cancelReason ?? null,
    deletedAt: caseDoc.deletedAt ? caseDoc.deletedAt.toISOString() : null,
    deletedByName: caseDoc.deletedByName ?? null,
    deleteReason: caseDoc.deleteReason ?? null,
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

  if (input.additionalNotes !== undefined || input.specialRequirements !== undefined) {
    // Keep free-text instructions in sync with special requirements when provided
  }

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
