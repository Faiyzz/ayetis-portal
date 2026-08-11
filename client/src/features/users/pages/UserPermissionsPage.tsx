import {
  getRoleLabel,
  ROLES,
  toRbacMatrixGroup,
  type Permission,
  type PermissionCatalogItem,
  type PublicUser,
  type RoleDefinitionDto,
} from '@ayetis/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import { toast } from '@/features/notifications/toastStore';
import { fetchRoleDefinitions } from '@/features/rbac/api';
import { PermissionEditor } from '@/features/users/components/PermissionEditor';
import * as usersApi from '@/features/users/api';
import { getErrorMessage } from '@/lib/api';

function combinedRoleDefaults(
  userRoles: string[],
  definitions: RoleDefinitionDto[],
): Permission[] {
  const set = new Set<Permission>();
  for (const roleKey of userRoles) {
    const def = definitions.find((item) => item.key === roleKey);
    if (def) {
      for (const perm of def.defaults) set.add(perm);
    }
  }
  return [...set];
}

export function UserPermissionsPage() {
  const { userId = '' } = useParams();
  const { can, PERMISSIONS } = usePermissions();
  const canEditRoles = can(PERMISSIONS.USER_UPDATE);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>([]);
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinitionDto[]>([]);
  const [grants, setGrants] = useState<Permission[]>([]);
  const [denies, setDenies] = useState<Permission[]>([]);
  const [primaryRole, setPrimaryRole] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [nextUser, nextCatalog, definitions] = await Promise.all([
          usersApi.fetchUser(userId),
          usersApi.fetchPermissionCatalog(),
          fetchRoleDefinitions().catch(() => [] as RoleDefinitionDto[]),
        ]);
        setUser(nextUser);
        setCatalog(
          nextCatalog.map((item) => ({
            ...item,
            group: toRbacMatrixGroup(item.group),
          })),
        );
        setRoleDefinitions(definitions);
        setGrants(nextUser.permissionGrants);
        setDenies(nextUser.permissionDenies);
        setPrimaryRole(nextUser.primaryRole ?? nextUser.role);
        setSelectedRoles(nextUser.roles?.length ? nextUser.roles : [nextUser.role]);
      } catch (err) {
        const message = getErrorMessage(err, 'Unable to load user permissions');
        setError(message);
        toast().error(message);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [userId]);

  const roleDefaults = useMemo(() => {
    if (!user) return [];
    if (roleDefinitions.length) {
      return combinedRoleDefaults(user.roles?.length ? user.roles : [user.role], roleDefinitions);
    }
    return user.permissions.filter(
      (perm) => !user.permissionGrants.includes(perm) && !user.permissionDenies.includes(perm),
    );
  }, [user, roleDefinitions]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const updated = await usersApi.updateUserPermissions(user.id, grants, denies);
      setUser(updated);
      setGrants(updated.permissionGrants);
      setDenies(updated.permissionDenies);
      toast().success('User permissions saved');
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to save permissions');
      setError(message);
      toast().error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRoles() {
    if (!user || !canEditRoles) return;
    if (selectedRoles.length === 0) {
      toast().error('Select at least one role');
      return;
    }
    const nextPrimary = selectedRoles.includes(primaryRole) ? primaryRole : selectedRoles[0];
    setSavingRoles(true);
    try {
      const updated = await usersApi.updateUser(user.id, {
        roles: selectedRoles,
        primaryRole: nextPrimary,
        role: nextPrimary,
      });
      setUser(updated);
      setPrimaryRole(updated.primaryRole ?? updated.role);
      setSelectedRoles(updated.roles?.length ? updated.roles : [updated.role]);
      toast().success('User roles updated');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save roles'));
    } finally {
      setSavingRoles(false);
    }
  }

  function toggleRole(roleKey: string) {
    setSelectedRoles((prev) => {
      if (prev.includes(roleKey)) {
        const next = prev.filter((key) => key !== roleKey);
        return next.length ? next : prev;
      }
      return [...prev, roleKey];
    });
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading permissions…</p>;
  }

  if (!user) {
    return (
      <div className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        <Link to="/app/users" className="text-sm font-semibold text-brand-600">
          Back to users
        </Link>
      </div>
    );
  }

  const locked = user.role === ROLES.ADMIN || user.roles?.includes(ROLES.ADMIN);
  const assignableRoles = roleDefinitions.filter((role) => role.isActive && !role.isDisabled);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link to="/app/users" className="hover:text-brand-700">
            ← Users
          </Link>
        }
        title={`${user.firstName} ${user.lastName}`}
        subtitle={`${user.email} · ${(user.roles ?? [user.role]).map(getRoleLabel).join(', ')} · ${user.permissions.length} effective permissions`}
      />

      {error ? <Alert>{error}</Alert> : null}

      <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Roles</h2>
        <p className="text-sm text-muted">
          Primary: <span className="font-medium text-ink">{getRoleLabel(primaryRole)}</span>
        </p>
        {canEditRoles && assignableRoles.length > 0 ? (
          <>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Primary role</span>
              <select
                value={primaryRole}
                onChange={(e) => setPrimaryRole(e.target.value)}
                className="w-full max-w-sm rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
              >
                {selectedRoles.map((roleKey) => (
                  <option key={roleKey} value={roleKey}>
                    {getRoleLabel(roleKey)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-3">
              {assignableRoles.map((role) => (
                <label key={role.key} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.key)}
                    onChange={() => toggleRole(role.key)}
                  />
                  {role.name}
                </label>
              ))}
            </div>
            <div className="max-w-xs">
              <AuthButton loading={savingRoles} type="button" onClick={() => void handleSaveRoles()}>
                Save roles
              </AuthButton>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink">
            {(user.roles ?? [user.role]).map(getRoleLabel).join(' · ')}
          </p>
        )}
      </section>

      <PermissionEditor
        catalog={catalog}
        roleDefaults={roleDefaults}
        grants={grants}
        denies={denies}
        locked={locked}
        lockedMessage="Admin accounts always receive the full permission set and cannot be customized."
        onChange={({ grants: nextGrants, denies: nextDenies }) => {
          setGrants(nextGrants);
          setDenies(nextDenies);
        }}
      />

      {!locked ? (
        <div className="max-w-xs">
          <AuthButton loading={saving} onClick={() => void handleSave()} type="button">
            Save permissions
          </AuthButton>
        </div>
      ) : null}
    </div>
  );
}
