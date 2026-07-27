import {
  AUDIT_ACTIONS,
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  PERMISSIONS,
  permissionsInclude,
  type CaseDetailDto,
  type CaseListItemDto,
  type CaseListResult,
  type CasePriority,
  type CaseStatus,
  type CreateCaseInput,
  type Permission,
  type UpdateCaseInput,
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
import { resolvePermissionsForUserId } from '../users/users.service';

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

function toListItem(caseDoc: ICase): CaseListItemDto {
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
    isDeleted: caseDoc.isDeleted,
    createdAt: caseDoc.createdAt.toISOString(),
    updatedAt: caseDoc.updatedAt.toISOString(),
  };
}

function toDetail(caseDoc: ICase): CaseDetailDto {
  return {
    ...toListItem(caseDoc),
    clinicName: caseDoc.clinicName,
    patientGender: caseDoc.patientGender,
    instructions: caseDoc.instructions,
    country: caseDoc.country,
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
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedByName: file.uploadedByName,
      note: file.note,
      createdAt: file.createdAt.toISOString(),
    })),
    history: caseDoc.history.map((entry) => ({
      id: String(entry._id),
      action: entry.action,
      summary: entry.summary,
      actorId: entry.actorId ? String(entry.actorId) : null,
      actorName: entry.actorName ?? null,
      createdAt: entry.createdAt.toISOString(),
      metadata: entry.metadata,
    })),
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
    items: items.map(toListItem),
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

  return toDetail(caseDoc);
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
    status: CASE_STATUSES.SUBMITTED,
    priority: input.priority ?? CASE_PRIORITIES.NORMAL,
    notes: [],
    files: [],
    history: [],
  });

  pushHistory(caseDoc, {
    action: 'created',
    summary: `Case ${caseId} submitted`,
    actor,
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

  return toDetail(caseDoc);
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

  const changes: Record<string, unknown> = {};

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
    if (input[key] !== undefined) {
      const value = input[key];
      (caseDoc as unknown as Record<string, unknown>)[key] =
        typeof value === 'string' ? value.trim() : value;
      changes[key] = value;
    }
  }

  if (Object.keys(changes).length === 0) {
    throw new AppError('No changes provided', 400);
  }

  if (
    changes.priority !== undefined &&
    changes.priority === CASE_PRIORITIES.URGENT &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_SET_PRIORITY) &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_UPDATE)
  ) {
    // Coordinators already have CASE_SET_PRIORITY; keep check for clarity.
  }

  pushHistory(caseDoc, {
    action: 'updated',
    summary: `Case details updated`,
    actor,
    metadata: { changes },
  });

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

  return toDetail(caseDoc);
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

  caseDoc.status = CASE_STATUSES.CANCELLED;
  caseDoc.cancelReason = reason.trim();

  pushHistory(caseDoc, {
    action: 'cancelled',
    summary: `Case cancelled: ${reason.trim()}`,
    actor,
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

  return toDetail(caseDoc);
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

  return toDetail(caseDoc);
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

  return toDetail(caseDoc);
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
