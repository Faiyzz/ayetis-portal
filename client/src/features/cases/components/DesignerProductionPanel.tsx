import {
  ARCH_OPTION_LABELS,
  CASE_STATUS_LABELS,
  EMPTY_TREATMENT_INSTRUCTIONS,
  type ArchOption,
  type CaseDetailDto,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthButton } from '@/features/auth/components/AuthUI';
import {
  startProduction,
  submitCaseToQc,
  updateProductionNotes,
} from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function DesignerProductionPanel({
  caseData,
  onUpdated,
  onOpenClarifications,
}: {
  caseData: CaseDetailDto;
  onUpdated: (next: CaseDetailDto) => void;
  onOpenClarifications: () => void;
}) {
  const [notes, setNotes] = useState(caseData.productionNotes || '');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setNotes(caseData.productionNotes || '');
  }, [caseData.caseId, caseData.productionNotes]);

  const inProduction = caseData.status === 'designer_working';
  const inQc = caseData.status === 'qc_review';
  const waiting = caseData.status === 'waiting_clarification';
  const ti = { ...EMPTY_TREATMENT_INSTRUCTIONS, ...caseData.treatmentInstructions };

  async function handleStart() {
    setBusy('start');
    try {
      onUpdated(await startProduction(caseData.caseId, { notes: notes.trim() || undefined }));
      toast().success('Marked as in production');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to start production'));
    } finally {
      setBusy(null);
    }
  }

  async function handleUpdate(event: FormEvent) {
    event.preventDefault();
    setBusy('notes');
    try {
      onUpdated(await updateProductionNotes(caseData.caseId, { notes }));
      toast().success('Production status updated');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update production'));
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmitQc() {
    if (!window.confirm(`Submit ${caseData.caseId} to the QC queue?`)) return;
    setBusy('qc');
    try {
      onUpdated(await submitCaseToQc(caseData.caseId, { notes: notes.trim() || undefined }));
      toast().success('Submitted to QC queue');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to submit to QC'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-line bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">Designer workspace</h2>
        <p className="mt-1 text-sm text-muted">
          Review instructions, run production, clarify missing info, then send to QC.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Treatment instructions
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
          {(
            [
              ['Summary', caseData.treatmentSummary || '—'],
              [
                'Arches',
                ti.arches ? ARCH_OPTION_LABELS[ti.arches as ArchOption] : '—',
              ],
              ['Appliance', ti.applianceType || '—'],
              ['Retainers', ti.retainers || '—'],
              ['Treatment goal', ti.treatmentGoal || '—'],
              ['Bite details', ti.biteDetails || '—'],
              ['Special requirements', ti.specialRequirements || '—'],
              ['Additional notes', ti.additionalNotes || '—'],
              ['Free-text instructions', caseData.instructions || '—'],
            ] as Array<[string, string]>
          ).map(([label, value]) => (
            <div
              key={label}
              className={
                ['Treatment goal', 'Bite details', 'Special requirements', 'Additional notes', 'Free-text instructions', 'Summary'].includes(
                  label,
                )
                  ? 'sm:col-span-2'
                  : ''
              }
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        {caseData.notes.length > 0 ? (
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Case notes ({caseData.notes.length})
            </p>
            <ul className="mt-2 space-y-2">
              {caseData.notes.slice(0, 5).map((note) => (
                <li key={note.id} className="text-sm">
                  <span className="font-medium text-ink">{note.authorName}: </span>
                  <span className="whitespace-pre-wrap text-ink">{note.body}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md bg-brand-50 px-2 py-1 font-medium text-brand-700">
          {CASE_STATUS_LABELS[caseData.status]}
        </span>
        {caseData.productionStartedAt ? (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
            Production started {new Date(caseData.productionStartedAt).toLocaleString()}
          </span>
        ) : null}
        {caseData.submittedToQcAt ? (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
            Submitted to QC {new Date(caseData.submittedToQcAt).toLocaleString()}
          </span>
        ) : null}
      </div>

      {waiting ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Waiting for doctor clarification.{' '}
          <button type="button" onClick={onOpenClarifications} className="font-semibold underline">
            View thread
          </button>
        </p>
      ) : null}

      <form onSubmit={handleUpdate} className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Production notes</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Progress notes for the team…"
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {!caseData.productionStartedAt && !inQc ? (
            <button
              type="button"
              disabled={busy !== null || waiting}
              onClick={() => void handleStart()}
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy === 'start' ? 'Starting…' : 'Start production'}
            </button>
          ) : null}

          {(inProduction || caseData.productionStartedAt) && !inQc ? (
            <div className="min-w-[9rem]">
              <AuthButton loading={busy === 'notes'} disabled={waiting}>
                Update status
              </AuthButton>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onOpenClarifications}
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100"
          >
            Send clarification
          </button>

          {!inQc && !waiting ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void handleSubmitQc()}
              className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand-300 disabled:opacity-60"
            >
              {busy === 'qc' ? 'Submitting…' : 'Submit to QC queue'}
            </button>
          ) : null}
        </div>
      </form>

      {inQc ? (
        <p className="text-sm text-muted">
          This case is in the QC queue
          {caseData.submittedToQcByName ? ` (submitted by ${caseData.submittedToQcByName})` : ''}.
        </p>
      ) : null}
    </section>
  );
}
