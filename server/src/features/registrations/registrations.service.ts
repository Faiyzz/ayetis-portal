import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  AUDIT_ACTIONS,
  EMPTY_COMPANY_ADDRESS,
  ORGANIZATION_STATUSES,
  REGISTRATION_STATUSES,
  ROLES,
  type RegistrationListResult,
  type RegistrationRequestDto,
  type RegistrationStatus,
  type SystemMessages,
} from '@ayetis/shared';
import { env } from '../../config/env';
import { generateCorporateCustomerId } from '../../models/CorporateCounter';
import { generateDoctorId } from '../../models/DoctorCounter';
import { Organization } from '../../models/Organization';
import { RegistrationRequest, type IRegistrationRequest } from '../../models/RegistrationRequest';
import {
  getSystemMessages,
  updateSystemMessages,
} from '../../models/SystemConfig';
import { User } from '../../models/User';
import {
  accountCreationTemplate,
  registrationRejectedTemplate,
  sendTemplatedEmail,
} from '../../services/email';
import { AppError } from '../../utils/AppError';
import {
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';
import { toPublicUserAsync } from '../users/users.service';

export type RegistrationActor = {
  id: string;
  email: string;
  role: string;
};

function toDto(doc: IRegistrationRequest): RegistrationRequestDto {
  return {
    id: doc.id,
    email: doc.email,
    firstName: doc.firstName,
    lastName: doc.lastName,
    accountType: doc.accountType,
    clinicName: doc.clinicName ?? null,
    companyName: doc.companyName ?? null,
    companyAddress: doc.companyAddress
      ? {
          street: doc.companyAddress.street ?? '',
          city: doc.companyAddress.city ?? '',
          state: doc.companyAddress.state ?? '',
          country: doc.companyAddress.country ?? '',
          postalCode: doc.companyAddress.postalCode ?? '',
        }
      : null,
    status: doc.status,
    emailVerifiedAt: doc.emailVerifiedAt ? doc.emailVerifiedAt.toISOString() : null,
    rejectionReason: doc.rejectionReason ?? null,
    approvedUserId: doc.approvedUserId ? String(doc.approvedUserId) : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listRegistrations(query: {
  page?: number;
  pageSize?: number;
  status?: RegistrationStatus;
}): Promise<RegistrationListResult> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    RegistrationRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    RegistrationRequest.countDocuments(filter),
  ]);

  return {
    items: items.map(toDto),
    total,
    page,
    pageSize,
  };
}

export async function getRegistration(id: string) {
  const doc = await RegistrationRequest.findById(id);
  if (!doc) throw new AppError('Registration request not found', 404);
  return toDto(doc);
}

export async function approveRegistration(
  id: string,
  actor: RegistrationActor,
  audit: RequestAuditContext = {},
) {
  const request = await RegistrationRequest.findById(id).select('+passwordHash');
  if (!request) throw new AppError('Registration request not found', 404);

  if (
    request.status !== REGISTRATION_STATUSES.PENDING_APPROVAL &&
    request.status !== REGISTRATION_STATUSES.HELD
  ) {
    throw new AppError('Only verified pending (or held) registrations can be approved', 400);
  }

  const existing = await User.findOne({ email: request.email });
  if (existing) {
    throw new AppError('A user with this email already exists', 409);
  }

  if (!request.passwordHash) {
    throw new AppError('Registration password is missing; ask the user to re-register', 400);
  }

  const isCorporate = request.accountType === ACCOUNT_TYPES.CORPORATE;
  let corporateCustomerId: string | undefined;
  let organizationId: import('mongoose').Types.ObjectId | undefined;
  let doctorId: string | undefined;

  if (isCorporate) {
    corporateCustomerId = await generateCorporateCustomerId();
  } else {
    doctorId = await generateDoctorId();
  }

  const address = {
    ...EMPTY_COMPANY_ADDRESS,
    ...(request.companyAddress ?? {}),
  };

  const user = await User.create({
    email: request.email,
    password: request.passwordHash,
    firstName: request.firstName,
    lastName: request.lastName,
    role: isCorporate ? ROLES.CORPORATE_ADMIN : ROLES.DOCTOR,
    accountType: request.accountType,
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
    doctorId,
    clinicName: request.clinicName,
    companyName: request.companyName,
    companyAddress: isCorporate ? address : undefined,
    corporateCustomerId,
    permissionGrants: [],
    permissionDenies: [],
    mustChangePassword: false,
  });

  if (isCorporate && corporateCustomerId) {
    const org = await Organization.create({
      corporateCustomerId,
      companyName: request.companyName || `${request.firstName} ${request.lastName}`.trim(),
      address,
      country: address.country || '',
      status: ORGANIZATION_STATUSES.ACTIVE,
      ownerUserId: user._id,
      subAccountSeq: 0,
      employeeSeq: 0,
    });
    organizationId = org._id as never;
    user.organizationId = organizationId;
    await user.save();
  }

  request.status = REGISTRATION_STATUSES.APPROVED;
  request.approvedUserId = user._id;
  await request.save();

  const loginUrl = `${env.clientUrl}/login`;
  const name = `${user.firstName} ${user.lastName}`.trim();
  const idLabel = isCorporate ? corporateCustomerId! : doctorId!;

  try {
    await sendTemplatedEmail(
      user.email,
      accountCreationTemplate({
        name,
        email: user.email,
        doctorId: idLabel,
        loginUrl,
        accountType: ACCOUNT_TYPE_LABELS[user.accountType],
      }),
    );
  } catch (error) {
    console.error('[email] account-creation failed', error);
  }

  await recordActivity({
    action: AUDIT_ACTIONS.REGISTRATION_APPROVE,
    summary: `${actor.email} approved registration for ${request.email} → ${idLabel}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'registration',
    targetId: request.id,
    metadata: {
      userId: user.id,
      doctorId,
      corporateCustomerId,
      organizationId: organizationId ? String(organizationId) : undefined,
      accountType: request.accountType,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  if (isCorporate) {
    await recordActivity({
      action: AUDIT_ACTIONS.ORGANIZATION_CREATE,
      summary: `Organization ${corporateCustomerId} created for ${request.companyName}`,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetType: 'system',
      targetId: corporateCustomerId,
      metadata: { organizationId: organizationId ? String(organizationId) : undefined },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });
  }

  return {
    registration: toDto(request),
    user: await toPublicUserAsync(user),
  };
}

export async function rejectRegistration(
  id: string,
  reason: string,
  actor: RegistrationActor,
  audit: RequestAuditContext = {},
) {
  const request = await RegistrationRequest.findById(id);
  if (!request) throw new AppError('Registration request not found', 404);

  if (
    request.status === REGISTRATION_STATUSES.APPROVED ||
    request.status === REGISTRATION_STATUSES.REJECTED
  ) {
    throw new AppError('This registration can no longer be rejected', 400);
  }

  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    throw new AppError('Rejection reason is required (min 3 characters)', 400);
  }

  request.status = REGISTRATION_STATUSES.REJECTED;
  request.rejectionReason = trimmed;
  await request.save();

  const name = `${request.firstName} ${request.lastName}`.trim();
  try {
    await sendTemplatedEmail(
      request.email,
      registrationRejectedTemplate({ name, reason: trimmed }),
    );
  } catch (error) {
    console.error('[email] registration-rejected failed', error);
  }

  await recordActivity({
    action: AUDIT_ACTIONS.REGISTRATION_REJECT,
    summary: `${actor.email} rejected registration for ${request.email}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'registration',
    targetId: request.id,
    metadata: { reason: trimmed },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return toDto(request);
}

export async function holdRegistration(
  id: string,
  actor: RegistrationActor,
  audit: RequestAuditContext = {},
) {
  const request = await RegistrationRequest.findById(id);
  if (!request) throw new AppError('Registration request not found', 404);

  if (request.status !== REGISTRATION_STATUSES.PENDING_APPROVAL) {
    throw new AppError('Only pending approval registrations can be held', 400);
  }

  request.status = REGISTRATION_STATUSES.HELD;
  await request.save();

  await recordActivity({
    action: AUDIT_ACTIONS.REGISTRATION_HOLD,
    summary: `${actor.email} held registration for ${request.email}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'registration',
    targetId: request.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return toDto(request);
}

export async function getMessages(): Promise<SystemMessages> {
  return getSystemMessages();
}

export async function updateMessages(
  messages: Partial<SystemMessages>,
): Promise<SystemMessages> {
  return updateSystemMessages(messages);
}

export { ACCOUNT_TYPES };
