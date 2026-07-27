import {
  ALL_CONSULTANT_INDICATORS,
  CONSULTANT_INDICATORS,
  CONSULTANT_INDICATOR_LABELS,
  type CaseDetailDto,
  type ConsultantIndicator,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthButton } from '@/features/auth/components/AuthUI';
import { addClinicalRemark } from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

const INDICATOR_PILL: Record<ConsultantIndicator, string> = {
  [CONSULTANT_INDICATORS.GREEN]: 'bg-emerald-50 text-emerald-800',
  [CONSULTANT_INDICATORS.YELLOW]: 'bg-amber-50 text-amber-900',
  [CONSULTANT_INDICATORS.RED]: 'bg-red-50 text-red-800',
};

export function ClinicalRemarksPanel({
  caseData,
  onUpdated,
}: {
  caseData: CaseDetailDto;
  onUpdated: (next: CaseDetailDto) => void;
}) {
  const [body, setBody] = useState('');
  const [indicator, setIndicator] = useState<ConsultantIndicator>(CONSULTANT_INDICATORS.YELLOW);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBody('');
    setIndicator(caseData.consultantIndicator ?? CONSULTANT_INDICATORS.YELLOW);
  }, [caseData.caseId, caseData.consultantIndicator]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      onUpdated(await addClinicalRemark(caseData.caseId, { body, indicator }));
      setBody('');
      toast().success('Clinical remark added');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to add clinical remark'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Clinical consultation</h2>
          <p className="mt-1 text-sm text-muted">
            Review the treatment plan and guide the designer/QC team with remarks and a status
            colour.
          </p>
        </div>
        {caseData.consultantIndicator ? (
          <span
            className={`rounded-md px-2 py-1 text-xs font-semibold ${INDICATOR_PILL[caseData.consultantIndicator]}`}
          >
            {CONSULTANT_INDICATOR_LABELS[caseData.consultantIndicator]}
          </span>
        ) : (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            Not reviewed
          </span>
        )}
      </div>

      <div className="rounded-lg border border-line bg-surface/40 p-4 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Treatment plan</p>
        <p className="mt-2 whitespace-pre-wrap text-ink">{caseData.treatmentSummary}</p>
        {caseData.instructions ? (
          <p className="mt-3 whitespace-pre-wrap text-muted">{caseData.instructions}</p>
        ) : null}
      </div>

      {caseData.clinicalRemarks.length > 0 ? (
        <ul className="space-y-3">
          {caseData.clinicalRemarks.map((remark) => (
            <li key={remark.id} className="rounded-lg border border-line px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{remark.authorName}</span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${INDICATOR_PILL[remark.indicator]}`}>
                  {CONSULTANT_INDICATOR_LABELS[remark.indicator]}
                </span>
                <span className="text-xs text-muted">
                  {new Date(remark.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-ink">{remark.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No clinical remarks yet.</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Status colour</span>
          <select
            value={indicator}
            onChange={(e) => setIndicator(e.target.value as ConsultantIndicator)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          >
            {ALL_CONSULTANT_INDICATORS.map((value) => (
              <option key={value} value={value}>
                {CONSULTANT_INDICATOR_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Clinical remarks</span>
          <textarea
            rows={4}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Clinical guidance for designer and QC…"
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
        </label>
        <div className="max-w-xs">
          <AuthButton loading={busy}>Save clinical remark</AuthButton>
        </div>
      </form>
    </section>
  );
}
