import {
  ARCH_OPTION_LABELS,
  EMPTY_TREATMENT_INSTRUCTIONS,
  type CaseDetailDto,
} from '@ayetis/shared';
import { IconAlert, IconShield, IconUser } from './ClinicalIcons';
import { clinicalAlertLines, wearScheduleLabel } from './clinicalUtils';

export function PatientOverviewCard({ caseData }: { caseData: CaseDetailDto }) {
  const ti = { ...EMPTY_TREATMENT_INSTRUCTIONS, ...caseData.treatmentInstructions };
  const alerts = clinicalAlertLines(caseData);
  const hasAllergy = alerts.some((line) => /allerg/i.test(line));

  return (
    <article className="flex h-full flex-col rounded-xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Patient overview
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-ink">{caseData.patientName}</h3>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-700">
          <IconUser className="h-5 w-5" />
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Age</dt>
          <dd className="mt-0.5 font-medium text-ink">{caseData.patientAge ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Gender</dt>
          <dd className="mt-0.5 font-medium text-ink">{caseData.patientGender || '—'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Clinic</dt>
          <dd className="mt-0.5 font-medium text-ink">{caseData.clinicName || '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Arches</dt>
          <dd className="mt-0.5 font-medium text-ink">
            {ti.arches ? ARCH_OPTION_LABELS[ti.arches] : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Wear</dt>
          <dd className="mt-0.5 font-medium text-ink">{wearScheduleLabel(caseData)}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-2 border-t border-line pt-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
          {hasAllergy ? (
            <IconAlert className="h-3.5 w-3.5 text-amber-600" />
          ) : (
            <IconShield className="h-3.5 w-3.5 text-teal-600" />
          )}
          Clinical alerts
        </p>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted">No allergies or movement restrictions on file.</p>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((line) => (
              <li
                key={line}
                className={`rounded-lg px-3 py-2 text-sm leading-snug ${
                  /allerg/i.test(line)
                    ? 'bg-amber-50 text-amber-950'
                    : 'bg-slate-50 text-ink'
                }`}
              >
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
