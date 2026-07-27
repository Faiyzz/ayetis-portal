import {
  ALL_PERMISSIONS,
  AUDIT_ACTIONS,
  ROLES,
  ROLE_LABELS,
  getPermissionCatalog,
  getPermissionsForRole,
  isPermission,
  permissionsInclude,
  resolveEffectivePermissions,
  type Permission,
  type PublicUser,
  type Role,
} from '@ayetis/shared';
import {
  RolePermissionConfig,
  buildRolePermissionDto,
  isRoleLocked,
  toRoleOverride,
} from '../../models/RolePermissionConfig';
import { User, type IUser, resolveUserPermissions } from '../../models/User';
import { AppError } from '../../utils/AppError';
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
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    permissionGrants: user.role === ROLES.ADMIN ? [] : [...(user.permissionGrants ?? [])],
    permissionDenies: user.role === ROLES.ADMIN ? [] : [...(user.permissionDenies ?? [])],
    permissions: resolveUserPermissions(user, roleOverrides),
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

  const user = await User.create({
    email: input.email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    permissionGrants: grants,
    permissionDenies: denies,
  });

  if (audit) {
    const actor = await resolveActor(audit.actorId);
    await recordActivity({
      action: AUDIT_ACTIONS.USER_CREATE,
      summary: `${actor?.actorEmail ?? 'Admin'} created user ${user.email} (${user.role})`,
      ...(actor ?? {}),
      targetType: 'user',
      targetId: user.id,
      metadata: { role: user.role, email: user.email },
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
  },
  audit?: RequestAuditContext,
) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (input.isActive === false && user.id === actorId) {
    throw new AppError('You cannot deactivate your own account', 400);
  }

  const before = {
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
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
  }

  if (input.firstName !== undefined) user.firstName = input.firstName;
  if (input.lastName !== undefined) user.lastName = input.lastName;
  if (input.isActive !== undefined) user.isActive = input.isActive;

  await user.save();

  const actor = await resolveActor(actorId);
  await recordActivity({
    action: AUDIT_ACTIONS.USER_UPDATE,
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
  audit?: RequestAuditContext,
) {
  if (userId === actorId) {
    throw new AppError('You cannot delete your own account', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role === ROLES.ADMIN) {
    const adminCount = await User.countDocuments({ role: ROLES.ADMIN, isActive: true });
    if (adminCount <= 1) {
      throw new AppError('Cannot delete the last active admin', 400);
    }
  }

  const deletedEmail = user.email;
  const deletedRole = user.role;
  await user.deleteOne();

  const actor = await resolveActor(actorId);
  await recordActivity({
    action: AUDIT_ACTIONS.USER_DELETE,
    summary: `${actor?.actorEmail ?? 'Admin'} deleted user ${deletedEmail}`,
    ...(actor ?? {}),
    targetType: 'user',
    targetId: userId,
    metadata: { email: deletedEmail, role: deletedRole },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return { id: userId };
}

export function userHasEffectivePermission(
  permissions: readonly Permission[],
  permission: Permission,
): boolean {
  return permissionsInclude(permissions, permission);
}

export async function resolvePermissionsForUserId(userId: string): Promise<Permission[]> {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
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
