import {
  ALL_PERMISSIONS,
  AUDIT_ACTIONS,
  ROLES,
  PORTAL_TEMPLATES,
  SYSTEM_ROLE_SEEDS,
  getPermissionCatalog,
  getPermissionsForRole,
  isPermission,
  PERMISSIONS,
  resolveEffectivePermissions,
  resolveQcScope,
  slugifyRoleKey,
  toRbacMatrixGroup,
  type AssignmentQueue,
  type AssignmentRuleDto,
  type ExperienceLevel,
  type Permission,
  type PermissionMatrixCellDto,
  type PermissionMatrixDto,
  type PortalTemplate,
  type QcScope,
  type RoleDefinitionDto,
  type TeamDto,
} from '@ayetis/shared';
import { Types } from 'mongoose';
import { Case } from '../../models/Case';
import { RolePermissionConfig } from '../../models/RolePermissionConfig';
import {
  AssignmentRule,
  RoleDefinition,
  Team,
  type IAssignmentRule,
  type IRoleDefinition,
  type ITeam,
} from '../../models/Rbac';
import { BusinessConfig } from '../../models/Settings';
import { User, type IUser } from '../../models/User';
import { AppError } from '../../utils/AppError';
import {
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';

export type RbacActor = {
  id: string;
  email: string;
  role: string;
};

const ROLE_CACHE_MS = 30_000;
let roleDefsCache: { at: number; docs: IRoleDefinition[] } | null = null;

function invalidateRoleCache(): void {
  roleDefsCache = null;
}

async function loadRoleDefinitionsCached(): Promise<IRoleDefinition[]> {
  const now = Date.now();
  if (roleDefsCache && now - roleDefsCache.at < ROLE_CACHE_MS) {
    return roleDefsCache.docs;
  }
  const docs = await RoleDefinition.find().sort({ sortOrder: 1, name: 1 });
  roleDefsCache = { at: now, docs };
  return docs;
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

function roleDefaults(key: string, portalTemplate: PortalTemplate): Permission[] {
  const fromKey = getPermissionsForRole(key);
  if (fromKey.length > 0) return [...fromKey];
  if (portalTemplate === PORTAL_TEMPLATES.CUT) {
    return [...getPermissionsForRole('cut_operator')];
  }
  return [...getPermissionsForRole(portalTemplate)];
}

function isRoleAdminLocked(key: string): boolean {
  return key === ROLES.ADMIN;
}

export function resolveUserRoleKeys(
  user: Pick<IUser, 'role' | 'roles' | 'primaryRole'>,
): string[] {
  const primary = user.primaryRole || user.role;
  const extras = user.roles?.length ? user.roles : user.role ? [user.role] : [];
  return Array.from(new Set([primary, ...extras].filter(Boolean) as string[]));
}

export function toRoleDto(doc: IRoleDefinition): RoleDefinitionDto {
  const defaults = roleDefaults(doc.key, doc.portalTemplate);
  const roleKeys = [doc.key];
  const roleOverridesByKey = {
    [doc.key]: {
      grants: doc.permissionGrants ?? [],
      denies: doc.permissionDenies ?? [],
    },
  };
  const effective = resolveEffectivePermissions({
    role: doc.key,
    roles: roleKeys,
    roleOverridesByKey,
  });

  return {
    id: doc.id,
    key: doc.key,
    name: doc.name,
    description: doc.description ?? null,
    portalTemplate: doc.portalTemplate,
    sortOrder: doc.sortOrder ?? 0,
    isSystem: Boolean(doc.isSystem),
    isActive: Boolean(doc.isActive),
    isDisabled: Boolean(doc.isDisabled),
    qcScope: doc.qcScope,
    permissionGrants: [...(doc.permissionGrants ?? [])],
    permissionDenies: [...(doc.permissionDenies ?? [])],
    defaults,
    effective,
    clonedFromKey: doc.clonedFromKey ?? null,
    locked: isRoleAdminLocked(doc.key),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toTeamDto(doc: ITeam): TeamDto {
  return {
    id: doc.id,
    name: doc.name,
    code: doc.code ?? null,
    supervisorIds: (doc.supervisorIds ?? []).map(String),
    memberIds: (doc.memberIds ?? []).map(String),
    regionIds: (doc.regionIds ?? []).map(String),
    isActive: Boolean(doc.isActive),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toAssignmentRuleDto(doc: IAssignmentRule): AssignmentRuleDto {
  return {
    id: doc.id,
    name: doc.name,
    isActive: Boolean(doc.isActive),
    priority: doc.priority ?? 0,
    targetQueue: doc.targetQueue,
    roleKeys: [...(doc.roleKeys ?? [])],
    teamIds: (doc.teamIds ?? []).map(String),
    regionIds: (doc.regionIds ?? []).map(String),
    countryIds: (doc.countryIds ?? []).map(String),
    excludedCountryIds: (doc.excludedCountryIds ?? []).map(String),
    experienceLevels: [...(doc.experienceLevels ?? [])],
    softwareKeys: [...(doc.softwareKeys ?? [])],
    requireAvailable: Boolean(doc.requireAvailable),
    maxOpenCases: doc.maxOpenCases ?? null,
    weight: doc.weight ?? 1,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function auditRbac(
  actor: RbacActor,
  input: {
    action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
    summary: string;
    targetType: 'role' | 'team' | 'assignment_rule';
    targetId?: string;
    metadata?: Record<string, unknown>;
  },
  audit?: RequestAuditContext,
): Promise<void> {
  await recordActivity({
    action: input.action,
    summary: input.summary,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });
}

export async function seedRoleDefinitions(): Promise<void> {
  for (const seed of SYSTEM_ROLE_SEEDS) {
    await RoleDefinition.findOneAndUpdate(
      { key: seed.key },
      {
        $setOnInsert: {
          key: seed.key,
          permissionGrants: [],
          permissionDenies: [],
          isActive: true,
          isDisabled: false,
          description: null,
          clonedFromKey: null,
        },
        $set: {
          name: seed.name,
          qcScope: seed.qcScope,
          isSystem: true,
          portalTemplate: seed.portalTemplate,
          sortOrder: seed.sortOrder,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  const configs = await RolePermissionConfig.find();
  for (const config of configs) {
    const doc = await RoleDefinition.findOne({ key: config.role });
    if (!doc) continue;

    const grantsEmpty = !(doc.permissionGrants?.length);
    const deniesEmpty = !(doc.permissionDenies?.length);
    const hasConfigData = (config.grants?.length ?? 0) > 0 || (config.denies?.length ?? 0) > 0;

    if (grantsEmpty && deniesEmpty && hasConfigData) {
      doc.permissionGrants = [...(config.grants ?? [])];
      doc.permissionDenies = [...(config.denies ?? [])];
      await doc.save();
    }
  }

  const doctorRole = await RoleDefinition.findOne({ key: ROLES.DOCTOR });
  if (doctorRole?.permissionGrants?.includes(PERMISSIONS.CASE_VIEW_FACILITY)) {
    doctorRole.permissionGrants = doctorRole.permissionGrants.filter(
      (permission) => permission !== PERMISSIONS.CASE_VIEW_FACILITY,
    );
    await doctorRole.save();
  }

  invalidateRoleCache();
}

export async function listRoleDefinitions(): Promise<RoleDefinitionDto[]> {
  const docs = await loadRoleDefinitionsCached();
  return docs.filter((d) => d.isActive !== false).map(toRoleDto);
}

export async function getRoleDefinition(key: string): Promise<RoleDefinitionDto> {
  const doc = await RoleDefinition.findOne({ key });
  if (!doc) throw new AppError('Role not found', 404);
  return toRoleDto(doc);
}

export async function createRole(
  input: {
    key?: string;
    name: string;
    description?: string | null;
    portalTemplate: PortalTemplate;
    qcScope?: QcScope;
  },
  actor: RbacActor,
  audit?: RequestAuditContext,
): Promise<RoleDefinitionDto> {
  const key = input.key?.trim() || slugifyRoleKey(input.name);
  if (!key || key.length < 2) {
    throw new AppError('Role key is required', 400);
  }

  const existing = await RoleDefinition.findOne({ key });
  if (existing) throw new AppError('A role with this key already exists', 409);

  const maxSort = await RoleDefinition.findOne().sort({ sortOrder: -1 }).select('sortOrder');
  const doc = await RoleDefinition.create({
    key,
    name: input.name.trim(),
    description: input.description ?? undefined,
    portalTemplate: input.portalTemplate,
    qcScope: input.qcScope ?? 'none',
    sortOrder: (maxSort?.sortOrder ?? 0) + 10,
    isSystem: false,
    isActive: true,
    isDisabled: false,
    permissionGrants: [],
    permissionDenies: [],
  });

  invalidateRoleCache();
  await auditRbac(
    actor,
    {
      action: AUDIT_ACTIONS.ROLE_UPSERT,
      summary: `${actor.email} created role ${doc.name} (${doc.key})`,
      targetType: 'role',
      targetId: doc.key,
    },
    audit,
  );

  return toRoleDto(doc);
}

export async function updateRole(
  key: string,
  input: {
    name?: string;
    description?: string | null;
    portalTemplate?: PortalTemplate;
    qcScope?: QcScope;
    isActive?: boolean;
    isDisabled?: boolean;
  },
  actor: RbacActor,
  audit?: RequestAuditContext,
): Promise<RoleDefinitionDto> {
  const doc = await RoleDefinition.findOne({ key });
  if (!doc) throw new AppError('Role not found', 404);

  if (input.name !== undefined) doc.name = input.name.trim();
  if (input.description !== undefined) doc.description = input.description ?? undefined;
  if (input.portalTemplate !== undefined) doc.portalTemplate = input.portalTemplate;
  if (input.qcScope !== undefined) doc.qcScope = input.qcScope;
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  if (input.isDisabled !== undefined) doc.isDisabled = input.isDisabled;

  await doc.save();
  invalidateRoleCache();

  await auditRbac(
    actor,
    {
      action: AUDIT_ACTIONS.ROLE_UPSERT,
      summary: `${actor.email} updated role ${doc.name} (${doc.key})`,
      targetType: 'role',
      targetId: doc.key,
      metadata: input,
    },
    audit,
  );

  return toRoleDto(doc);
}

export async function deleteRole(
  key: string,
  actor: RbacActor,
  audit?: RequestAuditContext,
): Promise<{ message: string }> {
  if (isRoleAdminLocked(key)) {
    throw new AppError('Admin role cannot be deleted or disabled', 400);
  }

  const doc = await RoleDefinition.findOne({ key });
  if (!doc) throw new AppError('Role not found', 404);

  if (doc.isSystem) {
    doc.isDisabled = true;
    doc.isActive = false;
    await doc.save();
    invalidateRoleCache();
    await auditRbac(
      actor,
      {
        action: AUDIT_ACTIONS.ROLE_DELETE,
        summary: `${actor.email} disabled system role ${doc.name} (${doc.key})`,
        targetType: 'role',
        targetId: doc.key,
      },
      audit,
    );
    return { message: 'System role disabled' };
  }

  await RoleDefinition.deleteOne({ key });
  invalidateRoleCache();
  await auditRbac(
    actor,
    {
      action: AUDIT_ACTIONS.ROLE_DELETE,
      summary: `${actor.email} deleted role ${doc.name} (${doc.key})`,
      targetType: 'role',
      targetId: doc.key,
    },
    audit,
  );

  return { message: 'Role deleted' };
}

export async function cloneRole(
  sourceKey: string,
  input: { name: string; key?: string },
  actor: RbacActor,
  audit?: RequestAuditContext,
): Promise<RoleDefinitionDto> {
  const source = await RoleDefinition.findOne({ key: sourceKey });
  if (!source) throw new AppError('Source role not found', 404);

  const key = input.key?.trim() || slugifyRoleKey(input.name);
  const existing = await RoleDefinition.findOne({ key });
  if (existing) throw new AppError('A role with this key already exists', 409);

  const maxSort = await RoleDefinition.findOne().sort({ sortOrder: -1 }).select('sortOrder');
  const doc = await RoleDefinition.create({
    key,
    name: input.name.trim(),
    description: source.description,
    portalTemplate: source.portalTemplate,
    qcScope: source.qcScope,
    sortOrder: (maxSort?.sortOrder ?? 0) + 10,
    isSystem: false,
    isActive: true,
    isDisabled: false,
    permissionGrants: [...(source.permissionGrants ?? [])],
    permissionDenies: [...(source.permissionDenies ?? [])],
    clonedFromKey: source.key,
  });

  invalidateRoleCache();
  await auditRbac(
    actor,
    {
      action: AUDIT_ACTIONS.ROLE_CLONE,
      summary: `${actor.email} cloned role ${source.key} → ${doc.key}`,
      targetType: 'role',
      targetId: doc.key,
      metadata: { sourceKey: source.key },
    },
    audit,
  );

  return toRoleDto(doc);
}

export async function reorderRoles(
  keys: string[],
  actor: RbacActor,
  audit?: RequestAuditContext,
): Promise<RoleDefinitionDto[]> {
  if (!keys.length) throw new AppError('Role order is required', 400);

  await Promise.all(
    keys.map((key, index) =>
      RoleDefinition.findOneAndUpdate({ key }, { sortOrder: (index + 1) * 10 }),
    ),
  );

  invalidateRoleCache();
  await auditRbac(
    actor,
    {
      action: AUDIT_ACTIONS.ROLE_REORDER,
      summary: `${actor.email} reordered roles`,
      targetType: 'role',
      metadata: { keys },
    },
    audit,
  );

  return listRoleDefinitions();
}

export async function getPermissionMatrix(): Promise<PermissionMatrixDto> {
  const roles = await listRoleDefinitions();
  const permissions = getPermissionCatalog().map((item) => ({
    value: item.value,
    label: item.label,
    group: toRbacMatrixGroup(item.group),
  }));

  return { roles, permissions };
}

export function buildMatrixCells(role: RoleDefinitionDto): PermissionMatrixCellDto[] {
  const defaultSet = new Set(role.defaults);
  const grantSet = new Set(role.permissionGrants);
  const denySet = new Set(role.permissionDenies);

  return ALL_PERMISSIONS.map((permission) => {
    let state: PermissionMatrixCellDto['state'] = 'default';
    if (denySet.has(permission)) state = 'deny';
    else if (grantSet.has(permission)) state = 'grant';
    else if (!defaultSet.has(permission)) state = 'deny';

    return { roleKey: role.key, permission, state };
  });
}

export async function patchRolePermissions(
  key: string,
  grants: string[],
  denies: string[],
  actor: RbacActor,
  audit?: RequestAuditContext,
): Promise<RoleDefinitionDto> {
  if (isRoleAdminLocked(key)) {
    throw new AppError('Admin role permissions cannot be modified', 400);
  }

  const parsedGrants = assertValidPermissions(grants);
  const parsedDenies = assertValidPermissions(denies);
  assertNoOverlap(parsedGrants, parsedDenies);

  const doc = await RoleDefinition.findOneAndUpdate(
    { key },
    { permissionGrants: parsedGrants, permissionDenies: parsedDenies },
    { new: true },
  );

  if (!doc) throw new AppError('Role not found', 404);

  invalidateRoleCache();
  await auditRbac(
    actor,
    {
      action: AUDIT_ACTIONS.ROLE_PERMISSIONS_UPDATE,
      summary: `${actor.email} updated permissions for role ${key}`,
      targetType: 'role',
      targetId: key,
      metadata: { grants: parsedGrants, denies: parsedDenies },
    },
    audit,
  );

  return toRoleDto(doc);
}

export async function listTeams(): Promise<TeamDto[]> {
  const docs = await Team.find().sort({ name: 1 });
  return docs.map(toTeamDto);
}

export async function upsertTeam(
  input: {
    id?: string;
    name: string;
    code?: string | null;
    supervisorIds?: string[];
    memberIds?: string[];
    regionIds?: string[];
    isActive?: boolean;
  },
  actor: RbacActor,
  audit?: RequestAuditContext,
): Promise<TeamDto> {
  const payload = {
    name: input.name.trim(),
    code: input.code?.trim() || undefined,
    supervisorIds: (input.supervisorIds ?? []).map((id) => new Types.ObjectId(id)),
    memberIds: (input.memberIds ?? []).map((id) => new Types.ObjectId(id)),
    regionIds: (input.regionIds ?? []).map((id) => new Types.ObjectId(id)),
    isActive: input.isActive ?? true,
  };

  let doc: ITeam | null;
  if (input.id) {
    doc = await Team.findByIdAndUpdate(input.id, payload, { new: true });
    if (!doc) throw new AppError('Team not found', 404);
  } else {
    doc = await Team.create(payload);
  }

  await auditRbac(
    actor,
    {
      action: AUDIT_ACTIONS.TEAM_UPSERT,
      summary: `${actor.email} saved team ${doc.name}`,
      targetType: 'team',
      targetId: doc.id,
    },
    audit,
  );

  return toTeamDto(doc);
}

export async function deleteTeam(
  id: string,
  actor: RbacActor,
  audit?: RequestAuditContext,
): Promise<{ message: string }> {
  const doc = await Team.findByIdAndDelete(id);
  if (!doc) throw new AppError('Team not found', 404);

  await auditRbac(
    actor,
    {
      action: AUDIT_ACTIONS.TEAM_DELETE,
      summary: `${actor.email} deleted team ${doc.name}`,
      targetType: 'team',
      targetId: id,
    },
    audit,
  );

  return { message: 'Team deleted' };
}

export async function listAssignmentRules(
  targetQueue?: AssignmentQueue,
): Promise<AssignmentRuleDto[]> {
  const filter = targetQueue ? { targetQueue } : {};
  const docs = await AssignmentRule.find(filter).sort({ priority: 1, name: 1 });
  return docs.map(toAssignmentRuleDto);
}

export async function upsertAssignmentRule(
  input: {
    id?: string;
    name: string;
    isActive?: boolean;
    priority?: number;
    targetQueue: AssignmentQueue;
    roleKeys?: string[];
    teamIds?: string[];
    regionIds?: string[];
    countryIds?: string[];
    excludedCountryIds?: string[];
    experienceLevels?: ExperienceLevel[];
    softwareKeys?: string[];
    requireAvailable?: boolean;
    maxOpenCases?: number | null;
    weight?: number;
  },
  actor: RbacActor,
  audit?: RequestAuditContext,
): Promise<AssignmentRuleDto> {
  const payload = {
    name: input.name.trim(),
    isActive: input.isActive ?? true,
    priority: input.priority ?? 0,
    targetQueue: input.targetQueue,
    roleKeys: input.roleKeys ?? [],
    teamIds: (input.teamIds ?? []).map((id) => new Types.ObjectId(id)),
    regionIds: (input.regionIds ?? []).map((id) => new Types.ObjectId(id)),
    countryIds: (input.countryIds ?? []).map((id) => new Types.ObjectId(id)),
    excludedCountryIds: (input.excludedCountryIds ?? []).map((id) => new Types.ObjectId(id)),
    experienceLevels: input.experienceLevels ?? [],
    softwareKeys: input.softwareKeys ?? [],
    requireAvailable: input.requireAvailable ?? true,
    maxOpenCases: input.maxOpenCases ?? null,
    weight: input.weight ?? 1,
  };

  let doc: IAssignmentRule | null;
  if (input.id) {
    doc = await AssignmentRule.findByIdAndUpdate(input.id, payload, { new: true });
    if (!doc) throw new AppError('Assignment rule not found', 404);
  } else {
    doc = await AssignmentRule.create(payload);
  }

  await auditRbac(
    actor,
    {
      action: AUDIT_ACTIONS.ASSIGNMENT_RULE_UPSERT,
      summary: `${actor.email} saved assignment rule ${doc.name}`,
      targetType: 'assignment_rule',
      targetId: doc.id,
    },
    audit,
  );

  return toAssignmentRuleDto(doc);
}

export async function deleteAssignmentRule(
  id: string,
  actor: RbacActor,
  audit?: RequestAuditContext,
): Promise<{ message: string }> {
  const doc = await AssignmentRule.findByIdAndDelete(id);
  if (!doc) throw new AppError('Assignment rule not found', 404);

  await auditRbac(
    actor,
    {
      action: AUDIT_ACTIONS.ASSIGNMENT_RULE_DELETE,
      summary: `${actor.email} deleted assignment rule ${doc.name}`,
      targetType: 'assignment_rule',
      targetId: id,
    },
    audit,
  );

  return { message: 'Assignment rule deleted' };
}

export async function reorderAssignmentRules(
  ids: string[],
  actor: RbacActor,
  audit?: RequestAuditContext,
): Promise<AssignmentRuleDto[]> {
  if (!ids.length) throw new AppError('Rule order is required', 400);

  await Promise.all(
    ids.map((id, index) =>
      AssignmentRule.findByIdAndUpdate(id, { priority: (index + 1) * 10 }),
    ),
  );

  await auditRbac(
    actor,
    {
      action: AUDIT_ACTIONS.ASSIGNMENT_RULE_UPSERT,
      summary: `${actor.email} reordered assignment rules`,
      targetType: 'assignment_rule',
      metadata: { ids },
    },
    audit,
  );

  return listAssignmentRules();
}

export async function buildRoleOverridesByKey(
  roleKeys: string[],
): Promise<Record<string, { grants: Permission[]; denies: Permission[] }>> {
  const docs = await RoleDefinition.find({ key: { $in: roleKeys } });
  const map: Record<string, { grants: Permission[]; denies: Permission[] }> = {};
  for (const doc of docs) {
    map[doc.key] = {
      grants: [...(doc.permissionGrants ?? [])],
      denies: [...(doc.permissionDenies ?? [])],
    };
  }
  return map;
}

export async function resolvePermissionsForUser(
  user: Pick<IUser, 'role' | 'roles' | 'primaryRole' | 'permissionGrants' | 'permissionDenies'>,
): Promise<Permission[]> {
  const roleKeys = resolveUserRoleKeys(user);
  const primary = roleKeys[0] ?? user.role;
  const roleOverridesByKey = await buildRoleOverridesByKey(roleKeys);

  return resolveEffectivePermissions({
    role: primary,
    roles: roleKeys,
    roleOverridesByKey,
    userOverrides: {
      grants: user.permissionGrants ?? [],
      denies: user.permissionDenies ?? [],
    },
  });
}

export async function resolveUserQcScope(
  user: Pick<IUser, 'role' | 'roles' | 'primaryRole'>,
): Promise<QcScope> {
  const roleKeys = resolveUserRoleKeys(user);
  const docs = await RoleDefinition.find({ key: { $in: roleKeys } });
  const scopes = docs.map((d) => d.qcScope);
  return resolveQcScope(scopes);
}

const OPEN_CASE_STATUSES = ['new_case', 'in_process', 'waiting_for_approval'];

function userMatchesRule(
  user: IUser,
  rule: IAssignmentRule,
  geo: { country: string; countryId?: string | null; regionId?: string | null },
  openCaseCount: number,
): boolean {
  const userRoleKeys = resolveUserRoleKeys(user);

  if (rule.roleKeys.length > 0) {
    const match = rule.roleKeys.some((key) => userRoleKeys.includes(key));
    if (!match) return false;
  }

  if (rule.teamIds.length > 0) {
    const userTeams = (user.teamIds ?? []).map(String);
    const ruleTeams = rule.teamIds.map(String);
    if (!ruleTeams.some((id) => userTeams.includes(id))) return false;
  }

  if (rule.requireAvailable && user.isAvailable === false) return false;

  if (rule.experienceLevels.length > 0) {
    if (!user.experienceLevel || !rule.experienceLevels.includes(user.experienceLevel as ExperienceLevel)) {
      return false;
    }
  }

  if (rule.softwareKeys.length > 0) {
    const expertise = user.softwareExpertise ?? [];
    if (!rule.softwareKeys.some((key) => expertise.includes(key))) return false;
  }

  if (rule.maxOpenCases != null && openCaseCount >= rule.maxOpenCases) return false;

  const caseCountryId = geo.countryId ? String(geo.countryId) : '';
  const caseRegionId = geo.regionId ? String(geo.regionId) : '';

  if (rule.excludedCountryIds.length > 0) {
    const excluded = rule.excludedCountryIds.map(String);
    if (caseCountryId && excluded.includes(caseCountryId)) return false;
    const userExcluded = (user.excludedCountryIds ?? []).map(String);
    if (userExcluded.some((id) => excluded.includes(id))) return false;
  }

  if (rule.countryIds.length > 0) {
    const ruleCountries = rule.countryIds.map(String);
    if (!caseCountryId || !ruleCountries.includes(caseCountryId)) return false;
    const scoped = (user.scopedCountryIds ?? []).map(String);
    if (scoped.length > 0 && !ruleCountries.some((id) => scoped.includes(id))) {
      return false;
    }
  }

  if (rule.regionIds.length > 0) {
    const ruleRegions = rule.regionIds.map(String);
    if (!caseRegionId || !ruleRegions.includes(caseRegionId)) return false;
    const userRegions = (user.regionIds ?? []).map(String);
    if (!userRegions.length || !ruleRegions.some((id) => userRegions.includes(id))) {
      return false;
    }
  }

  return true;
}

export async function assignCaseByRules(
  caseDoc: {
    country?: string;
    countryId?: string | null;
    regionId?: string | null;
  },
  targetQueue: AssignmentQueue,
): Promise<string | null> {
  const config = await BusinessConfig.findOne({ key: 'default' });
  if (config && 'autoAssignmentEnabled' in config && config.autoAssignmentEnabled === false) {
    return null;
  }

  const rules = await AssignmentRule.find({ isActive: true, targetQueue }).sort({
    priority: 1,
  });

  if (!rules.length) return null;

  const candidates = await User.find({
    accountStatus: 'active',
    isActive: true,
  });

  const caseGeo = {
    country: caseDoc.country ?? '',
    countryId: caseDoc.countryId ?? null,
    regionId: caseDoc.regionId ?? null,
  };
  const workload = new Map<string, number>();

  for (const user of candidates) {
    const openCount = await Case.countDocuments({
      assignedDesignerId: user._id,
      status: { $in: OPEN_CASE_STATUSES },
    });
    workload.set(String(user._id), openCount);
  }

  for (const rule of rules) {
    const matched = candidates.filter((user) =>
      userMatchesRule(user, rule, caseGeo, workload.get(String(user._id)) ?? 0),
    );

    if (!matched.length) continue;

    matched.sort((a, b) => {
      const loadA = workload.get(String(a._id)) ?? 0;
      const loadB = workload.get(String(b._id)) ?? 0;
      if (loadA !== loadB) return loadA - loadB;
      return (rule.weight ?? 1) > 0 ? 0 : 0;
    });

    return String(matched[0]._id);
  }

  return null;
}

/** Compatibility helper for legacy RolePermissionConfig consumers. */
export function roleDefinitionToLegacyConfigDto(doc: IRoleDefinition) {
  const dto = toRoleDto(doc);
  return {
    role: dto.key,
    grants: isRoleAdminLocked(dto.key) ? [] : dto.permissionGrants,
    denies: isRoleAdminLocked(dto.key) ? [] : dto.permissionDenies,
    defaults: dto.defaults,
    effective: dto.effective,
    locked: dto.locked,
  };
}

export async function listLegacyRolePermissionConfigs() {
  const docs = await RoleDefinition.find({ isDisabled: { $ne: true } }).sort({ sortOrder: 1 });
  return docs.map(roleDefinitionToLegacyConfigDto);
}

export async function getLegacyRolePermissionConfig(role: string) {
  const doc = await RoleDefinition.findOne({ key: role });
  if (!doc) {
    return {
      role,
      grants: [] as Permission[],
      denies: [] as Permission[],
      defaults: [...getPermissionsForRole(role)],
      effective: resolveEffectivePermissions({ role }),
      locked: isRoleAdminLocked(role),
    };
  }
  return roleDefinitionToLegacyConfigDto(doc);
}
