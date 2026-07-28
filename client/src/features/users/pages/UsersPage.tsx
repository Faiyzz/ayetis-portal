import { ROLE_LABELS, type PublicUser } from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { usePermissions } from '@/features/auth/permissions';
import { toast } from '@/features/notifications/toastStore';
import * as usersApi from '@/features/users/api';
import { getErrorMessage } from '@/lib/api';

export function UsersPage() {
  const { can, PERMISSIONS } = usePermissions();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setUsers(await usersApi.fetchUsers());
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load users'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleActive(user: PublicUser) {
    try {
      await usersApi.updateUser(user.id, { isActive: !user.isActive });
      toast().success(`${user.email} ${user.isActive ? 'deactivated' : 'activated'}`);
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update user'));
    }
  }

  async function handleDelete(user: PublicUser) {
    const reason = window.prompt(`Reason for deleting ${user.email}:`);
    if (!reason || reason.trim().length < 3) {
      toast().warning('Deletion requires a reason');
      return;
    }
    if (!window.confirm(`Request deletion of ${user.email}?`)) return;
    if (!window.confirm('Second confirmation: submit delete request to admin?')) return;
    try {
      await usersApi.deleteUser(user.id, reason.trim());
      toast().success('Delete request submitted for admin approval');
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to submit delete request'));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        subtitle="Manage accounts for fixed system roles, then refine permissions per user."
      >
        {can(PERMISSIONS.USER_CREATE) ? (
          <Link
            to="/app/users/create"
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Create user
          </Link>
        ) : null}
      </PageHeader>

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold text-ink">Directory</h2>
        </header>

        {loading ? (
          <p className="px-5 py-8 text-sm text-muted">Loading users…</p>
        ) : users.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">No users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Overrides</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-muted">{user.email}</p>
                    </td>
                    <td className="px-5 py-3 text-ink">{ROLE_LABELS[user.role]}</td>
                    <td className="px-5 py-3 text-muted">
                      +{user.permissionGrants.length} / −{user.permissionDenies.length}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          user.isActive
                            ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700'
                            : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600'
                        }
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-2">
                        {can(PERMISSIONS.USER_ASSIGN_PERMISSIONS) ? (
                          <Link
                            to={`/app/users/${user.id}/permissions`}
                            className="font-medium text-brand-600 hover:text-brand-700"
                          >
                            Permissions
                          </Link>
                        ) : null}
                        {can(PERMISSIONS.USER_UPDATE) ? (
                          <button
                            type="button"
                            onClick={() => void toggleActive(user)}
                            className="font-medium text-muted hover:text-ink"
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        ) : null}
                        {can(PERMISSIONS.USER_DELETE) ? (
                          <button
                            type="button"
                            onClick={() => void handleDelete(user)}
                            className="font-medium text-red-600 hover:text-red-700"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
