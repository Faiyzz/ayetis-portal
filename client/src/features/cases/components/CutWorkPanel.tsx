import {
  CUT_PHASE_LABELS,
  CUT_PHASES,
  FILE_CATEGORIES,
  type CaseDetailDto,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { dialog } from '@/components/dialog';
import { AuthButton } from '@/features/auth/components/AuthUI';
import {
  saveCutProgress,
  startCutWork,
  submitCutWork,
} from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function CutWorkPanel({
  caseData,
  onUpdated,
  onOpenFiles,
}: {
  caseData: CaseDetailDto;
  onUpdated: (next: CaseDetailDto) => void;
  onOpenFiles?: () => void;
}) {
  const [notes, setNotes] = useState(caseData.cutNotes || '');
  const [comment, setComment] = useState('');
  const [designerAutoQueue, setDesignerAutoQueue] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setNotes(caseData.cutNotes || '');
  }, [caseData.caseId, caseData.cutNotes]);

  const cutFileCount = caseData.files.filter((file) => file.category === FILE_CATEGORIES.CUT).length;
  const phase = caseData.cutPhase;
  const canStart =
    phase === CUT_PHASES.CUT_QUEUE ||
    phase === CUT_PHASES.CUT_ASSIGNED ||
    phase === CUT_PHASES.CUT_REWORK;
  const canWork =
    phase === CUT_PHASES.CUT_IN_PROGRESS || phase === CUT_PHASES.CUT_REWORK;
  const isActive =
    phase === CUT_PHASES.CUT_QUEUE ||
    phase === CUT_PHASES.CUT_ASSIGNED ||
    phase === CUT_PHASES.CUT_IN_PROGRESS ||
    phase === CUT_PHASES.CUT_REWORK;

  if (!caseData.cutRequired || !isActive) return null;

  async function handleStart() {
    setBusy('start');
    try {
      onUpdated(await startCutWork(caseData.caseId, { notes: notes.trim() || undefined }));
      toast().success('Cut work started');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to start cut work'));
    } finally {
      setBusy(null);
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setBusy('save');
    try {
      onUpdated(
        await saveCutProgress(caseData.caseId, {
          notes,
          comment: comment.trim() || undefined,
        }),
      );
      toast().success('Cut progress saved');
      setComment('');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save cut progress'));
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit() {
    const confirmed = await dialog.confirm({
      title: 'Submit cut work',
      message: `Submit cut work for ${caseData.caseId} and hand off to ${
        designerAutoQueue ? 'the designer auto queue' : 'coordinator assignment'
      }?`,
      confirmLabel: 'Submit cut work',
    });
    if (!confirmed) return;

    setBusy('submit');
    try {
      onUpdated(
        await submitCutWork(caseData.caseId, {
          notes: notes.trim() || undefined,
          designerAutoQueue,
        }),
      );
      toast().success('Cut work submitted');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to submit cut work'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Cut workspace</h2>
        <p className="mt-0.5 text-sm text-muted">
          Process cutting work, upload cut outputs in Files (category: Cut output), then submit for
          designer assignment.
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-brand-50 px-2 py-1 font-medium text-brand-700">
            {CUT_PHASE_LABELS[phase]}
          </span>
          {caseData.cutStartedAt ? (
            <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
              Started {new Date(caseData.cutStartedAt).toLocaleString()}
            </span>
          ) : null}
          <span
            className={`rounded-md px-2 py-1 ${
              cutFileCount > 0
                ? 'bg-emerald-50 font-medium text-emerald-800'
                : 'bg-amber-50 font-medium text-amber-900'
            }`}
          >
            {cutFileCount} cut file{cutFileCount === 1 ? '' : 's'}
          </span>
        </div>

        {caseData.cutRevisions.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Rework history</p>
            <ul className="mt-2 space-y-2">
              {caseData.cutRevisions.map((revision) => (
                <li key={revision.id}>
                  <p className="font-medium">
                    Revision {revision.revision} — {revision.reason}
                  </p>
                  <p className="whitespace-pre-wrap text-xs opacity-90">{revision.comments}</p>
                  <p className="mt-1 text-xs opacity-75">
                    {revision.requestedByName} ·{' '}
                    {new Date(revision.requestedAt).toLocaleString()}
                    {revision.completedAt
                      ? ` · completed ${new Date(revision.completedAt).toLocaleString()}`
                      : ''}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {caseData.cutInternalComments.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Internal notes</p>
            <ul className="mt-2 space-y-2">
              {caseData.cutInternalComments.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-line px-3 py-2 text-sm">
                  <span className="font-medium text-ink">{entry.authorName}: </span>
                  <span className="whitespace-pre-wrap text-ink">{entry.body}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <form onSubmit={handleSave} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Cut notes</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cutting progress and observations…"
              className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </label>

          {canWork ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Add internal comment (optional)</span>
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              />
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {canStart ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void handleStart()}
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {busy === 'start' ? 'Starting…' : 'Start / claim cut work'}
              </button>
            ) : null}

            {canWork ? (
              <>
                <div className="min-w-[9rem]">
                  <AuthButton loading={busy === 'save'}>Save progress</AuthButton>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={designerAutoQueue}
                    onChange={(e) => setDesignerAutoQueue(e.target.checked)}
                  />
                  Send to designer auto queue after submit
                </label>
                <button
                  type="button"
                  disabled={busy !== null || cutFileCount === 0}
                  onClick={() => void handleSubmit()}
                  className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand-300 disabled:opacity-60"
                >
                  {busy === 'submit' ? 'Submitting…' : 'Submit cut work'}
                </button>
              </>
            ) : null}

            {onOpenFiles ? (
              <button
                type="button"
                onClick={onOpenFiles}
                className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand-300"
              >
                Open files
              </button>
            ) : null}
          </div>

          {canWork && cutFileCount === 0 ? (
            <p className="text-sm text-amber-800">
              Upload at least one file with category &quot;Cut output&quot; before submitting.
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
