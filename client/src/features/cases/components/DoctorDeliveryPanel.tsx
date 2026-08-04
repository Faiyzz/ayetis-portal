import {
  DOCTOR_DECISIONS,
  DOCTOR_DECISION_LABELS,
  FILE_RESTORE_PENDING_CODE,
  FILE_STORAGE_TIERS,
  type CaseDetailDto,
  type DoctorDecision,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { dialog } from '@/components/dialog';
import { AuthButton } from '@/features/auth/components/AuthUI';
import {
  downloadAllCaseFiles,
  downloadDeliveryVideo,
  getDeliveryVideoRestoreStatus,
  recordDoctorCaseView,
  restoreDeliveryVideo,
  submitDoctorDecision,
} from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorCode, getErrorMessage } from '@/lib/api';

export function DoctorDeliveryPanel({
  caseData,
  onUpdated,
}: {
  caseData: CaseDetailDto;
  onUpdated: (next: CaseDetailDto) => void;
}) {
  const [decision, setDecision] = useState<DoctorDecision>(DOCTOR_DECISIONS.APPROVE);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const awaiting =
    caseData.status === 'delivered' ||
    (caseData.status === 'approved' && !caseData.doctorDecision);
  const canDownloadFinal =
    caseData.status === 'completed' ||
    caseData.status === 'delivered' ||
    caseData.status === 'approved';

  useEffect(() => {
    if (!awaiting) return;
    void recordDoctorCaseView(caseData.caseId)
      .then(onUpdated)
      .catch(() => {
        // Non-blocking engagement tracking
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData.caseId, awaiting]);

  useEffect(() => {
    if (caseData.delivery?.storageTier !== FILE_STORAGE_TIERS.RESTORING) return;
    const timer = window.setInterval(() => {
      void getDeliveryVideoRestoreStatus(caseData.caseId)
        .then(async (status) => {
          if (status.storageTier === FILE_STORAGE_TIERS.HOT) {
            toast().success('Delivery video restore complete');
            const { fetchCase } = await import('@/features/cases/api');
            onUpdated(await fetchCase(caseData.caseId));
          }
        })
        .catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [caseData.caseId, caseData.delivery?.storageTier, onUpdated]);

  if (!caseData.delivery && !awaiting && caseData.status !== 'completed') {
    return null;
  }

  async function handleDecision(event: FormEvent) {
    event.preventDefault();
    const confirmed = await dialog.confirm({
      title: 'Record doctor decision',
      message: `Record decision: ${DOCTOR_DECISION_LABELS[decision]}?`,
      confirmLabel: 'Record decision',
      tone: decision === DOCTOR_DECISIONS.CANCEL ? 'danger' : 'default',
    });
    if (!confirmed) return;
    setBusy('decision');
    try {
      onUpdated(
        await submitDoctorDecision(caseData.caseId, {
          decision,
          note: note.trim() || undefined,
        }),
      );
      toast().success('Decision recorded');
      setNote('');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to record decision'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
      <div>
        <h2 className="text-sm font-semibold text-emerald-950">Delivery review</h2>
        <p className="mt-1 text-sm text-emerald-900/80">
          Review the video or HTML/view link, then approve, request changes, cancel, or keep under
          review.
        </p>
      </div>

      {caseData.delivery ? (
        <div className="flex flex-wrap gap-3 text-sm">
          {caseData.delivery.viewLink ? (
            <a
              href={caseData.delivery.viewLink}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand-700 underline"
              onClick={() => {
                void recordDoctorCaseView(caseData.caseId).then(onUpdated).catch(() => undefined);
              }}
            >
              Open HTML / view link
            </a>
          ) : null}
          {caseData.delivery.videoFilename ? (
            caseData.delivery.storageTier === FILE_STORAGE_TIERS.COLD ? (
              <button
                type="button"
                className="font-semibold text-brand-700 underline"
                onClick={() => {
                  setBusy('restore-video');
                  void restoreDeliveryVideo(caseData.caseId)
                    .then((updated) => {
                      onUpdated(updated);
                      toast().success('Video restore started');
                    })
                    .catch((err) => toast().error(getErrorMessage(err, 'Unable to restore video')))
                    .finally(() => setBusy(null));
                }}
              >
                {busy === 'restore-video'
                  ? 'Starting restore…'
                  : `Restore cold video (${caseData.delivery.videoFilename})`}
              </button>
            ) : caseData.delivery.storageTier === FILE_STORAGE_TIERS.RESTORING ? (
              <span className="font-medium text-amber-800">Restoring delivery video…</span>
            ) : caseData.delivery.storageTier === FILE_STORAGE_TIERS.PURGED ? (
              <span className="text-muted">Delivery video removed from storage</span>
            ) : (
              <button
                type="button"
                className="font-semibold text-brand-700 underline"
                onClick={() => {
                  void downloadDeliveryVideo(caseData.caseId)
                    .then(() => recordDoctorCaseView(caseData.caseId).then(onUpdated))
                    .catch((err) => {
                      if (getErrorCode(err) === FILE_RESTORE_PENDING_CODE) {
                        toast().warning('Video is in cold storage. Restore it first.');
                      } else {
                        toast().error(getErrorMessage(err, 'Unable to download video'));
                      }
                    });
                }}
              >
                View / download {caseData.delivery.videoFilename}
              </button>
            )
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">No delivery assets attached yet.</p>
      )}

      {canDownloadFinal ? (
        <button
          type="button"
          disabled={busy !== null || caseData.files.length === 0}
          onClick={() => {
            setBusy('download');
            void downloadAllCaseFiles(caseData.caseId)
              .then(() => toast().success('Download started'))
              .catch((err) => toast().error(getErrorMessage(err, 'Unable to download files')))
              .finally(() => setBusy(null));
          }}
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand-300 disabled:opacity-60"
        >
          {busy === 'download' ? 'Preparing…' : 'Download final case files'}
        </button>
      ) : null}

      {caseData.doctorDecision ? (
        <p className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink">
          Your decision:{' '}
          <span className="font-semibold">
            {DOCTOR_DECISION_LABELS[caseData.doctorDecision]}
          </span>
          {caseData.doctorDecisionAt
            ? ` · ${new Date(caseData.doctorDecisionAt).toLocaleString()}`
            : ''}
          {caseData.doctorDecisionNote ? (
            <span className="mt-1 block whitespace-pre-wrap text-muted">
              {caseData.doctorDecisionNote}
            </span>
          ) : null}
        </p>
      ) : null}

      {caseData.doctorEngagement.openedAt ? (
        <p className="text-xs text-muted">
          Opened {new Date(caseData.doctorEngagement.openedAt).toLocaleString()}
          {caseData.doctorEngagement.videoViewedAt
            ? ` · Video ${new Date(caseData.doctorEngagement.videoViewedAt).toLocaleString()}`
            : ''}
          {caseData.doctorEngagement.filesDownloadedAt
            ? ` · Files ${new Date(caseData.doctorEngagement.filesDownloadedAt).toLocaleString()}`
            : ''}
        </p>
      ) : null}

      {awaiting && !caseData.doctorDecision ? (
        <form onSubmit={handleDecision} className="space-y-3 rounded-xl border border-line bg-white p-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Your decision</span>
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value as DoctorDecision)}
              className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            >
              {(Object.values(DOCTOR_DECISIONS) as DoctorDecision[]).map((value) => (
                <option key={value} value={value}>
                  {DOCTOR_DECISION_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">
              Notes
              {decision === DOCTOR_DECISIONS.REQUEST_MODIFICATION ||
              decision === DOCTOR_DECISIONS.CANCEL
                ? ' (required)'
                : ' (optional)'}
            </span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required={
                decision === DOCTOR_DECISIONS.REQUEST_MODIFICATION ||
                decision === DOCTOR_DECISIONS.CANCEL
              }
              className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </label>
          <div className="max-w-xs">
            <AuthButton loading={busy === 'decision'} disabled={busy !== null}>
              Submit decision
            </AuthButton>
          </div>
        </form>
      ) : null}
    </section>
  );
}
