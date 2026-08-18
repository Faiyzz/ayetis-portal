import { FILE_RESTORE_PENDING_CODE, FILE_STORAGE_TIERS, type CaseDetailDto } from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthButton } from '@/features/auth/components/AuthUI';
import {
  downloadDeliveryVideo,
  getDeliveryVideoRestoreStatus,
  recordDoctorCaseView,
  restoreDeliveryVideo,
  updateCaseDelivery,
} from '@/features/cases/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorCode, getErrorMessage } from '@/lib/api';

export function CaseViewPanel({
  caseData,
  canEdit,
  isDoctor,
  onUpdated,
}: {
  caseData: CaseDetailDto;
  canEdit: boolean;
  isDoctor: boolean;
  onUpdated: (next: CaseDetailDto) => void;
}) {
  const [viewLink, setViewLink] = useState(caseData.delivery?.viewLink || '');
  const [video, setVideo] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setViewLink(caseData.delivery?.viewLink || '');
    setVideo(null);
  }, [caseData.caseId, caseData.delivery?.viewLink, caseData.delivery?.videoFilename]);

  useEffect(() => {
    if (!isDoctor) return;
    void recordDoctorCaseView(caseData.caseId)
      .then(onUpdated)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData.caseId, isDoctor]);

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

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!viewLink.trim() && !video && !caseData.delivery?.videoFilename) {
      toast().warning('Provide an HTML/view link or a delivery video');
      return;
    }
    setBusy('save');
    try {
      onUpdated(
        await updateCaseDelivery(caseData.caseId, {
          viewLink,
          video,
        }),
      );
      toast().success('Delivery package saved');
      setVideo(null);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save delivery package'));
    } finally {
      setBusy(null);
    }
  }

  const delivery = caseData.delivery;

  return (
    <section className="space-y-5 rounded-xl border border-line bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">View package</h2>
        <p className="mt-1 text-sm text-muted">
          HTML/view link and video for the doctor. Files (STL, photos) stay on the Files tab.
        </p>
      </div>

      {delivery?.viewLink || delivery?.videoFilename ? (
        <div className="flex flex-wrap gap-3 text-sm">
          {delivery.viewLink ? (
            <a
              href={delivery.viewLink}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand-700 underline"
              onClick={() => {
                if (isDoctor) {
                  void recordDoctorCaseView(caseData.caseId).then(onUpdated).catch(() => undefined);
                }
              }}
            >
              Open HTML / view link
            </a>
          ) : null}
          {delivery.videoFilename ? (
            delivery.storageTier === FILE_STORAGE_TIERS.COLD ? (
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
                  : `Restore cold video (${delivery.videoFilename})`}
              </button>
            ) : delivery.storageTier === FILE_STORAGE_TIERS.RESTORING ? (
              <span className="font-medium text-amber-800">Restoring delivery video…</span>
            ) : delivery.storageTier === FILE_STORAGE_TIERS.PURGED ? (
              <span className="text-muted">Delivery video removed from storage</span>
            ) : (
              <button
                type="button"
                className="font-semibold text-brand-700 underline"
                onClick={() => {
                  void downloadDeliveryVideo(caseData.caseId)
                    .then(() => {
                      if (isDoctor) {
                        return recordDoctorCaseView(caseData.caseId).then(onUpdated);
                      }
                    })
                    .catch((err) => {
                      if (getErrorCode(err) === FILE_RESTORE_PENDING_CODE) {
                        toast().warning('Video is in cold storage. Restore it first.');
                      } else {
                        toast().error(getErrorMessage(err, 'Unable to download video'));
                      }
                    });
                }}
              >
                Download {delivery.videoFilename}
              </button>
            )
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">No view link or video has been attached yet.</p>
      )}

      {canEdit ? (
        <form onSubmit={handleSave} className="space-y-3 border-t border-line pt-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">HTML / view link</span>
            <input
              type="url"
              value={viewLink}
              onChange={(e) => setViewLink(e.target.value)}
              placeholder="https://"
              className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Delivery video</span>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700"
            />
            {video ? <p className="text-xs text-muted">{video.name}</p> : null}
            {delivery?.videoFilename && !video ? (
              <p className="text-xs text-muted">Current file: {delivery.videoFilename}</p>
            ) : null}
          </label>
          <div className="max-w-xs">
            <AuthButton loading={busy === 'save'} disabled={busy !== null}>
              Save package
            </AuthButton>
          </div>
        </form>
      ) : null}
    </section>
  );
}
