import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  ALL_PERMISSIONS,
  AUDIT_ACTIONS,
  ROLES,
  ROLE_LABELS,
  canLogin,
  getPermissionCatalog,
  getPermissionsForRole,
  isAccountStatus,
  isPasswordExpired,
  isPermission,
  passwordExpiresAt,
  permissionsInclude,
  resolveEffectivePermissions,
  type AccountStatus,
  type AccountType,
  type Permission,
  type PublicUser,
  type Role,
} from '@ayetis/shared';
import { env } from '../../config/env';
import {
  RolePermissionConfig,
  buildRolePermissionDto,
  isRoleLocked,
  toRoleOverride,
} from '../../models/RolePermissionConfig';
import { generateDoctorId } from '../../models/DoctorCounter';
import { getSystemMessages } from '../../models/SystemConfig';
import { User, type IUser, resolveUserPermissions } from '../../models/User';
import { AppError } from '../../utils/AppError';
import { Types } from 'mongoose';
import {
  generateTemporaryPassword,
  pushPasswordHistory,
} from '../../utils/password';
import { temporaryPasswordTemplate, sendTemplatedEmail } from '../../services/email';
import {
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';

export type ActorAuditContext = RequestAuditContext & {
  actorId: string;
};

async function resolveActor(actorId: string) {
  const actor = await User.findById(actorId);
  if (!actor) return null;
  return {
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: `${actor.firstName} ${actor.lastName}`,
    actorRole: actor.role,
  };
}
function uniquePermissions(values: Permission[]): Permission[] {
  return ALL_PERMISSIONS.filter((permission) => values.includes(permission));
}

function assertValidPermissions(values: string[]): Permission[] {
  const invalid = values.filter((value) => !isPermission(value));
  if (invalid.length > 0) {
    throw new AppError(`Invalid permission(s): ${invalid.join(', ')}`, 400);
  }
  return uniquePermissions(values as Permission[]);
}

function assertNoOverlap(grants: Permission[], denies: Permission[]): void {
  const overlap = grants.filter((permission) => denies.includes(permission));
  if (overlap.length > 0) {
    throw new AppError(
      `A permission cannot be both granted and denied: ${overlap.join(', ')}`,
      400,
    );
  }
}

export async function getRoleOverridesMap(): Promise<
  Map<Role, { grants: Permission[]; denies: Permission[] }>
> {
  const configs = await RolePermissionConfig.find();
  const map = new Map<Role, { grants: Permission[]; denies: Permission[] }>();

  for (const config of configs) {
    map.set(config.role, toRoleOverride(config));
  }

  return map;
}

export async function getRoleOverride(role: Role) {
  if (isRoleLocked(role)) {
    return { grants: [] as Permission[], denies: [] as Permission[] };
  }

  const config = await RolePermissionConfig.findOne({ role });
  return toRoleOverride(config);
}

export function toPublicUser(
  user: IUser,
  roleOverrides?: { grants: Permission[]; denies: Permission[] },
): PublicUser {
  const changedAt = user.passwordChangedAt ?? user.createdAt;
  const expiresAt = passwordExpiresAt(changedAt, env.passwordExpiryDays);
  const expired = isPasswordExpired(changedAt, env.passwordExpiryDays);
  const accountStatus = user.accountStatus ?? ACCOUNT_STATUSES.ACTIVE;
  const accountType = user.accountType ?? ACCOUNT_TYPES.INDIVIDUAL;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    accountType,
    accountStatus,
    doctorId: user.doctorId ?? null,
    clinicName: user.clinicName ?? null,
    companyName: user.companyName ?? null,
    companyAddress: user.companyAddress
      ? {
          street: user.companyAddress.street ?? '',
          city: user.companyAddress.city ?? '',
          state: user.companyAddress.state ?? '',
          country: user.companyAddress.country ?? '',
          postalCode: user.companyAddress.postalCode ?? '',
        }
      : null,
    organizationId: user.organizationId ? String(user.organizationId) : null,
    corporateCustomerId: user.corporateCustomerId ?? null,
    facilityId: user.facilityId ? String(user.facilityId) : null,
    employeeId: user.employeeId ?? null,
    subAccountId: user.subAccountId ?? null,
    assignedCountry: user.assignedCountry ?? null,
    pendingEmailVerification: Boolean(user.pendingEmailVerification),
    slaBusinessHours: user.slaBusinessHours ?? null,
    isActive: accountStatus === ACCOUNT_STATUSES.ACTIVE,
    departmentId: user.departmentId ? String(user.departmentId) : null,
    departmentName: user.departmentName ?? null,
    permissionGrants: user.role === ROLES.ADMIN ? [] : [...(user.permissionGrants ?? [])],
    permissionDenies: user.role === ROLES.ADMIN ? [] : [...(user.permissionDenies ?? [])],
    permissions: resolveUserPermissions(user, roleOverrides),
    mustChangePassword: Boolean(user.mustChangePassword) || expired,
    passwordExpired: expired,
    passwordChangedAt: changedAt ? changedAt.toISOString() : null,
    passwordExpiresAt: expiresAt ? expiresAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function toPublicUserAsync(user: IUser): Promise<PublicUser> {
  const roleOverrides = await getRoleOverride(user.role);
  return toPublicUser(user, roleOverrides);
}

export async function listPermissionCatalog() {
  return getPermissionCatalog();
}

export async function listRolePermissionConfigs() {
  const configs = await RolePermissionConfig.find();
  const byRole = new Map(configs.map((config) => [config.role, config]));

  return Object.keys(ROLE_LABELS).map((role) =>
    buildRolePermissionDto(role as Role, byRole.get(role as Role)),
  );
}

export async function getRolePermissionConfig(role: Role) {
  const config = await RolePermissionConfig.findOne({ role });
  return buildRolePermissionDto(role, config);
}

export async function updateRolePermissionConfig(
  role: Role,
  input: { grants: string[]; denies: string[] },
  audit?: ActorAuditContext,
) {
  if (isRoleLocked(role)) {
    throw new AppError('Admin role permissions cannot be modified', 400);
  }

  const grants = assertValidPermissions(input.grants);
  const denies = assertValidPermissions(input.denies);
  assertNoOverlap(grants, denies);

  const config = await RolePermissionConfig.findOneAndUpdate(
    { role },
    { grants, denies },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (audit) {
    const actor = await resolveActor(audit.actorId);
    await recordActivity({
      action: AUDIT_ACTIONS.ROLE_PERMISSIONS_UPDATE,
      summary: `${actor?.actorEmail ?? 'Admin'} updated ${ROLE_LABELS[role]} role permissions`,
      ...(actor ?? {}),
      targetType: 'role',
      targetId: role,
      metadata: { grants, denies },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });
  }

  return buildRolePermissionDto(role, config);
}

export async function listUsers() {
  const users = await User.find().sort({ createdAt: -1 });
  const roleMap = await getRoleOverridesMap();

  return users.map((user) => toPublicUser(user, roleMap.get(user.role)));
}

export async function getUserById(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  return toPublicUserAsync(user);
}

export async function createUser(
  input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: Role;
    accountType?: AccountType;
    clinicName?: string | null;
    companyName?: string | null;
    departmentId?: string | null;
    permissionGrants?: string[];
    permissionDenies?: string[];
  },
  audit?: ActorAuditContext,
) {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const grants =
    input.role === ROLES.ADMIN ? [] : assertValidPermissions(input.permissionGrants ?? []);
  const denies =
    input.role === ROLES.ADMIN ? [] : assertValidPermissions(input.permissionDenies ?? []);
  if (input.role !== ROLES.ADMIN) {
    assertNoOverlap(grants, denies);
  }

  let departmentId: Types.ObjectId | undefined;
  let departmentName: string | undefined;
  if (input.departmentId) {
    const { Department } = await import('../../models/Department');
    const dept = await Department.findOne({ _id: input.departmentId, isDeleted: false });
    if (!dept) throw new AppError('Department not found', 404);
    departmentId = dept._id as Types.ObjectId;
    departmentName = dept.name;
  }

  const accountType = input.accountType ?? ACCOUNT_TYPES.INDIVIDUAL;
  let doctorId: string | undefined;
  if (input.role === ROLES.DOCTOR) {
    doctorId = await generateDoctorId();
  }

  const user = await User.create({
    email: input.email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    accountType,
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
    doctorId,
    clinicName: input.clinicName ?? undefined,
    companyName: input.companyName ?? undefined,
    departmentId,
    departmentName,
    permissionGrants: grants,
    permissionDenies: denies,
    mustChangePassword: true,
    passwordChangedAt: new Date(),
  });

  if (audit) {
    const actor = await resolveActor(audit.actorId);
    await recordActivity({
      action: AUDIT_ACTIONS.USER_CREATE,
      summary: `${actor?.actorEmail ?? 'Admin'} created user ${user.email} (${user.role})`,
      ...(actor ?? {}),
      targetType: 'user',
      targetId: user.id,
      metadata: { role: user.role, email: user.email, doctorId },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });
  }

  return toPublicUserAsync(user);
}

export async function updateUser(
  userId: string,
  actorId: string,
  input: {
    firstName?: string;
    lastName?: string;
    role?: Role;
    isActive?: boolean;
    accountStatus?: AccountStatus;
    clinicName?: string | null;
    companyName?: string | null;
    departmentId?: string | null;
  },
  audit?: RequestAuditContext,
) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const nextStatus =
    input.accountStatus ??
    (input.isActive === false
      ? ACCOUNT_STATUSES.BLOCKED
      : input.isActive === true
        ? ACCOUNT_STATUSES.ACTIVE
        : undefined);

  if (
    nextStatus &&
    nextStatus !== ACCOUNT_STATUSES.ACTIVE &&
    user.id === actorId
  ) {
    throw new AppError('You cannot suspend or block your own account', 400);
  }

  const before = {
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    accountStatus: user.accountStatus,
    departmentId: user.departmentId ? String(user.departmentId) : null,
  };

  if (input.role && input.role !== user.role) {
    if (user.role === ROLES.ADMIN && user.id === actorId) {
      throw new AppError('You cannot change your own admin role', 400);
    }

    user.role = input.role;

    if (input.role === ROLES.ADMIN) {
      user.permissionGrants = [];
      user.permissionDenies = [];
    }

    if (input.role === ROLES.DOCTOR && !user.doctorId) {
      user.doctorId = await generateDoctorId();
    }
  }

  if (input.firstName !== undefined) user.firstName = input.firstName;
  if (input.lastName !== undefined) user.lastName = input.lastName;
  if (input.clinicName !== undefined) user.clinicName = input.clinicName ?? undefined;
  if (input.companyName !== undefined) user.companyName = input.companyName ?? undefined;

  if (nextStatus) {
    if (!isAccountStatus(nextStatus)) {
      throw new AppError('Invalid account status', 400);
    }
    user.accountStatus = nextStatus;
  } else if (input.isActive !== undefined) {
    user.isActive = input.isActive;
  }

  if (input.departmentId !== undefined) {
    if (!input.departmentId) {
      user.departmentId = undefined;
      user.departmentName = undefined;
    } else {
      const { Department } = await import('../../models/Department');
      const dept = await Department.findOne({ _id: input.departmentId, isDeleted: false });
      if (!dept) throw new AppError('Department not found', 404);
      user.departmentId = dept._id as Types.ObjectId;
      user.departmentName = dept.name;
    }
  }

  await user.save();

  const actor = await resolveActor(actorId);
  const statusChanged = nextStatus && nextStatus !== before.accountStatus;
  await recordActivity({
    action: statusChanged ? AUDIT_ACTIONS.USER_STATUS_CHANGE : AUDIT_ACTIONS.USER_UPDATE,
    summary: `${actor?.actorEmail ?? 'Admin'} updated user ${user.email}`,
    ...(actor ?? {}),
    targetType: 'user',
    targetId: user.id,
    metadata: { before, after: input },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return toPublicUserAsync(user);
}

export async function adminResetPassword(
  userId: string,
  actorId: string,
  audit?: RequestAuditContext,
) {
  const user = await User.findById(userId).select('+password +passwordHistory');
  if (!user) throw new AppError('User not found', 404);

  const temporaryPassword = generateTemporaryPassword();
  pushPasswordHistory(user, user.password);
  user.password = temporaryPassword;
  user.mustChangePassword = true;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  const loginUrl = `${env.clientUrl}/login`;
  try {
    await sendTemplatedEmail(
      user.email,
      temporaryPasswordTemplate({
        name: `${user.firstName} ${user.lastName}`.trim(),
        temporaryPassword,
        loginUrl,
      }),
    );
  } catch (error) {
    console.error('[email] admin-temp-password failed', error);
    if (env.isDev) {
      console.log(`[admin-temp-password] ${user.email} → ${temporaryPassword}`);
    }
  }

  const actor = await resolveActor(actorId);
  await recordActivity({
    action: AUDIT_ACTIONS.USER_PASSWORD_RESET_ADMIN,
    summary: `${actor?.actorEmail ?? 'Admin'} reset password for ${user.email}`,
    ...(actor ?? {}),
    targetType: 'user',
    targetId: user.id,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return {
    message: 'Temporary password generated and emailed. User must change password on next login.',
    user: await toPublicUserAsync(user),
    ...(env.isDev ? { temporaryPassword } : {}),
  };
}

export async function updateUserPermissions(
  userId: string,
  input: { grants: string[]; denies: string[] },
  audit?: ActorAuditContext,
) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role === ROLES.ADMIN) {
    throw new AppError('Admin user permissions cannot be customized', 400);
  }

  const grants = assertValidPermissions(input.grants);
  const denies = assertValidPermissions(input.denies);
  assertNoOverlap(grants, denies);

  user.permissionGrants = grants;
  user.permissionDenies = denies;
  await user.save();

  if (audit) {
    const actor = await resolveActor(audit.actorId);
    await recordActivity({
      action: AUDIT_ACTIONS.USER_PERMISSIONS_UPDATE,
      summary: `${actor?.actorEmail ?? 'Admin'} updated permissions for ${user.email}`,
      ...(actor ?? {}),
      targetType: 'user',
      targetId: user.id,
      metadata: { grants, denies },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });
  }

  return toPublicUserAsync(user);
}

export async function deleteUser(
  userId: string,
  actorId: string,
  reason: string,
  audit?: RequestAuditContext,
) {
  const actor = await resolveActor(actorId);
  if (!actor) throw new AppError('Actor not found', 401);

  const { requestUserDelete } = await import('../deletions/deletions.service');
  return requestUserDelete(
    {
      id: actorId,
      email: actor.actorEmail,
      firstName: actor.actorName.split(' ')[0] ?? 'User',
      lastName: actor.actorName.split(' ').slice(1).join(' ') || '',
      role: actor.actorRole,
      permissions: await resolvePermissionsForUserId(actorId),
    },
    userId,
    reason,
    audit,
  );
}

export function userHasEffectivePermission(
  permissions: readonly Permission[],
  permission: Permission,
): boolean {
  return permissionsInclude(permissions, permission);
}

export async function resolvePermissionsForUserId(userId: string): Promise<Permission[]> {
  const user = await User.findById(userId);
  if (!user || !canLogin(user.accountStatus ?? ACCOUNT_STATUSES.ACTIVE)) {
    throw new AppError('User not found or inactive', 401);
  }

  const roleOverrides = await getRoleOverride(user.role);
  return resolveUserPermissions(user, roleOverrides);
}

export function describeRolePermissions(role: Role) {
  return {
    role,
    label: ROLE_LABELS[role],
    defaults: [...getPermissionsForRole(role)],
    effective: resolveEffectivePermissions({ role }),
  };
}

export async function assertCanSubmitWork(userId: string): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  if (user.accountStatus === ACCOUNT_STATUSES.SUSPENDED) {
    const messages = await getSystemMessages();
    throw new AppError(messages.accountSuspended, 403);
  }
  if (user.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
    throw new AppError('This account cannot submit new work', 403);
  }
  return user;
}
