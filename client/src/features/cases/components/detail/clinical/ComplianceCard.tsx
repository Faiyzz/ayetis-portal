import { CASE_STATUS_LABELS, type CaseDetailDto } from '@ayetis/shared';
import { PROTOCOL_WEAR_HOURS, wearScheduleLabel } from './clinicalUtils';

function WearRing({ hours }: { hours: number }) {
  const pct = Math.min(100, Math.round((hours / 24) * 100));
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24" aria-hidden>
      <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" className="text-slate-100" strokeWidth="8" />
      <circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke="currentColor"
        className="text-teal-500"
        strokeWidth="8"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 48 48)"
      />
      <text x="48" y="46" textAnchor="middle" fill="#172033" fontSize="18" fontWeight="600">
        {hours}
      </text>
      <text x="48" y="62" textAnchor="middle" fill="#64748b" fontSize="8" fontWeight="600">
        HRS / DAY
      </text>
    </svg>
  );
}

export function ComplianceCard({ caseData }: { caseData: CaseDetailDto }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const target = PROTOCOL_WEAR_HOURS;
  const engagement = caseData.doctorEngagement;
  const checks = [
    { label: 'Plan opened', done: Boolean(engagement.openedAt || engagement.lastViewedAt) },
    { label: 'Video reviewed', done: Boolean(engagement.videoViewedAt) },
    { label: 'Decision recorded', done: Boolean(engagement.respondedAt || caseData.doctorDecision) },
  ];

  return (
    <article className="flex h-full flex-col rounded-xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Compliance
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-ink">Wear protocol</h3>
          <p className="mt-0.5 text-sm text-muted">
            {wearScheduleLabel(caseData)} · status {CASE_STATUS_LABELS[caseData.status]}
          </p>
        </div>
        <WearRing hours={target} />
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
          Target hours / day
        </p>
        <div className="mt-2 flex items-end gap-1.5">
          {days.map((day, i) => (
            <div key={`${day}-${i}`} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-16 w-full items-end rounded-md bg-slate-50 px-1 pb-1">
                <div
                  className="w-full rounded-sm bg-teal-400/80"
                  style={{ height: `${(target / 24) * 100}%` }}
                  title={`${target}h target`}
                />
              </div>
              <span className="text-[10px] font-semibold text-muted">{day}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Patient wear tracker is not linked. Bars show the 22h/day protocol, not logged usage.
        </p>
      </div>

      <ul className="mt-auto space-y-2 border-t border-line pt-4">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center justify-between text-sm">
            <span className="text-ink">{check.label}</span>
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                check.done ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-muted'
              }`}
            >
              {check.done ? 'Done' : 'Pending'}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
