import {
  PERMISSIONS,
  permissionsInclude,
  type Permission,
  type PublicUser,
} from '@ayetis/shared';
import { useAuthStore } from '@/features/auth/store';

export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  function can(permission: Permission): boolean {
    if (!user?.permissions) return false;
    return permissionsInclude(user.permissions, permission);
  }

  function canAny(...permissions: Permission[]): boolean {
    return permissions.some((permission) => can(permission));
  }

  return { user, can, canAny, PERMISSIONS };
}

export function userCan(user: PublicUser | null | undefined, permission: Permission): boolean {
  if (!user?.permissions) return false;
  return permissionsInclude(user.permissions, permission);
}
