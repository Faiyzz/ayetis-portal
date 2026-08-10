import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  AUDIT_ACTIONS,
  CASE_STATUSES,
  EMPTY_COMPANY_ADDRESS,
  FACILITY_STATUSES,
  formatEmployeeId,
  formatSubAccountId,
  isFacilityStatus,
  PERMISSIONS,
  ROLES,
  permissionsInclude,
  type CreateEmployeeInput,
  type CreateFacilityInput,
  type CreateSubAccountInput,
  type FacilityDto,
  type OrganizationDto,
  type OrganizationStatus,
  type UpdateFacilityInput,
  type UpdateOrganizationInput,
  type CorporateDashboardDto,
  type Permission,
  type Role,
} from '@ayetis/shared';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import { Case } from '../../models/Case';
import { Facility, type IFacility } from '../../models/Facility';
import { Organization, type IOrganization } from '../../models/Organization';
import { User, type IUser } from '../../models/User';
import {
  emailVerificationTemplate,
  temporaryPasswordTemplate,
  sendTemplatedEmail,
} from '../../services/email';
import { AppError } from '../../utils/AppError';
import { generateTemporaryPassword } from '../../utils/password';
import {
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';
import { toPublicUserAsync } from '../users/users.service';
import { generateDoctorId } from '../../models/DoctorCounter';

export type CorporateActor = {
  id: string;
  email: string;
  role: Role;
  permissions: Permission[];
  organizationId?: string | null;
  facilityId?: string | null;
  corporateCustomerId?: string | null;
};

function hashToken(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function createRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

function orgDto(doc: IOrganization): OrganizationDto {
  return {
    id: doc.id,
    corporateCustomerId: doc.corporateCustomerId,
    companyName: doc.companyName,
    address: {
      ...EMPTY_COMPANY_ADDRESS,
      ...(doc.address ?? {}),
    },
    country: doc.country ?? '',
    status: doc.status,
    ownerUserId: doc.ownerUserId ? String(doc.ownerUserId) : null,
    subAccountSeq: doc.subAccountSeq ?? 0,
    employeeSeq: doc.employeeSeq ?? 0,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function facilityDto(doc: IFacility): FacilityDto {
  return {
    id: doc.id,
    organizationId: String(doc.organizationId),
    corporateCustomerId: doc.corporateCustomerId,
    name: doc.name,
    country: doc.country ?? '',
    state: doc.state ?? '',
    city: doc.city ?? '',
    address: doc.address ?? '',
    timezone: doc.timezone || 'UTC',
    contactPhone: doc.contactPhone ?? '',
    contactEmail: doc.contactEmail ?? '',
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function assertOrgAccess(actor: CorporateActor, organizationId: string) {
  if (permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ALL) || actor.role === ROLES.ADMIN) {
    return Organization.findById(organizationId);
  }
  if (
    permissionsInclude(actor.permissions, PERMISSIONS.ORG_MANAGE_SELF) ||
    permissionsInclude(actor.permissions, PERMISSIONS.FACILITY_MANAGE) ||
    permissionsInclude(actor.permissions, PERMISSIONS.SUBACCOUNT_MANAGE)
  ) {
    if (actor.organizationId && actor.organizationId === organizationId) {
      return Organization.findById(organizationId);
    }
  }
  throw new AppError('You do not have access to this organization', 403);
}

export async function resolveActorOrganizationId(actor: CorporateActor): Promise<string> {
  if (actor.organizationId) return actor.organizationId;
  throw new AppError('No organization is linked to this account', 400);
}

export async function getOrganizationForActor(actor: CorporateActor, organizationId?: string) {
  const id =
    organizationId && actor.role === ROLES.ADMIN
      ? organizationId
      : await resolveActorOrganizationId(actor);
  const org = await assertOrgAccess(actor, id);
  if (!org) throw new AppError('Organization not found', 404);
  return orgDto(org);
}

export async function updateOrganization(
  actor: CorporateActor,
  input: UpdateOrganizationInput,
  organizationId: string | undefined,
  audit: RequestAuditContext = {},
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.ORG_MANAGE_SELF) && actor.role !== ROLES.ADMIN) {
    throw new AppError('You cannot update this organization', 403);
  }
  const id =
    organizationId && actor.role === ROLES.ADMIN
      ? organizationId
      : await resolveActorOrganizationId(actor);
  const org = await assertOrgAccess(actor, id);
  if (!org) throw new AppError('Organization not found', 404);

  if (input.companyName !== undefined) org.companyName = input.companyName.trim();
  if (input.country !== undefined) org.country = input.country.trim();
  if (input.status !== undefined) org.status = input.status as OrganizationStatus;
  if (input.address) {
    org.address = {
      ...EMPTY_COMPANY_ADDRESS,
      ...org.address,
      ...input.address,
    };
    if (input.address.country) org.country = input.address.country;
  }
  await org.save();

  await recordActivity({
    action: AUDIT_ACTIONS.ORGANIZATION_UPDATE,
    summary: `${actor.email} updated organization ${org.corporateCustomerId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: org.corporateCustomerId,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return orgDto(org);
}

export async function listFacilities(actor: CorporateActor, organizationId?: string) {
  const id =
    organizationId && actor.role === ROLES.ADMIN
      ? organizationId
      : await resolveActorOrganizationId(actor);
  await assertOrgAccess(actor, id);

  const filter: Record<string, unknown> = { organizationId: id };
  if (
    actor.facilityId &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ORG) &&
    actor.role !== ROLES.ADMIN
  ) {
    filter._id = actor.facilityId;
  }

  const items = await Facility.find(filter).sort({ name: 1 });
  return items.map(facilityDto);
}

export async function createFacility(
  actor: CorporateActor,
  input: CreateFacilityInput,
  organizationId: string | undefined,
  audit: RequestAuditContext = {},
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.FACILITY_MANAGE) && actor.role !== ROLES.ADMIN) {
    throw new AppError('You cannot manage facilities', 403);
  }
  const id =
    organizationId && actor.role === ROLES.ADMIN
      ? organizationId
      : await resolveActorOrganizationId(actor);
  const org = await assertOrgAccess(actor, id);
  if (!org) throw new AppError('Organization not found', 404);

  const doc = await Facility.create({
    organizationId: org._id,
    corporateCustomerId: org.corporateCustomerId,
    name: input.name.trim(),
    country: input.country?.trim() || org.country || '',
    state: input.state?.trim() || '',
    city: input.city?.trim() || '',
    address: input.address?.trim() || '',
    timezone: input.timezone?.trim() || 'UTC',
    contactPhone: input.contactPhone?.trim() || '',
    contactEmail: input.contactEmail?.trim().toLowerCase() || '',
    status: input.status && isFacilityStatus(input.status) ? input.status : FACILITY_STATUSES.ACTIVE,
  });

  await recordActivity({
    action: AUDIT_ACTIONS.FACILITY_CREATE,
    summary: `${actor.email} created facility ${doc.name}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    metadata: { organizationId: org.id },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return facilityDto(doc);
}

export async function updateFacility(
  actor: CorporateActor,
  facilityId: string,
  input: UpdateFacilityInput,
  audit: RequestAuditContext = {},
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.FACILITY_MANAGE) && actor.role !== ROLES.ADMIN) {
    throw new AppError('You cannot manage facilities', 403);
  }
  const doc = await Facility.findById(facilityId);
  if (!doc) throw new AppError('Facility not found', 404);
  await assertOrgAccess(actor, String(doc.organizationId));

  if (input.name !== undefined) doc.name = input.name.trim();
  if (input.country !== undefined) doc.country = input.country.trim();
  if (input.state !== undefined) doc.state = input.state.trim();
  if (input.city !== undefined) doc.city = input.city.trim();
  if (input.address !== undefined) doc.address = input.address.trim();
  if (input.timezone !== undefined) doc.timezone = input.timezone.trim();
  if (input.contactPhone !== undefined) doc.contactPhone = input.contactPhone.trim();
  if (input.contactEmail !== undefined) doc.contactEmail = input.contactEmail.trim().toLowerCase();
  if (input.status && isFacilityStatus(input.status)) doc.status = input.status;
  await doc.save();

  await recordActivity({
    action: AUDIT_ACTIONS.FACILITY_UPDATE,
    summary: `${actor.email} updated facility ${doc.name}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return facilityDto(doc);
}

export async function listEmployees(actor: CorporateActor, organizationId?: string) {
  const id =
    organizationId && actor.role === ROLES.ADMIN
      ? organizationId
      : await resolveActorOrganizationId(actor);
  await assertOrgAccess(actor, id);

  const filter: Record<string, unknown> = {
    organizationId: id,
    employeeId: { $exists: true, $ne: null },
  };
  if (
    actor.facilityId &&
    !permissionsInclude(actor.permissions, PERMISSIONS.CASE_VIEW_ORG) &&
    actor.role !== ROLES.ADMIN
  ) {
    filter.facilityId = actor.facilityId;
  }

  const users = await User.find(filter).sort({ createdAt: -1 });
  return Promise.all(users.map((u) => toPublicUserAsync(u)));
}

export async function createEmployee(
  actor: CorporateActor,
  input: CreateEmployeeInput,
  organizationId: string | undefined,
  audit: RequestAuditContext = {},
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.EMPLOYEE_MANAGE) && actor.role !== ROLES.ADMIN) {
    throw new AppError('You cannot manage employees', 403);
  }
  const id =
    organizationId && actor.role === ROLES.ADMIN
      ? organizationId
      : await resolveActorOrganizationId(actor);
  const org = await assertOrgAccess(actor, id);
  if (!org) throw new AppError('Organization not found', 404);

  const facility = await Facility.findById(input.facilityId);
  if (!facility || String(facility.organizationId) !== String(org._id)) {
    throw new AppError('Facility not found in this organization', 404);
  }

  const email = input.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) throw new AppError('A user with this email already exists', 409);

  const role = input.role === 'facility_admin' ? ROLES.FACILITY_ADMIN : ROLES.DOCTOR;
  org.employeeSeq = (org.employeeSeq ?? 0) + 1;
  const employeeId = formatEmployeeId(org.employeeSeq);
  await org.save();

  const temporaryPassword = generateTemporaryPassword();
  const doctorId = role === ROLES.DOCTOR ? await generateDoctorId() : undefined;

  const user = await User.create({
    email,
    password: temporaryPassword,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    role,
    accountType: ACCOUNT_TYPES.CORPORATE,
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
    organizationId: org._id,
    corporateCustomerId: org.corporateCustomerId,
    facilityId: facility._id,
    employeeId,
    doctorId,
    companyName: org.companyName,
    assignedCountry: input.country?.trim() || facility.country || undefined,
    mobile: input.mobile?.trim() || undefined,
    mustChangePassword: true,
    permissionGrants: [],
    permissionDenies: [],
  });

  const loginUrl = `${env.clientUrl}/login?type=corporate`;
  const name = `${user.firstName} ${user.lastName}`.trim();
  try {
    await sendTemplatedEmail(
      user.email,
      temporaryPasswordTemplate({ name, temporaryPassword, loginUrl }),
    );
  } catch (error) {
    console.error('[email] employee temp password failed', error);
    if (env.isDev) console.log(`[employee-temp] ${email} → ${temporaryPassword}`);
  }

  await recordActivity({
    action: AUDIT_ACTIONS.EMPLOYEE_CREATE,
    summary: `${actor.email} created employee ${employeeId} (${email})`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'user',
    targetId: user.id,
    metadata: { employeeId, facilityId: facility.id, role },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return {
    user: await toPublicUserAsync(user),
    ...(env.isDev ? { temporaryPassword } : {}),
  };
}

export async function setEmployeeStatus(
  actor: CorporateActor,
  userId: string,
  accountStatus: typeof ACCOUNT_STATUSES.ACTIVE | typeof ACCOUNT_STATUSES.SUSPENDED | typeof ACCOUNT_STATUSES.BLOCKED,
  audit: RequestAuditContext = {},
) {
  if (!permissionsInclude(actor.permissions, PERMISSIONS.EMPLOYEE_MANAGE) && actor.role !== ROLES.ADMIN) {
    throw new AppError('You cannot manage employees', 403);
  }
  const user = await User.findById(userId);
  if (!user?.organizationId || !user.employeeId) {
    throw new AppError('Employee not found', 404);
  }
  await assertOrgAccess(actor, String(user.organizationId));

  user.accountStatus = accountStatus;
  user.isActive = accountStatus === ACCOUNT_STATUSES.ACTIVE;
  await user.save();

  await recordActivity({
    action: AUDIT_ACTIONS.EMPLOYEE_UPDATE,
    summary: `${actor.email} set employee ${user.employeeId} status to ${accountStatus}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'user',
    targetId: user.id,
    metadata: { accountStatus },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return toPublicUserAsync(user);
}

export async function listSubAccounts(actor: CorporateActor, organizationId?: string) {
  const id =
    organizationId && actor.role === ROLES.ADMIN
      ? organizationId
      : await resolveActorOrganizationId(actor);
  await assertOrgAccess(actor, id);

  const users = await User.find({
    organizationId: id,
    subAccountId: { $exists: true, $ne: null },
  }).sort({ createdAt: -1 });
  return Promise.all(users.map((u) => toPublicUserAsync(u)));
}

export async function createSubAccount(
  actor: CorporateActor,
  input: CreateSubAccountInput,
  audit: RequestAuditContext = {},
) {
  const canManage =
    permissionsInclude(actor.permissions, PERMISSIONS.SUBACCOUNT_MANAGE) ||
    actor.role === ROLES.ADMIN;
  if (!canManage) throw new AppError('You cannot create sub-accounts', 403);

  let orgId = input.organizationId;
  if (actor.role === ROLES.ADMIN) {
    if (!orgId) throw new AppError('organizationId is required for Main Admin', 400);
  } else {
    orgId = await resolveActorOrganizationId(actor);
  }

  const org = await assertOrgAccess(actor, orgId!);
  if (!org) throw new AppError('Organization not found', 404);

  let facility: IFacility | null = null;
  if (input.facilityId) {
    facility = await Facility.findById(input.facilityId);
    if (!facility || String(facility.organizationId) !== String(org._id)) {
      throw new AppError('Facility not found in this organization', 404);
    }
  }

  const email = input.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) throw new AppError('A user with this email already exists', 409);

  org.subAccountSeq = (org.subAccountSeq ?? 0) + 1;
  const subAccountId = formatSubAccountId(org.subAccountSeq, org.corporateCustomerId);
  await org.save();

  const doctorId = await generateDoctorId();
  const rawToken = createRawToken();

  const user = await User.create({
    email,
    // Placeholder until verify issues temp password — login blocked via pendingEmailVerification
    password: generateTemporaryPassword(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    role: ROLES.DOCTOR,
    accountType: ACCOUNT_TYPES.CORPORATE,
    accountStatus: ACCOUNT_STATUSES.SUSPENDED,
    organizationId: org._id,
    corporateCustomerId: org.corporateCustomerId,
    facilityId: facility?._id,
    subAccountId,
    doctorId,
    companyName: org.companyName,
    clinicName: input.practiceName?.trim() || undefined,
    assignedCountry: input.country.trim(),
    mobile: input.mobile?.trim() || undefined,
    pendingEmailVerification: true,
    mustChangePassword: true,
    subAccountVerificationTokenHash: hashToken(rawToken),
    subAccountVerificationExpires: new Date(Date.now() + 48 * 60 * 60 * 1000),
    permissionGrants: [],
    permissionDenies: [],
  });

  const verifyUrl = `${env.clientUrl}/verify-subaccount?token=${rawToken}`;
  const name = `${user.firstName} ${user.lastName}`.trim();
  try {
    await sendTemplatedEmail(email, emailVerificationTemplate({ name, verifyUrl }));
  } catch (error) {
    console.error('[email] subaccount verify failed', error);
    if (env.isDev) console.log(`[subaccount-verify] ${email} → ${verifyUrl}`);
  }

  await recordActivity({
    action: AUDIT_ACTIONS.SUBACCOUNT_CREATE,
    summary: `${actor.email} created sub-account ${subAccountId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'user',
    targetId: user.id,
    metadata: {
      subAccountId,
      organizationId: org.id,
      remarks: input.remarks,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return {
    user: await toPublicUserAsync(user),
    ...(env.isDev ? { verifyUrl } : {}),
  };
}

export async function verifySubAccountEmail(token: string, audit: RequestAuditContext = {}) {
  const hashed = hashToken(token);
  const user = await User.findOne({
    subAccountVerificationTokenHash: hashed,
    subAccountVerificationExpires: { $gt: new Date() },
    pendingEmailVerification: true,
  }).select('+subAccountVerificationTokenHash +subAccountVerificationExpires +password');

  if (!user || !user.subAccountId) {
    throw new AppError('Verification link is invalid or has expired', 400);
  }

  const temporaryPassword = generateTemporaryPassword();
  user.password = temporaryPassword;
  user.pendingEmailVerification = false;
  user.emailVerifiedAt = new Date();
  user.accountStatus = ACCOUNT_STATUSES.ACTIVE;
  user.isActive = true;
  user.mustChangePassword = true;
  user.subAccountVerificationTokenHash = undefined;
  user.subAccountVerificationExpires = undefined;
  await user.save();

  const loginUrl = `${env.clientUrl}/login?type=corporate`;
  const name = `${user.firstName} ${user.lastName}`.trim();
  try {
    await sendTemplatedEmail(
      user.email,
      temporaryPasswordTemplate({ name, temporaryPassword, loginUrl }),
    );
  } catch (error) {
    console.error('[email] subaccount temp password failed', error);
    if (env.isDev) console.log(`[subaccount-temp] ${user.email} → ${temporaryPassword}`);
  }

  await recordActivity({
    action: AUDIT_ACTIONS.SUBACCOUNT_VERIFY,
    summary: `Sub-account ${user.subAccountId} email verified`,
    actorEmail: user.email,
    actorName: name,
    actorRole: user.role,
    targetType: 'user',
    targetId: user.id,
    metadata: { subAccountId: user.subAccountId },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  await recordActivity({
    action: AUDIT_ACTIONS.SUBACCOUNT_ACTIVATE,
    summary: `Sub-account ${user.subAccountId} activated`,
    actorEmail: user.email,
    targetType: 'user',
    targetId: user.id,
    metadata: { subAccountId: user.subAccountId },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return {
    message: 'Email verified. A temporary password has been sent to your inbox.',
    subAccountId: user.subAccountId,
    ...(env.isDev ? { temporaryPassword } : {}),
  };
}

export async function getCorporateDashboard(
  actor: CorporateActor,
  organizationId?: string,
): Promise<CorporateDashboardDto> {
  const id =
    organizationId && actor.role === ROLES.ADMIN
      ? organizationId
      : await resolveActorOrganizationId(actor);
  const org = await assertOrgAccess(actor, id);
  if (!org) throw new AppError('Organization not found', 404);

  const orgObjectId = org._id as Types.ObjectId;
  const [facilityCount, employeeCount, subAccountCount, openCaseCount, facilities] =
    await Promise.all([
      Facility.countDocuments({ organizationId: orgObjectId }),
      User.countDocuments({
        organizationId: orgObjectId,
        employeeId: { $exists: true, $ne: null },
      }),
      User.countDocuments({
        organizationId: orgObjectId,
        subAccountId: { $exists: true, $ne: null },
      }),
      Case.countDocuments({
        organizationId: orgObjectId,
        isDeleted: { $ne: true },
        status: {
          $nin: [CASE_STATUSES.APPROVED, CASE_STATUSES.CANCELLED],
        },
      }),
      Facility.find({ organizationId: orgObjectId }).sort({ name: 1 }).limit(50),
    ]);

  return {
    organization: orgDto(org),
    facilityCount,
    employeeCount,
    subAccountCount,
    openCaseCount,
    facilities: facilities.map(facilityDto),
  };
}

export async function listOrganizationsForAdmin() {
  const orgs = await Organization.find().sort({ companyName: 1 });
  return orgs.map(orgDto);
}

/** Helper for loading actor org fields from User doc */
export function orgFieldsFromUser(user: IUser) {
  return {
    organizationId: user.organizationId ? String(user.organizationId) : null,
    facilityId: user.facilityId ? String(user.facilityId) : null,
    corporateCustomerId: user.corporateCustomerId ?? null,
  };
}
