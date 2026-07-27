import {
  AUDIT_ACTIONS,
  DELETE_RECORD_TYPES,
  DELETE_REQUEST_STATUSES,
  DEPARTMENT_TYPE_LABELS,
  permissionsInclude,
  PERMISSIONS,
  type CreateDepartmentInput,
  type DepartmentDto,
  type DepartmentMemberDto,
  type TransferDepartmentMemberInput,
  type UpdateDepartmentInput,
} from '@ayetis/shared';
import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { Department } from '../../models/Department';
import { DeleteRequest } from '../../models/DeleteRequest';
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

function assertManage(actor: Actor) {
  if (!permissionsInclude(actor.permissions as never, PERMISSIONS.DEPARTMENT_MANAGE)) {
    throw new AppError('You do not have permission to manage departments', 403);
  }
}

async function toDepartmentDto(dept: InstanceType<typeof Department>): Promise<DepartmentDto> {
  const members = await User.find({
    departmentId: dept._id,
    isActive: true,
  }).sort({ firstName: 1 });

  const memberDtos: DepartmentMemberDto[] = members.map((user) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  }));

  return {
    id: dept.id,
    name: dept.name,
    code: dept.code,
    type: dept.type,
    description: dept.description || '',
    supervisorId: dept.supervisorId ? String(dept.supervisorId) : null,
    supervisorName: dept.supervisorName ?? null,
    memberCount: memberDtos.length,
    members: memberDtos,
    isActive: dept.isActive,
    createdAt: dept.createdAt.toISOString(),
    updatedAt: dept.updatedAt.toISOString(),
  };
}

export async function listDepartments(actor: Actor) {
  assertManage(actor);
  const departments = await Department.find({ isDeleted: false }).sort({ name: 1 });
  return Promise.all(departments.map((dept) => toDepartmentDto(dept)));
}

export async function createDepartment(
  actor: Actor,
  input: CreateDepartmentInput,
  audit?: RequestAuditContext,
) {
  assertManage(actor);

  const code = input.code.trim().toUpperCase();
  const existing = await Department.findOne({ code, isDeleted: false });
  if (existing) throw new AppError('Department code already exists', 409);

  let supervisorName: string | undefined;
  if (input.supervisorId) {
    const supervisor = await User.findById(input.supervisorId);
    if (!supervisor) throw new AppError('Supervisor user not found', 404);
    supervisorName = `${supervisor.firstName} ${supervisor.lastName}`.trim();
  }

  const dept = await Department.create({
    name: input.name.trim(),
    code,
    type: input.type,
    description: input.description?.trim() || '',
    supervisorId: input.supervisorId ? new Types.ObjectId(input.supervisorId) : undefined,
    supervisorName,
    isActive: true,
  });

  await recordActivity({
    action: AUDIT_ACTIONS.DEPARTMENT_CREATE,
    summary: `${actor.email} created department ${dept.code}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'system',
    targetId: dept.id,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return toDepartmentDto(dept);
}

export async function updateDepartment(
  actor: Actor,
  departmentId: string,
  input: UpdateDepartmentInput,
  audit?: RequestAuditContext,
) {
  assertManage(actor);
  const dept = await Department.findOne({ _id: departmentId, isDeleted: false });
  if (!dept) throw new AppError('Department not found', 404);

  if (input.name !== undefined) dept.name = input.name.trim();
  if (input.code !== undefined) dept.code = input.code.trim().toUpperCase();
  if (input.type !== undefined) dept.type = input.type;
  if (input.description !== undefined) dept.description = input.description.trim();
  if (input.isActive !== undefined) dept.isActive = input.isActive;

  if (input.supervisorId !== undefined) {
    if (!input.supervisorId) {
      dept.supervisorId = undefined;
      dept.supervisorName = undefined;
    } else {
      const supervisor = await User.findById(input.supervisorId);
      if (!supervisor) throw new AppError('Supervisor user not found', 404);
      dept.supervisorId = new Types.ObjectId(input.supervisorId);
      dept.supervisorName = `${supervisor.firstName} ${supervisor.lastName}`.trim();
    }
  }

  await dept.save();

  await recordActivity({
    action: AUDIT_ACTIONS.DEPARTMENT_UPDATE,
    summary: `${actor.email} updated department ${dept.code} (${DEPARTMENT_TYPE_LABELS[dept.type]})`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'system',
    targetId: dept.id,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return toDepartmentDto(dept);
}

export async function transferMember(
  actor: Actor,
  input: TransferDepartmentMemberInput,
  audit?: RequestAuditContext,
) {
  assertManage(actor);
  const user = await User.findById(input.userId);
  if (!user) throw new AppError('User not found', 404);

  if (!input.toDepartmentId) {
    user.departmentId = undefined;
    user.departmentName = undefined;
  } else {
    const dept = await Department.findOne({ _id: input.toDepartmentId, isDeleted: false });
    if (!dept) throw new AppError('Target department not found', 404);
    user.departmentId = dept._id as Types.ObjectId;
    user.departmentName = dept.name;
  }

  await user.save();

  await recordActivity({
    action: AUDIT_ACTIONS.DEPARTMENT_UPDATE,
    summary: `${actor.email} transferred ${user.email} to ${user.departmentName ?? 'no department'}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    targetType: 'user',
    targetId: user.id,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return {
    id: user.id,
    departmentId: user.departmentId ? String(user.departmentId) : null,
    departmentName: user.departmentName ?? null,
  };
}

export async function requestDeleteDepartment(
  actor: Actor,
  departmentId: string,
  reason: string,
  audit?: RequestAuditContext,
) {
  assertManage(actor);
  const dept = await Department.findOne({ _id: departmentId, isDeleted: false });
  if (!dept) throw new AppError('Department not found', 404);

  const pending = await DeleteRequest.findOne({
    recordType: DELETE_RECORD_TYPES.DEPARTMENT,
    recordId: dept.id,
    status: DELETE_REQUEST_STATUSES.PENDING,
  });
  if (pending) throw new AppError('A delete request is already pending for this department', 400);

  const request = await DeleteRequest.create({
    recordType: DELETE_RECORD_TYPES.DEPARTMENT,
    recordId: dept.id,
    recordLabel: `${dept.code} — ${dept.name}`,
    reason: reason.trim(),
    status: DELETE_REQUEST_STATUSES.PENDING,
    requestedById: new Types.ObjectId(actor.id),
    requestedByName: actorName(actor),
    requestedByEmail: actor.email,
  });

  await recordActivity({
    action: AUDIT_ACTIONS.DEPARTMENT_DELETE,
    summary: `${actor.email} requested deletion of department ${dept.code}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actorName(actor),
    actorRole: actor.role,
    targetType: 'system',
    targetId: dept.id,
    metadata: { reason: reason.trim(), requestId: request.id },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return request;
}
