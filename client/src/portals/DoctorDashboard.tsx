import {
  CASE_STATUS_LABELS,
  DOCTOR_DECISION_LABELS,
  type DoctorDeliveryQueueItemDto,
} from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchDoctorDeliveries } from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function DoctorDashboard({ firstName }: { firstName: string }) {
  const [items, setItems] = useState<DoctorDeliveryQueueItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setItems(await fetchDoctorDeliveries());
      } catch (err) {
        toast().error(getErrorMessage(err, 'Unable to load deliveries'));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const awaiting = items.filter(
    (item) =>
      (item.status === 'delivered' || item.status === 'approved') && !item.doctorDecision,
  );

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-line bg-white px-5 py-5 sm:px-6">
        <p className="text-sm font-medium text-brand-600">Doctor portal</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          Welcome, {firstName}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted">
          Review delivered cases, watch explanations, and approve or request modifications.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/app/cases/new"
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Create case
        </Link>
        <Link
          to="/app/cases"
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand-300"
        >
          All my cases
        </Link>
      </div>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Awaiting your review</h2>
        <p className="mt-1 text-sm text-muted">
          {loading
            ? 'Loading…'
            : `${awaiting.length} delivered case${awaiting.length === 1 ? '' : 's'} ready`}
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-muted">Loading deliveries…</p>
        ) : awaiting.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No deliveries waiting for a decision.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {awaiting.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    to={`/app/cases/${item.caseId}`}
                    className="font-semibold text-brand-700 hover:text-brand-800"
                  >
                    {item.caseId}
                  </Link>
                  <p className="text-sm text-ink">{item.patientName}</p>
                  <p className="line-clamp-1 text-xs text-muted">{item.treatmentSummary}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {item.hasDeliveryVideo ? (
                    <span className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-800">
                      Video
                    </span>
                  ) : null}
                  {item.hasDeliveryLink ? (
                    <span className="rounded-md bg-sky-50 px-2 py-1 font-medium text-sky-800">
                      Link
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Recent deliveries</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No delivered cases yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    to={`/app/cases/${item.caseId}`}
                    className="font-semibold text-brand-700 hover:text-brand-800"
                  >
                    {item.caseId}
                  </Link>
                  <p className="text-sm text-ink">{item.patientName}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md bg-brand-50 px-2 py-1 font-medium text-brand-700">
                    {CASE_STATUS_LABELS[item.status as keyof typeof CASE_STATUS_LABELS] ??
                      item.status}
                  </span>
                  {item.doctorDecision ? (
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
                      {DOCTOR_DECISION_LABELS[item.doctorDecision]}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
