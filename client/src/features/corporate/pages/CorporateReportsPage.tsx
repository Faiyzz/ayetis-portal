import type { CorporateInsightsDto } from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Alert } from '@/features/auth/components/AuthUI';
import { fetchCorporateInsights } from '@/features/corporate/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function CorporateReportsPage() {
  const [data, setData] = useState<CorporateInsightsDto | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        setData(await fetchCorporateInsights());
      } catch (err) {
        const message = getErrorMessage(err, 'Unable to load corporate report');
        setError(message);
        toast().error(message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Corporate"
        title="Organization report"
        subtitle="Case volume, SLA, facility, and doctor performance for your company."
      >
        <Link to="/app/corporate/audit" className="text-sm font-medium text-brand-600">
          Activity audit
        </Link>
      </PageHeader>
      {error ? <Alert>{error}</Alert> : null}
      {loading ? <p className="text-sm text-muted">Loading…</p> : null}
      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Total cases', data.totalCases],
              ['Open', data.openCases],
              ['Approved', data.approved],
              ['Cancelled', data.cancelled],
              ['SLA breached', data.slaBreached],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-line bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
              </div>
            ))}
          </div>
          <section className="rounded-xl border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">By status</h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              {data.byStatus.map((row) => (
                <li key={row.status} className="flex justify-between py-2">
                  <span>{row.label}</span>
                  <span className="font-semibold">{row.count}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">By facility</h2>
            {data.byFacility.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No facility-tagged cases yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line text-sm">
                {data.byFacility.map((row) => (
                  <li key={row.facilityId} className="flex justify-between py-2">
                    <span>{row.name}</span>
                    <span className="font-semibold">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-line bg-white p-5 overflow-x-auto">
            <h2 className="text-sm font-semibold text-ink">Doctors</h2>
            <table className="mt-3 w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="pb-2">Doctor</th>
                  <th className="pb-2">Cases</th>
                  <th className="pb-2">Approved</th>
                  <th className="pb-2">Modifications</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.byDoctor.map((row) => (
                  <tr key={row.doctorId}>
                    <td className="py-2 font-medium">{row.doctorName}</td>
                    <td className="py-2">{row.count}</td>
                    <td className="py-2">{row.approved}</td>
                    <td className="py-2">{row.modifications}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
}
