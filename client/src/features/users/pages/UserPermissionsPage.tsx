import { ROLE_LABELS, ROLES, type Permission, type PublicUser } from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton } from '@/features/auth/components/AuthUI';
import { toast } from '@/features/notifications/toastStore';
import { PermissionEditor } from '@/features/users/components/PermissionEditor';
import * as usersApi from '@/features/users/api';
import { roleDefaultsFor } from '@/features/users/permissionState';
import { getErrorMessage } from '@/lib/api';

export function UserPermissionsPage() {
  const { userId = '' } = useParams();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [catalog, setCatalog] = useState<usersApi.PermissionCatalogItem[]>([]);
  const [grants, setGrants] = useState<Permission[]>([]);
  const [denies, setDenies] = useState<Permission[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [nextUser, nextCatalog] = await Promise.all([
          usersApi.fetchUser(userId),
          usersApi.fetchPermissionCatalog(),
        ]);
        setUser(nextUser);
        setCatalog(nextCatalog);
        setGrants(nextUser.permissionGrants);
        setDenies(nextUser.permissionDenies);
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

  const locked = user.role === ROLES.ADMIN;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link to="/app/users" className="hover:text-brand-700">
            ← Users
          </Link>
        }
        title={`${user.firstName} ${user.lastName}`}
        subtitle={`${user.email} · ${ROLE_LABELS[user.role]} · ${user.permissions.length} effective permissions`}
      />

      {error ? <Alert>{error}</Alert> : null}

      <PermissionEditor
        catalog={catalog}
        roleDefaults={roleDefaultsFor(user.role)}
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
