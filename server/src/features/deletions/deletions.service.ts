import {
  AUDIT_ACTIONS,
  DELETE_RECORD_TYPES,
  DELETE_REQUEST_STATUSES,
  PERMISSIONS,
  permissionsInclude,
  type DeleteRequestDto,
  type ReviewDeleteRequestInput,
} from '@ayetis/shared';
import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { Case } from '../../models/Case';
import { DeleteRequest } from '../../models/DeleteRequest';
import { Department } from '../../models/Department';
import { User } from '../../models/User';
import { recordActivity, type RequestAuditContext } from '../audit/audit.service';

interface Actor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
}

function actorName(actor: Actor) {
  return `${actor.firstName} ${actor.lastName}`.trim();
}

function toDto(doc: InstanceType<typeof DeleteRequest>): DeleteRequestDto {
  return {
    id: doc.id,
    recordType: doc.recordType,
    recordId: doc.recordId,
    recordLabel: doc.recordLabel,
    caseId: doc.caseId ?? null,
    reason: doc.reason,
    status: doc.status,
    requestedById: String(doc.requestedById),
    requestedByName: doc.requestedByName,
    requestedByEmail: doc.requestedByEmail,
    reviewedById: doc.reviewedById ? String(doc.reviewedById) : null,
    reviewedByName: doc.reviewedByName ?? null,
    reviewNote: doc.reviewNote ?? null,
    reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listDeleteRequests(
  actor: Actor,
  query: { status?: string } = {},
) {
  if (
    !permissionsInclude(actor.permissions as never, PERMISSIONS.DELETE_REQUEST_REVIEW) &&
    !permissionsInclude(actor.permissions as never, PERMISSIONS.AUDIT_VIEW)
  ) {
    throw new AppError('You do not have permission to view delete requests', 403);
  }

  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;

  const items = await DeleteRequest.find(filter).sort({ createdAt: -1 }).limit(200);
  return items.map(toDto);
}

export async function requestCaseDelete(
  actor: Actor,
  caseIdOrMongoId: string,
  reason: string,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions as never, PERMISSIONS.CASE_DELETE)) {
    throw new AppError('You do not have permission to delete cases', 403);
  }

  const filter = Types.ObjectId.isValid(caseIdOrMongoId)
    ? { $or: [{ _id: caseIdOrMongoId }, { caseId: caseIdOrMongoId }] }
    : { caseId: caseIdOrMongoId };

  const caseDoc = await Case.findOne(filter);
  if (!caseDoc) throw new AppError('Case not found', 404);
  if (caseDoc.isDeleted) throw new AppError('Case is already deleted', 400);

  const pending = await DeleteRequest.findOne({
    recordType: DELETE_RECORD_TYPES.CASE,
    recordId: caseDoc.id,
    status: DELETE_REQUEST_STATUSES.PENDING,
  });
  if (pending) throw new AppError('A delete request is already pending for this case', 400);

  const request = await DeleteRequest.create({
    recordType: DELETE_RECORD_TYPES.CASE,
    recordId: caseDoc.id,
    recordLabel: caseDoc.caseId,
    caseId: caseDoc.caseId,
    reason: reason.trim(),
    status: DELETE_REQUEST_STATUSES.PENDING,
    requestedById: new Types.ObjectId(actor.id),
    requestedByName: actorName(actor),
    requestedByEmail: actor.email,
  });

  await recordActivity({
    action: AUDIT_ACTIONS.CASE_DELETE_REQUEST,
    summary: `${actor.email} requested deletion of case ${caseDoc.caseId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'case',
    targetId: caseDoc.caseId,
    metadata: { reason: reason.trim(), requestId: request.id },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return toDto(request);
}

export async function requestUserDelete(
  actor: Actor,
  userId: string,
  reason: string,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions as never, PERMISSIONS.USER_DELETE)) {
    throw new AppError('You do not have permission to delete users', 403);
  }

  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  if (user.id === actor.id) throw new AppError('You cannot delete your own account', 400);

  const pending = await DeleteRequest.findOne({
    recordType: DELETE_RECORD_TYPES.USER,
    recordId: user.id,
    status: DELETE_REQUEST_STATUSES.PENDING,
  });
  if (pending) throw new AppError('A delete request is already pending for this user', 400);

  const request = await DeleteRequest.create({
    recordType: DELETE_RECORD_TYPES.USER,
    recordId: user.id,
    recordLabel: `${user.email} (${user.role})`,
    reason: reason.trim(),
    status: DELETE_REQUEST_STATUSES.PENDING,
    requestedById: new Types.ObjectId(actor.id),
    requestedByName: actorName(actor),
    requestedByEmail: actor.email,
  });

  await recordActivity({
    action: AUDIT_ACTIONS.USER_DELETE,
    summary: `${actor.email} requested deletion of user ${user.email}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'user',
    targetId: user.id,
    metadata: { reason: reason.trim(), requestId: request.id },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return toDto(request);
}

async function executeApprovedDelete(request: InstanceType<typeof DeleteRequest>, actor: Actor) {
  if (request.recordType === DELETE_RECORD_TYPES.CASE) {
    const caseDoc = await Case.findById(request.recordId);
    if (!caseDoc || caseDoc.isDeleted) return;
    caseDoc.isDeleted = true;
    caseDoc.deletedAt = new Date();
    caseDoc.deletedById = new Types.ObjectId(actor.id);
    caseDoc.deletedByName = actorName(actor);
    caseDoc.deleteReason = request.reason;
    await caseDoc.save();
    return;
  }

  if (request.recordType === DELETE_RECORD_TYPES.USER) {
    const user = await User.findById(request.recordId);
    if (!user) return;
    user.isActive = false;
    await user.save();
    return;
  }

  if (request.recordType === DELETE_RECORD_TYPES.DEPARTMENT) {
    const dept = await Department.findById(request.recordId);
    if (!dept || dept.isDeleted) return;
    dept.isDeleted = true;
    dept.isActive = false;
    dept.deletedAt = new Date();
    dept.deletedById = new Types.ObjectId(actor.id);
    dept.deletedByName = actorName(actor);
    dept.deleteReason = request.reason;
    await dept.save();
    await User.updateMany(
      { departmentId: dept._id },
      { $unset: { departmentId: 1, departmentName: 1 } },
    );
  }
}

export async function reviewDeleteRequest(
  actor: Actor,
  requestId: string,
  input: ReviewDeleteRequestInput,
  audit?: RequestAuditContext,
) {
  if (!permissionsInclude(actor.permissions as never, PERMISSIONS.DELETE_REQUEST_REVIEW)) {
    throw new AppError('You do not have permission to review delete requests', 403);
  }

  if (input.confirmation !== 'DELETE') {
    throw new AppError('Second confirmation failed. Type DELETE to confirm.', 400);
  }

  const request = await DeleteRequest.findById(requestId);
  if (!request) throw new AppError('Delete request not found', 404);
  if (request.status !== DELETE_REQUEST_STATUSES.PENDING) {
    throw new AppError('This delete request has already been reviewed', 400);
  }

  request.reviewedById = new Types.ObjectId(actor.id);
  request.reviewedByName = actorName(actor);
  request.reviewedAt = new Date();
  request.reviewNote = input.note?.trim() || undefined;

  if (input.decision === 'approve') {
    request.status = DELETE_REQUEST_STATUSES.APPROVED;
    await executeApprovedDelete(request, actor);
  } else {
    request.status = DELETE_REQUEST_STATUSES.REJECTED;
  }

  await request.save();

  await recordActivity({
    action:
      input.decision === 'approve'
        ? AUDIT_ACTIONS.DELETE_REQUEST_APPROVE
        : AUDIT_ACTIONS.DELETE_REQUEST_REJECT,
    summary: `${actor.email} ${input.decision}d delete request for ${request.recordLabel}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'system',
    targetId: request.id,
    metadata: { decision: input.decision, reason: request.reason },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return toDto(request);
}

export async function listDeletedRecordsLog(actor: Actor) {
  if (
    !permissionsInclude(actor.permissions as never, PERMISSIONS.DELETE_REQUEST_REVIEW) &&
    !permissionsInclude(actor.permissions as never, PERMISSIONS.AUDIT_VIEW)
  ) {
    throw new AppError('You do not have permission to view the deleted records log', 403);
  }

  const items = await DeleteRequest.find({
    status: DELETE_REQUEST_STATUSES.APPROVED,
  })
    .sort({ reviewedAt: -1 })
    .limit(200);

  return items.map(toDto);
}
