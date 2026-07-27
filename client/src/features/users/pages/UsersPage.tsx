import { ALL_ROLES, ROLE_LABELS, ROLES, type PublicUser, type Role } from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import * as usersApi from '@/features/users/api';
import { getErrorMessage } from '@/lib/api';

export function UsersPage() {
  const { can, PERMISSIONS } = usePermissions();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: ROLES.DESIGNER as Role,
  });

  async function load() {
    setLoading(true);
    setError('');
    try {
      setUsers(await usersApi.fetchUsers());
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load users'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      await usersApi.createUser(form);
      setSuccess('User created');
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: ROLES.DESIGNER,
      });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create user'));
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(user: PublicUser) {
    setError('');
    setSuccess('');
    try {
      await usersApi.updateUser(user.id, { isActive: !user.isActive });
      setSuccess(`${user.email} ${user.isActive ? 'deactivated' : 'activated'}`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update user'));
    }
  }

  async function handleDelete(user: PublicUser) {
    if (!window.confirm(`Delete ${user.email}? This cannot be undone.`)) return;
    setError('');
    setSuccess('');
    try {
      await usersApi.deleteUser(user.id);
      setSuccess('User deleted');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to delete user'));
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-brand-600">Administration</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Users</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          Create accounts for fixed system roles, then grant or deny extra permissions per user.
        </p>
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      {can(PERMISSIONS.USER_CREATE) ? (
        <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink">Create user</h2>
          <p className="mt-1 text-sm text-muted">
            New roles cannot be invented — pick from the system role list.
          </p>

          <form onSubmit={handleCreate} className="mt-5 grid gap-4 sm:grid-cols-2">
            <TextField
              label="First name"
              required
              value={form.firstName}
              onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
            />
            <TextField
              label="Last name"
              required
              value={form.lastName}
              onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
            />
            <TextField
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <TextField
              label="Temporary password"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-ink">Role</span>
              <select
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as Role }))}
              >
                {ALL_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2 sm:max-w-xs">
              <AuthButton loading={creating}>Create user</AuthButton>
            </div>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
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
