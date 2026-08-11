import { CUT_PHASES, type CaseDetailDto } from '@ayetis/shared';
import { useState, type FormEvent } from 'react';
import { AuthButton } from '@/features/auth/components/AuthUI';
import { requestCutRework } from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function CutReworkPanel({
  caseData,
  onUpdated,
}: {
  caseData: CaseDetailDto;
  onUpdated: (next: CaseDetailDto) => void;
}) {
  const [reason, setReason] = useState('');
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);

  if (caseData.cutPhase !== CUT_PHASES.WAITING_FOR_DESIGNER) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      onUpdated(
        await requestCutRework(caseData.caseId, {
          reason: reason.trim(),
          comments: comments.trim(),
        }),
      );
      toast().success('Cut rework requested');
      setReason('');
      setComments('');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to request cut rework'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-amber-200 px-5 py-3.5">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Request cut rework</h2>
        <p className="mt-0.5 text-sm text-muted">
          Return this case to the cut operator before designer production starts.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 p-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Reason</span>
          <input
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Comments for cut operator</span>
          <textarea
            required
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
        </label>
        <div className="max-w-xs">
          <AuthButton loading={busy}>Request cut rework</AuthButton>
        </div>
      </form>
    </section>
  );
}
