import {
  ASSIGNMENT_MODE_LABELS,
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  type CaseDetailDto,
  type DesignerAssigneeDto,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthButton } from '@/features/auth/components/AuthUI';
import {
  assignCase,
  fetchDesignerAssignees,
  markCaseValidated,
  startCaseValidation,
} from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function CaseValidationAssignPanel({
  caseData,
  canValidate,
  canAssign,
  canSetPriority,
  onUpdated,
  onOpenClarifications,
}: {
  caseData: CaseDetailDto;
  canValidate: boolean;
  canAssign: boolean;
  canSetPriority: boolean;
  onUpdated: (next: CaseDetailDto) => void;
  onOpenClarifications: () => void;
}) {
  const [designers, setDesigners] = useState<DesignerAssigneeDto[]>([]);
  const [designerId, setDesignerId] = useState('');
  const [assignMode, setAssignMode] = useState<'designer' | 'auto_queue'>('designer');
  const [force, setForce] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!canAssign) return;
    void fetchDesignerAssignees()
      .then(setDesigners)
      .catch(() => setDesigners([]));
  }, [canAssign]);

  if (!canValidate && !canAssign) return null;

  const validation = caseData.validation;
  const isWaiting = caseData.status === 'in_process';

  async function handleStart() {
    setBusy('start');
    try {
      onUpdated(await startCaseValidation(caseData.caseId));
      toast().success('Validation started');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to start validation'));
    } finally {
      setBusy(null);
    }
  }

  async function handleValidate(event: FormEvent) {
    event.preventDefault();
    setBusy('validate');
    try {
      onUpdated(
        await markCaseValidated(caseData.caseId, {
          force: force || undefined,
          notes: notes.trim() || undefined,
        }),
      );
      toast().success('Case marked as validated');
      setNotes('');
      setForce(false);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to validate case'));
    } finally {
      setBusy(null);
    }
  }

  async function handleAssign(event: FormEvent) {
    event.preventDefault();
    setBusy('assign');
    try {
      onUpdated(
        await assignCase(caseData.caseId, {
          mode: assignMode,
          designerId: assignMode === 'designer' ? designerId : undefined,
        }),
      );
      toast().success(
        assignMode === 'auto_queue'
          ? 'Sent to auto case-pick queue'
          : 'Assigned to designer',
      );
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to assign case'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Validation & assignment</h2>
        <p className="mt-0.5 text-sm text-muted">
          Verify required information and files, then route the case for production.
        </p>
      </div>

      <div className="space-y-4 p-5">
      {canValidate ? (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Checklist</p>
          <ul className="space-y-2">
            {validation.checks.map((check) => (
              <li
                key={check.id}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  check.passed
                    ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                    : 'border-amber-200 bg-amber-50/60 text-amber-900'
                }`}
              >
                <p className="font-medium">
                  {check.passed ? '✓' : '!'} {check.label}
                </p>
                {check.detail ? <p className="mt-0.5 text-xs opacity-80">{check.detail}</p> : null}
              </li>
            ))}
          </ul>

          {validation.validatedAt ? (
            <p className="text-sm text-muted">
              Validated {new Date(validation.validatedAt).toLocaleString()}
              {validation.validatedByName ? ` by ${validation.validatedByName}` : ''}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {caseData.status === 'new_case' ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void handleStart()}
                className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-brand-300 disabled:opacity-60"
              >
                {busy === 'start' ? 'Starting…' : 'Start validation'}
              </button>
            ) : null}

            {!isWaiting ? (
              <form onSubmit={handleValidate} className="w-full space-y-3 rounded-lg border border-dashed border-line p-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink">Validation notes (optional)</span>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={(e) => setForce(e.target.checked)}
                  />
                  Force validate even if soft checklist items fail
                </label>
                <div className="max-w-xs">
                  <AuthButton loading={busy === 'validate'}>
                    {validation.validatedAt ? 'Re-mark validated' : 'Mark as validated'}
                  </AuthButton>
                </div>
              </form>
            ) : (
              <p className="text-sm text-amber-800">
                Waiting for doctor clarification.{' '}
                <button
                  type="button"
                  onClick={onOpenClarifications}
                  className="font-semibold underline"
                >
                  Open clarifications
                </button>
              </p>
            )}

            {!validation.ready && !isWaiting ? (
              <button
                type="button"
                onClick={onOpenClarifications}
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900"
              >
                Send clarification
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {canAssign ? (
        <div className="space-y-3 border-t border-line pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Assignment</p>
          <p className="text-sm text-muted">
            Current: {ASSIGNMENT_MODE_LABELS[caseData.assignmentMode]}
            {caseData.assignedDesignerName ? ` · ${caseData.assignedDesignerName}` : ''}
          </p>

          {!caseData.validatedAt ? (
            <p className="text-sm text-muted">Validate the case before assigning.</p>
          ) : isWaiting ? (
            <p className="text-sm text-muted">Resolve clarifications before assigning.</p>
          ) : (
            <form onSubmit={handleAssign} className="space-y-3">
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="assignMode"
                    checked={assignMode === 'designer'}
                    onChange={() => setAssignMode('designer')}
                  />
                  Specific designer
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="assignMode"
                    checked={assignMode === 'auto_queue'}
                    onChange={() => setAssignMode('auto_queue')}
                  />
                  Auto case-pick queue
                </label>
              </div>

              {assignMode === 'designer' ? (
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink">Designer</span>
                  <select
                    required
                    value={designerId}
                    onChange={(e) => setDesignerId(e.target.value)}
                    className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  >
                    <option value="">Select designer…</option>
                    {designers.map((designer) => (
                      <option key={designer.id} value={designer.id}>
                        {designer.firstName} {designer.lastName} ({designer.email})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="max-w-xs">
                <AuthButton
                  loading={busy === 'assign'}
                  disabled={assignMode === 'designer' && !designerId}
                >
                  {assignMode === 'auto_queue' ? 'Send to auto queue' : 'Assign designer'}
                </AuthButton>
              </div>
            </form>
          )}
        </div>
      ) : null}

      {canSetPriority ? (
        <p className="border-t border-line pt-3 text-xs text-muted">
          Use <span className="font-semibold text-ink">Mark urgent</span> in the header to expedite
          this case. Status: {CASE_STATUS_LABELS[caseData.status]} · Priority:{' '}
          {CASE_PRIORITY_LABELS[caseData.priority]}
        </p>
      ) : null}

      <p className="text-xs text-muted">
        Need the full list?{' '}
        <Link to="/app/cases" className="font-semibold text-brand-700">
          Open cases
        </Link>
      </p>
      </div>
    </section>
  );
}
