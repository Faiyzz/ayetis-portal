import {
  ALL_QC_ERROR_CODES,
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  QC_ERROR_CODE_LABELS,
  QC_ERROR_CODES,
  QC_REVIEW_OUTCOMES,
  type CaseDetailDto,
  type QcErrorCode,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthButton } from '@/features/auth/components/AuthUI';
import {
  addQcComment,
  approveQcCase,
  downloadAllCaseFiles,
  downloadDeliveryVideo,
  rejectQcCase,
} from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function QcReviewPanel({
  caseData,
  onUpdated,
}: {
  caseData: CaseDetailDto;
  onUpdated: (next: CaseDetailDto) => void;
}) {
  const [comment, setComment] = useState('');
  const [approveComments, setApproveComments] = useState('');
  const [deliveryViewLink, setDeliveryViewLink] = useState('');
  const [video, setVideo] = useState<File | null>(null);
  const [errorCode, setErrorCode] = useState<QcErrorCode>(QC_ERROR_CODES.FIT_ISSUE);
  const [rejectComments, setRejectComments] = useState('');
  const [requiredChanges, setRequiredChanges] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<'comment' | 'approve' | 'reject'>('comment');

  const inQc = caseData.status === 'qc_review';
  const approved = caseData.status === 'approved' || caseData.status === 'delivered';

  useEffect(() => {
    setComment('');
    setApproveComments('');
    setDeliveryViewLink(caseData.delivery?.viewLink || '');
    setVideo(null);
    setRejectComments('');
    setRequiredChanges('');
    setMode('comment');
  }, [caseData.caseId, caseData.status, caseData.delivery?.viewLink]);

  async function handleComment(event: FormEvent) {
    event.preventDefault();
    setBusy('comment');
    try {
      onUpdated(await addQcComment(caseData.caseId, { comments: comment }));
      setComment('');
      toast().success('QC comment added');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to add QC comment'));
    } finally {
      setBusy(null);
    }
  }

  async function handleApprove(event: FormEvent) {
    event.preventDefault();
    if (!deliveryViewLink.trim() && !video) {
      toast().warning('Upload a delivery video or provide an HTML/view link');
      return;
    }
    if (!window.confirm(`Approve ${caseData.caseId} and release delivery assets?`)) return;

    setBusy('approve');
    try {
      onUpdated(
        await approveQcCase(caseData.caseId, {
          comments: approveComments.trim() || undefined,
          deliveryViewLink: deliveryViewLink.trim() || undefined,
          video,
        }),
      );
      toast().success('Case approved');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to approve case'));
    } finally {
      setBusy(null);
    }
  }

  async function handleReject(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm(`Reject ${caseData.caseId} and return it to the designer?`)) return;

    setBusy('reject');
    try {
      onUpdated(
        await rejectQcCase(caseData.caseId, {
          errorCode,
          comments: rejectComments,
          requiredChanges,
        }),
      );
      toast().success('Case returned to designer');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to reject case'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">QC review</h2>
          <p className="mt-1 text-sm text-muted">
            Open files, document findings, approve with delivery assets, or reject with an error
            code.
          </p>
        </div>
        <button
          type="button"
          disabled={busy !== null || caseData.files.length === 0}
          onClick={() => {
            void downloadAllCaseFiles(caseData.caseId).catch((err) =>
              toast().error(getErrorMessage(err, 'Unable to download files')),
            );
          }}
          className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-brand-300 disabled:opacity-60"
        >
          Download all files
        </button>
      </div>

      {(caseData.qcRejectionCount > 0 || caseData.escalatedForOversight) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {caseData.qcRejectionCount > 0 ? (
            <span className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-900">
              QC rejections: {caseData.qcRejectionCount}
            </span>
          ) : null}
          {caseData.escalatedForOversight ? (
            <span className="rounded-md bg-red-50 px-2 py-1 font-medium text-red-800">
              Escalated for consultant / supervisor oversight
            </span>
          ) : null}
        </div>
      )}

      {caseData.qcReviews.length > 0 ? (
        <div className="rounded-lg border border-line bg-surface/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Review history</p>
          <ul className="mt-3 space-y-3">
            {caseData.qcReviews.slice(0, 6).map((review) => (
              <li key={review.id} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{review.reviewerName}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {review.outcome === QC_REVIEW_OUTCOMES.APPROVED
                      ? 'Approved'
                      : review.outcome === QC_REVIEW_OUTCOMES.REJECTED
                        ? 'Rejected'
                        : 'Comment'}
                  </span>
                  {review.errorCode ? (
                    <span className="text-xs text-muted">
                      {QC_ERROR_CODE_LABELS[review.errorCode]}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted">
                    {new Date(review.createdAt).toLocaleString()}
                  </span>
                </div>
                {review.comments ? (
                  <p className="mt-1 whitespace-pre-wrap text-ink">{review.comments}</p>
                ) : null}
                {review.requiredChanges ? (
                  <p className="mt-1 text-xs text-amber-900">
                    Required: {review.requiredChanges}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {approved && caseData.delivery ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-sm">
          <p className="font-semibold text-emerald-900">Delivery assets</p>
          {caseData.delivery.viewLink ? (
            <p className="mt-2">
              <a
                href={caseData.delivery.viewLink}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-700 underline"
              >
                Open HTML / view link
              </a>
            </p>
          ) : null}
          {caseData.delivery.videoFilename ? (
            <button
              type="button"
              className="mt-2 font-medium text-brand-700 underline"
              onClick={() => {
                void downloadDeliveryVideo(caseData.caseId).catch((err) =>
                  toast().error(getErrorMessage(err, 'Unable to download video')),
                );
              }}
            >
              Download {caseData.delivery.videoFilename}
            </button>
          ) : null}
        </div>
      ) : null}

      {inQc ? (
        <>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['comment', 'Add comments'],
                ['approve', 'Approve'],
                ['reject', 'Reject'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                  mode === id
                    ? 'bg-brand-600 text-white'
                    : 'border border-line text-ink hover:border-brand-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'comment' ? (
            <form onSubmit={handleComment} className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Review comments</span>
                <textarea
                  rows={3}
                  required
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  placeholder="Document findings against quality standards…"
                />
              </label>
              <div className="max-w-xs">
                <AuthButton loading={busy === 'comment'} disabled={busy !== null}>
                  Save comment
                </AuthButton>
              </div>
            </form>
          ) : null}

          {mode === 'approve' ? (
            <form onSubmit={handleApprove} className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Approval notes (optional)</span>
                <textarea
                  rows={2}
                  value={approveComments}
                  onChange={(e) => setApproveComments(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">HTML / view link</span>
                <input
                  type="url"
                  value={deliveryViewLink}
                  onChange={(e) => setDeliveryViewLink(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Delivery video (optional if link set)</span>
                <input
                  type="file"
                  accept="video/*,.mp4,.mov,.webm"
                  onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700"
                />
              </label>
              <div className="max-w-xs">
                <AuthButton loading={busy === 'approve'} disabled={busy !== null}>
                  Approve &amp; deliver
                </AuthButton>
              </div>
            </form>
          ) : null}

          {mode === 'reject' ? (
            <form onSubmit={handleReject} className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Error code</span>
                <select
                  value={errorCode}
                  onChange={(e) => setErrorCode(e.target.value as QcErrorCode)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                >
                  {ALL_QC_ERROR_CODES.map((code) => (
                    <option key={code} value={code}>
                      {QC_ERROR_CODE_LABELS[code]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Comments</span>
                <textarea
                  rows={3}
                  required
                  value={rejectComments}
                  onChange={(e) => setRejectComments(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Required changes</span>
                <textarea
                  rows={3}
                  required
                  value={requiredChanges}
                  onChange={(e) => setRequiredChanges(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  placeholder="Exact fixes the designer must complete before resubmitting…"
                />
              </label>
              <div className="max-w-xs">
                <AuthButton loading={busy === 'reject'} disabled={busy !== null}>
                  Reject &amp; return
                </AuthButton>
              </div>
            </form>
          ) : null}
        </>
      ) : !approved ? (
        <p className="text-sm text-muted">
          This case is not in the QC queue
          {CASE_STATUS_LABELS[caseData.status]
            ? ` (current: ${CASE_STATUS_LABELS[caseData.status]})`
            : ''}
          . Priority: {CASE_PRIORITY_LABELS[caseData.priority]}.
        </p>
      ) : null}
    </section>
  );
}
