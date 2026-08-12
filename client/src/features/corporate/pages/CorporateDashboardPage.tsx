import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Alert } from '@/features/auth/components/AuthUI';
import * as corporateApi from '@/features/corporate/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';
import type { CorporateDashboardDto } from '@ayetis/shared';

export function CorporateDashboardPage() {
  const [data, setData] = useState<CorporateDashboardDto | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const result = await corporateApi.fetchCorporateDashboard();
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Unable to load corporate dashboard'));
          toast().error(getErrorMessage(err, 'Unable to load corporate dashboard'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Corporate"
        title={data?.organization.companyName ?? 'Corporate home'}
        subtitle="Facilities, employees, sub-accounts, and open cases for your organization."
      />

      {error ? <Alert>{error}</Alert> : null}
      {loading ? <p className="text-sm text-muted">Loading…</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Facilities', value: data.facilityCount, to: '/app/corporate/facilities' },
              { label: 'Employees', value: data.employeeCount, to: '/app/corporate/employees' },
              { label: 'Sub-accounts', value: data.subAccountCount, to: '/app/corporate/subaccounts' },
              { label: 'Open cases', value: data.openCaseCount, to: '/app/cases' },
            ].map((card) => (
              <Link
                key={card.label}
                to={card.to}
                className="rounded-xl border border-line bg-white px-5 py-4 transition hover:border-brand-300"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-semibold text-ink">{card.value}</p>
              </Link>
            ))}
          </div>

          <section className="rounded-xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Company profile</h2>
                <p className="mt-1 text-base font-medium text-ink">
                  {data.organization.companyName || 'Unnamed company'}
                </p>
                <p className="text-sm text-muted">
                  {data.organization.corporateCustomerId}
                  {data.organization.country ? ` · ${data.organization.country}` : ''}
                </p>
              </div>
              <Link
                to="/app/corporate/profile"
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Edit profile
              </Link>
            </div>
            <p className="mt-3 text-sm text-ink">
              {[
                data.organization.address.street,
                data.organization.address.city,
                data.organization.address.state,
                data.organization.address.country,
                data.organization.address.postalCode,
              ]
                .filter(Boolean)
                .join(', ') || 'No address on file'}
            </p>
          </section>

          <section className="rounded-xl border border-line bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Facilities</h2>
              <Link
                to="/app/corporate/facilities"
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Manage
              </Link>
            </div>
            {data.facilities.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No facilities yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {data.facilities.map((f) => (
                  <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-ink">{f.name}</span>
                    <span className="text-muted">
                      {f.city || f.country || '—'} · {f.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
