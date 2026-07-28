import {
  ROLE_LABELS,
  type Permission,
  type Role,
  type RolePermissionConfigDto,
} from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import { toast } from '@/features/notifications/toastStore';
import { PermissionEditor } from '@/features/users/components/PermissionEditor';
import * as usersApi from '@/features/users/api';
import { getErrorMessage } from '@/lib/api';

export function RolePermissionsPage() {
  const { can, PERMISSIONS } = usePermissions();
  const [roles, setRoles] = useState<RolePermissionConfigDto[]>([]);
  const [catalog, setCatalog] = useState<usersApi.PermissionCatalogItem[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [grants, setGrants] = useState<Permission[]>([]);
  const [denies, setDenies] = useState<Permission[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [nextRoles, nextCatalog] = await Promise.all([
        usersApi.fetchRoleConfigs(),
        usersApi.fetchPermissionCatalog(),
      ]);
      setRoles(nextRoles);
      setCatalog(nextCatalog);

      const initial = selectedRole
        ? nextRoles.find((role) => role.role === selectedRole) ?? nextRoles[0]
        : nextRoles[0];

      if (initial) {
        setSelectedRole(initial.role);
        setGrants(initial.grants);
        setDenies(initial.denies);
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to load role permissions');
      setError(message);
      toast().error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // intentionally load once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectRole(role: Role) {
    const config = roles.find((item) => item.role === role);
    if (!config) return;
    setSelectedRole(role);
    setGrants(config.grants);
    setDenies(config.denies);
    setError('');
  }

  async function handleSave() {
    if (!selectedRole) return;
    setSaving(true);
    setError('');
    try {
      const updated = await usersApi.updateRolePermissions(selectedRole, grants, denies);
      setRoles((prev) => prev.map((role) => (role.role === updated.role ? updated : role)));
      setGrants(updated.grants);
      setDenies(updated.denies);
      toast().success(`${ROLE_LABELS[updated.role]} permissions saved`);
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to save role permissions');
      setError(message);
      toast().error(message);
    } finally {
      setSaving(false);
    }
  }

  const current = roles.find((role) => role.role === selectedRole) ?? null;
  const canEdit = can(PERMISSIONS.ROLE_ASSIGN_PERMISSIONS);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Role permissions"
        subtitle="System roles are fixed. Adjust grants and denies on top of each role's default permission set."
      />

      {error ? <Alert>{error}</Alert> : null}

      {loading ? (
        <p className="text-sm text-muted">Loading roles…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-line bg-white p-2">
            {roles.map((role) => (
              <button
                key={role.role}
                type="button"
                onClick={() => selectRole(role.role)}
                className={[
                  'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition',
                  selectedRole === role.role
                    ? 'bg-brand-500 text-white'
                    : 'text-ink hover:bg-brand-50',
                ].join(' ')}
              >
                <span className="font-medium">{ROLE_LABELS[role.role]}</span>
                <span className={selectedRole === role.role ? 'text-white/80' : 'text-muted'}>
                  {role.effective.length}
                </span>
              </button>
            ))}
          </aside>

          <div className="space-y-4">
            {current ? (
              <>
                <div className="rounded-2xl border border-line bg-white p-5">
                  <h2 className="text-lg font-semibold text-ink">
                    {ROLE_LABELS[current.role]}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {current.defaults.length} defaults · +{current.grants.length} grants · −
                    {current.denies.length} denies · {current.effective.length} effective
                  </p>
                </div>

                <PermissionEditor
                  catalog={catalog}
                  roleDefaults={current.defaults}
                  grants={grants}
                  denies={denies}
                  locked={current.locked || !canEdit}
                  lockedMessage={
                    current.locked
                      ? 'Admin role always has full access and cannot be customized.'
                      : 'You do not have permission to edit role permissions.'
                  }
                  onChange={({ grants: nextGrants, denies: nextDenies }) => {
                    setGrants(nextGrants);
                    setDenies(nextDenies);
                  }}
                />

                {canEdit && !current.locked ? (
                  <div className="max-w-xs">
                    <AuthButton loading={saving} type="button" onClick={() => void handleSave()}>
                      Save role permissions
                    </AuthButton>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
