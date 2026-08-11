import type {
  AssignmentQueue,
  AssignmentRuleDto,
  ExperienceLevel,
  Permission,
  PermissionMatrixDto,
  PortalTemplate,
  QcScope,
  RoleDefinitionDto,
  TeamDto,
} from '@ayetis/shared';
import api from '@/lib/api';

export async function fetchRoleDefinitions(): Promise<RoleDefinitionDto[]> {
  const { data } = await api.get('/rbac/roles');
  return data.data;
}

export async function createRole(payload: {
  key?: string;
  name: string;
  description?: string | null;
  portalTemplate: PortalTemplate;
  qcScope?: QcScope;
  sortOrder?: number;
}): Promise<RoleDefinitionDto> {
  const { data } = await api.post('/rbac/roles', payload);
  return data.data;
}

export async function updateRole(
  key: string,
  payload: {
    name?: string;
    description?: string | null;
    portalTemplate?: PortalTemplate;
    qcScope?: QcScope;
    isActive?: boolean;
    isDisabled?: boolean;
  },
): Promise<RoleDefinitionDto> {
  const { data } = await api.patch(`/rbac/roles/${key}`, payload);
  return data.data;
}

export async function deleteRole(key: string): Promise<RoleDefinitionDto> {
  const { data } = await api.delete(`/rbac/roles/${key}`);
  return data.data;
}

export async function reorderRoles(keys: string[]): Promise<RoleDefinitionDto[]> {
  const { data } = await api.post('/rbac/roles/reorder', { keys });
  return data.data;
}

export async function cloneRole(
  key: string,
  payload: { name: string; key?: string },
): Promise<RoleDefinitionDto> {
  const { data } = await api.post(`/rbac/roles/${key}/clone`, payload);
  return data.data;
}

export async function updateRolePermissions(
  key: string,
  grants: Permission[],
  denies: Permission[],
): Promise<RoleDefinitionDto> {
  const { data } = await api.put(`/rbac/roles/${key}/permissions`, { grants, denies });
  return data.data;
}

export async function fetchPermissionMatrix(): Promise<PermissionMatrixDto> {
  const { data } = await api.get('/rbac/matrix');
  return data.data;
}

export async function fetchTeams(): Promise<TeamDto[]> {
  const { data } = await api.get('/rbac/teams');
  return data.data;
}

export async function upsertTeam(payload: {
  id?: string;
  name: string;
  code?: string | null;
  supervisorIds?: string[];
  memberIds?: string[];
  regionIds?: string[];
  isActive?: boolean;
}): Promise<TeamDto> {
  const { data } = await api.post('/rbac/teams', payload);
  return data.data;
}

export async function patchTeam(
  id: string,
  payload: {
    name?: string;
    code?: string | null;
    supervisorIds?: string[];
    memberIds?: string[];
    regionIds?: string[];
    isActive?: boolean;
  },
): Promise<TeamDto> {
  const { data } = await api.patch(`/rbac/teams/${id}`, payload);
  return data.data;
}

export async function deleteTeam(id: string): Promise<TeamDto> {
  const { data } = await api.delete(`/rbac/teams/${id}`);
  return data.data;
}

export async function fetchAssignmentRules(
  targetQueue?: AssignmentQueue,
): Promise<AssignmentRuleDto[]> {
  const { data } = await api.get('/rbac/assignment-rules', {
    params: targetQueue ? { targetQueue } : undefined,
  });
  return data.data;
}

export async function upsertAssignmentRule(payload: {
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
}): Promise<AssignmentRuleDto> {
  const { data } = await api.post('/rbac/assignment-rules', payload);
  return data.data;
}

export async function patchAssignmentRule(
  id: string,
  payload: Partial<Omit<Parameters<typeof upsertAssignmentRule>[0], 'id'>>,
): Promise<AssignmentRuleDto> {
  const { data } = await api.patch(`/rbac/assignment-rules/${id}`, payload);
  return data.data;
}

export async function deleteAssignmentRule(id: string): Promise<AssignmentRuleDto> {
  const { data } = await api.delete(`/rbac/assignment-rules/${id}`);
  return data.data;
}

export async function reorderAssignmentRules(ids: string[]): Promise<AssignmentRuleDto[]> {
  const { data } = await api.post('/rbac/assignment-rules/reorder', { ids });
  return data.data;
}
