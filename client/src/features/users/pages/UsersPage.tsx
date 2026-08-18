import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUSES,
  ACCOUNT_TYPE_LABELS,
  ROLE_LABELS,
  ROLES,
  type AccountStatus,
  type CountryDto,
  type PublicUser,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { dialog } from '@/components/dialog';
import { PageHeader } from '@/components/PageHeader';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import { updateDoctorSlaHours } from '@/features/commercial/api';
import { toast } from '@/features/notifications/toastStore';
import { fetchCountries } from '@/features/settings/api';
import * as usersApi from '@/features/users/api';
import { getErrorMessage } from '@/lib/api';

function userCountry(user: PublicUser) {
  return user.assignedCountry || user.companyAddress?.country || '';
}

export function UsersPage() {
  const { can, PERMISSIONS } = usePermissions();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [countries, setCountries] = useState<CountryDto[]>([]);
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(nextQ = q, nextCountry = country) {
    setLoading(true);
    try {
      setUsers(
        await usersApi.fetchUsers({
          q: nextQ.trim() || undefined,
          country: nextCountry || undefined,
        }),
      );
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load users'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void fetchCountries(true)
      .then(setCountries)
      .catch(() => setCountries([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilter(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  async function setStatus(user: PublicUser, accountStatus: AccountStatus) {
    try {
      await usersApi.updateUser(user.id, { accountStatus });
      toast().success(`${user.email} → ${ACCOUNT_STATUS_LABELS[accountStatus]}`);
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update user status'));
    }
  }

  async function handleResetPassword(user: PublicUser) {
    const confirmed = await dialog.confirm({
      title: 'Reset password',
      message: `Generate a temporary password for ${user.email} and force a change on next login?`,
      confirmLabel: 'Reset password',
    });
    if (!confirmed) return;
    try {
      const result = await usersApi.resetUserPassword(user.id);
      toast().success(result.message, result.temporaryPassword);
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to reset password'));
    }
  }

  async function handleUnlockLogin(user: PublicUser) {
    const confirmed = await dialog.confirm({
      title: 'Clear login lockout',
      message: `Allow ${user.email} to sign in again immediately?`,
      confirmLabel: 'Unlock',
    });
    if (!confirmed) return;
    try {
      await usersApi.unlockUserLogin(user.id);
      toast().success('Login lockout cleared');
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to clear lockout'));
    }
  }

  async function handleDelete(user: PublicUser) {
    const reason = await dialog.prompt({
      title: 'Request user deletion',
      message: `Provide a reason for deleting ${user.email}. This is sent to an admin for approval.`,
      label: 'Reason',
      placeholder: 'Why should this account be deleted?',
      confirmLabel: 'Continue',
      tone: 'danger',
      minLength: 3,
    });
    if (!reason) return;

    const confirmed = await dialog.confirm({
      title: 'Confirm delete request',
      message: `Request deletion of ${user.email}?`,
      confirmLabel: 'Request deletion',
      tone: 'danger',
    });
    if (!confirmed) return;

    const doubleConfirmed = await dialog.confirm({
      title: 'Final confirmation',
      message: 'Submit this delete request to admin for approval? This cannot be undone from here.',
      confirmLabel: 'Submit request',
      tone: 'danger',
    });
    if (!doubleConfirmed) return;

    try {
      await usersApi.deleteUser(user.id, reason.trim());
      toast().success('Delete request submitted for admin approval');
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to submit delete request'));
    }
  }

  async function handleSla(user: PublicUser) {
    const current = user.slaBusinessHours ?? 48;
    const value = await dialog.prompt({
      title: 'Set SLA business hours',
      message: `Business-hour SLA for ${user.email} (excludes weekends). Current: ${current}h.`,
      label: 'SLA hours',
      placeholder: String(current),
      defaultValue: String(current),
      confirmLabel: 'Save SLA',
      minLength: 1,
    });
    if (!value) return;
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours < 1) {
      toast().warning('Enter a positive number of hours');
      return;
    }
    try {
      await updateDoctorSlaHours(user.id, hours);
      toast().success(`SLA set to ${hours}h`);
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update SLA hours'));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        subtitle="Manage accounts, statuses (Active / Suspended / Blocked), and password resets."
      >
        <div className="flex flex-wrap gap-2">
          {can(PERMISSIONS.REGISTRATION_LIST) ? (
            <Link
              to="/app/registrations"
              className="inline-flex items-center justify-center rounded-lg border border-line px-3.5 py-2 text-sm font-semibold text-ink hover:bg-surface"
            >
              Registrations
            </Link>
          ) : null}
          {can(PERMISSIONS.USER_CREATE) ? (
            <Link
              to="/app/users/create"
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Create user
            </Link>
          ) : null}
        </div>
      </PageHeader>

      <form
        onSubmit={handleFilter}
        className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-[1.4fr_1fr_auto]"
      >
        <TextField
          label="Search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, email, doctor ID…"
        />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Country</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          >
            <option value="">All countries</option>
            {countries.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <AuthButton>Filter</AuthButton>
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold text-ink">Directory</h2>
        </header>

        {loading ? (
          <p className="px-5 py-8 text-sm text-muted">Loading users…</p>
        ) : users.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">No matching users.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Role / Type</th>
                  <th className="px-5 py-3 font-medium">Country</th>
                  <th className="px-5 py-3 font-medium">Doctor ID</th>
                  <th className="px-5 py-3 font-medium">SLA</th>
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
                    <td className="px-5 py-3 text-ink">
                      <p>{ROLE_LABELS[user.role]}</p>
                      <p className="text-xs text-muted">
                        {ACCOUNT_TYPE_LABELS[user.accountType]}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-muted">{userCountry(user) || '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted">
                      {user.doctorId || '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted">
                      {user.role === ROLES.DOCTOR
                        ? `${user.slaBusinessHours ?? 48}h`
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={
                            user.accountStatus === ACCOUNT_STATUSES.ACTIVE
                              ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700'
                              : user.accountStatus === ACCOUNT_STATUSES.SUSPENDED
                                ? 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800'
                                : 'rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700'
                          }
                        >
                          {ACCOUNT_STATUS_LABELS[user.accountStatus]}
                        </span>
                        {user.isLocked ? (
                          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800">
                            Login locked
                            {user.lockoutUntil
                              ? ` until ${new Date(user.lockoutUntil).toLocaleString()}`
                              : ''}
                          </span>
                        ) : null}
                      </div>
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
                          <>
                            {user.isLocked ? (
                              <button
                                type="button"
                                onClick={() => void handleUnlockLogin(user)}
                                className="font-medium text-orange-700 hover:text-orange-800"
                              >
                                Unlock login
                              </button>
                            ) : null}
                            {user.accountStatus !== ACCOUNT_STATUSES.ACTIVE ? (
                              <button
                                type="button"
                                onClick={() => void setStatus(user, ACCOUNT_STATUSES.ACTIVE)}
                                className="font-medium text-muted hover:text-ink"
                              >
                                Activate
                              </button>
                            ) : null}
                            {user.accountStatus !== ACCOUNT_STATUSES.SUSPENDED ? (
                              <button
                                type="button"
                                onClick={() => void setStatus(user, ACCOUNT_STATUSES.SUSPENDED)}
                                className="font-medium text-muted hover:text-ink"
                              >
                                Suspend
                              </button>
                            ) : null}
                            {user.accountStatus !== ACCOUNT_STATUSES.BLOCKED ? (
                              <button
                                type="button"
                                onClick={() => void setStatus(user, ACCOUNT_STATUSES.BLOCKED)}
                                className="font-medium text-muted hover:text-ink"
                              >
                                Block
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {can(PERMISSIONS.SLA_CONFIGURE) && user.role === ROLES.DOCTOR ? (
                          <button
                            type="button"
                            onClick={() => void handleSla(user)}
                            className="font-medium text-muted hover:text-ink"
                          >
                            Set SLA
                          </button>
                        ) : null}
                        {can(PERMISSIONS.USER_RESET_PASSWORD) ? (
                          <button
                            type="button"
                            onClick={() => void handleResetPassword(user)}
                            className="font-medium text-muted hover:text-ink"
                          >
                            Reset password
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
