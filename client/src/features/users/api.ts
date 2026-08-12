import type {
  AssignPermissionsInput,
  CreateUserInput,
  Permission,
  PermissionCatalogItem,
  PublicUser,
  Role,
  RolePermissionConfigDto,
  UpdateUserInput,
} from '@ayetis/shared';
import api from '@/lib/api';

export type { PermissionCatalogItem };

export async function fetchPermissionCatalog(): Promise<PermissionCatalogItem[]> {
  const { data } = await api.get('/users/permissions');
  return data.data;
}

export async function fetchRoleConfigs(): Promise<RolePermissionConfigDto[]> {
  const { data } = await api.get('/users/roles');
  return data.data;
}

export async function updateRolePermissions(
  role: Role,
  grants: Permission[],
  denies: Permission[],
): Promise<RolePermissionConfigDto> {
  const payload: AssignPermissionsInput = { grants, denies };
  const { data } = await api.put(`/users/roles/${role}/permissions`, payload);
  return data.data;
}

export async function fetchUsers(): Promise<PublicUser[]> {
  const { data } = await api.get('/users');
  return data.data;
}

export async function fetchUser(userId: string): Promise<PublicUser> {
  const { data } = await api.get(`/users/${userId}`);
  return data.data;
}

export async function createUser(payload: CreateUserInput): Promise<PublicUser> {
  const { data } = await api.post('/users', payload);
  return data.data;
}

export async function updateUser(userId: string, payload: UpdateUserInput): Promise<PublicUser> {
  const { data } = await api.patch(`/users/${userId}`, payload);
  return data.data;
}

export async function updateUserPermissions(
  userId: string,
  grants: Permission[],
  denies: Permission[],
): Promise<PublicUser> {
  const payload: AssignPermissionsInput = { grants, denies };
  const { data } = await api.put(`/users/${userId}/permissions`, payload);
  return data.data;
}

export async function deleteUser(userId: string, reason: string): Promise<void> {
  await api.delete(`/users/${userId}`, { data: { reason } });
}

export async function resetUserPassword(userId: string): Promise<{
  message: string;
  temporaryPassword?: string;
}> {
  const { data } = await api.post(`/users/${userId}/reset-password`);
  return data.data;
}

export async function unlockUserLogin(userId: string): Promise<PublicUser> {
  const { data } = await api.post(`/users/${userId}/unlock-login`);
  return data.data;
}
