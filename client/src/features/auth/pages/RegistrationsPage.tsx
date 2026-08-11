import {
  ACCOUNT_TYPE_LABELS,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUSES,
  type RegistrationRequestDto,
  type RegistrationStatus,
} from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dialog } from '@/components/dialog';
import { PageHeader } from '@/components/PageHeader';
import * as authApi from '@/features/auth/api';
import { usePermissions } from '@/features/auth/permissions';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function RegistrationsPage() {
  const { can, PERMISSIONS } = usePermissions();
  const [items, setItems] = useState<RegistrationRequestDto[]>([]);
  const [status, setStatus] = useState<RegistrationStatus | ''>(
    REGISTRATION_STATUSES.PENDING_APPROVAL,
  );
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await authApi.fetchRegistrations({
        status: status || undefined,
        pageSize: 50,
      });
      setItems(data.items);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load registrations'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function approve(item: RegistrationRequestDto) {
    const confirmed = await dialog.confirm({
      title: 'Approve registration',
      message: `Create an active account for ${item.email}?`,
      confirmLabel: 'Approve & create user',
    });
    if (!confirmed) return;
    try {
      const result = await authApi.approveRegistration(item.id);
      toast().success(
        `Approved ${item.email}`,
        result.user.doctorId ? `Doctor ID ${result.user.doctorId}` : undefined,
      );
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to approve registration'));
    }
  }

  async function reject(item: RegistrationRequestDto) {
    const reason = await dialog.prompt({
      title: 'Reject registration',
      message: `Provide a rejection reason for ${item.email}.`,
      label: 'Reason',
      placeholder: 'Why is this registration rejected?',
      confirmLabel: 'Reject',
      tone: 'danger',
      minLength: 3,
    });
    if (!reason) return;
    try {
      await authApi.rejectRegistration(item.id, reason.trim());
      toast().success('Registration rejected');
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to reject registration'));
    }
  }

  async function hold(item: RegistrationRequestDto) {
    try {
      await authApi.holdRegistration(item.id);
      toast().success('Registration held');
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to hold registration'));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Registration requests"
        subtitle="Review verified registrations before accounts are activated."
      >
        <Link
          to="/app/users"
          className="inline-flex items-center justify-center rounded-lg border border-line px-3.5 py-2 text-sm font-semibold text-ink hover:bg-surface"
        >
          Users
        </Link>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">
          Status{' '}
          <select
            className="ml-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            value={status}
            onChange={(e) => setStatus(e.target.value as RegistrationStatus | '')}
          >
            <option value="">All</option>
            {Object.entries(REGISTRATION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold text-ink">Requests</h2>
        </header>
        {loading ? (
          <p className="px-5 py-8 text-sm text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">No registration requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Applicant</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Organization</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">
                        {item.firstName} {item.lastName}
                      </p>
                      <p className="text-muted">{item.email}</p>
                    </td>
                    <td className="px-5 py-3">{ACCOUNT_TYPE_LABELS[item.accountType]}</td>
                    <td className="px-5 py-3 text-muted">
                      {item.companyName || item.clinicName || '—'}
                    </td>
                    <td className="px-5 py-3">
                      {REGISTRATION_STATUS_LABELS[item.status]}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-2">
                        {can(PERMISSIONS.REGISTRATION_APPROVE) &&
                        (item.status === REGISTRATION_STATUSES.PENDING_APPROVAL ||
                          item.status === REGISTRATION_STATUSES.HELD) ? (
                          <button
                            type="button"
                            onClick={() => void approve(item)}
                            className="font-medium text-brand-600 hover:text-brand-700"
                          >
                            Approve
                          </button>
                        ) : null}
                        {can(PERMISSIONS.REGISTRATION_APPROVE) &&
                        item.status === REGISTRATION_STATUSES.PENDING_APPROVAL ? (
                          <button
                            type="button"
                            onClick={() => void hold(item)}
                            className="font-medium text-muted hover:text-ink"
                          >
                            Hold
                          </button>
                        ) : null}
                        {can(PERMISSIONS.REGISTRATION_REJECT) &&
                        item.status !== REGISTRATION_STATUSES.APPROVED &&
                        item.status !== REGISTRATION_STATUSES.REJECTED ? (
                          <button
                            type="button"
                            onClick={() => void reject(item)}
                            className="font-medium text-red-600 hover:text-red-700"
                          >
                            Reject
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

      {can(PERMISSIONS.REGISTRATION_APPROVE) || can(PERMISSIONS.SETTINGS_MANAGE) ? (
        <section className="rounded-xl border border-line bg-white p-5 text-sm text-muted">
          System messages moved to{' '}
          <Link to="/app/settings" className="font-semibold text-brand-600 hover:text-brand-700">
            Settings → System messages
          </Link>
          .
        </section>
      ) : null}
    </div>
  );
}
