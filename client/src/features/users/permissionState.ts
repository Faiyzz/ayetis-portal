import {
  getPermissionsForRole,
  type Permission,
  type PermissionGroup,
} from '@ayetis/shared';
import type { PermissionCatalogItem } from '@/features/users/api';

export type PermissionTriState = 'default' | 'grant' | 'deny';

export function getTriState(
  permission: Permission,
  grants: Permission[],
  denies: Permission[],
): PermissionTriState {
  if (grants.includes(permission)) return 'grant';
  if (denies.includes(permission)) return 'deny';
  return 'default';
}

export function applyTriState(
  permission: Permission,
  next: PermissionTriState,
  grants: Permission[],
  denies: Permission[],
): { grants: Permission[]; denies: Permission[] } {
  const nextGrants = grants.filter((item) => item !== permission);
  const nextDenies = denies.filter((item) => item !== permission);

  if (next === 'grant') nextGrants.push(permission);
  if (next === 'deny') nextDenies.push(permission);

  return { grants: nextGrants, denies: nextDenies };
}

export function groupCatalog(catalog: PermissionCatalogItem[]) {
  const groups = new Map<PermissionGroup | string, PermissionCatalogItem[]>();

  for (const item of catalog) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }

  return [...groups.entries()];
}

export function isDefaultOwned(roleDefaults: Permission[], permission: Permission): boolean {
  return roleDefaults.includes(permission);
}

export function roleDefaultsFor(role: Parameters<typeof getPermissionsForRole>[0]): Permission[] {
  return [...getPermissionsForRole(role)];
}
