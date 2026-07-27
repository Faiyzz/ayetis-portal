import {
  CASE_PRIORITIES,
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  EMPTY_TREATMENT_INSTRUCTIONS,
  PAYMENT_STATUS_LABELS,
  PERMISSIONS,
  type CaseDetailDto,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import {
  addCaseNote,
  cancelCase,
  clearCaseUrgent,
  downloadDeliveryVideo,
  fetchCase,
  markCaseUrgent,
  softDeleteCase,
  updateCasePayment,
  updateTreatmentInstructions,
} from '@/features/cases/api';
import { CaseFilesPanel } from '@/features/cases/components/CaseFilesPanel';
import { CaseHistoryPanel } from '@/features/cases/components/CaseHistoryPanel';
import { CasePaymentPanel } from '@/features/cases/components/CasePaymentPanel';
import { CaseStatusTimeline } from '@/features/cases/components/CaseStatusTimeline';
import { CaseValidationAssignPanel } from '@/features/cases/components/CaseValidationAssignPanel';
import { ClarificationsPanel } from '@/features/cases/components/ClarificationsPanel';
import { ClinicalRemarksPanel } from '@/features/cases/components/ClinicalRemarksPanel';
import { DesignerProductionPanel } from '@/features/cases/components/DesignerProductionPanel';
import { DoctorDeliveryPanel } from '@/features/cases/components/DoctorDeliveryPanel';
import { QcReviewPanel } from '@/features/cases/components/QcReviewPanel';
import { TreatmentInstructionsPanel } from '@/features/cases/components/TreatmentInstructionsPanel';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function CaseDetailPage() {
  const { caseId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { can, canAny, user } = usePermissions();
  const [caseData, setCaseData] = useState<CaseDetailDto | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [priorityBusy, setPriorityBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [treatmentBusy, setTreatmentBusy] = useState(false);

  const tab = searchParams.get('tab') === 'clarifications' ? 'clarifications' : 'overview';
  const canUpload = canAny(PERMISSIONS.CASE_CREATE, PERMISSIONS.CASE_UPDATE);
  const showFullAudit = canAny(PERMISSIONS.AUDIT_VIEW, PERMISSIONS.CASE_VIEW_ALL);
  const canEditTreatment =
    can(PERMISSIONS.CASE_UPDATE) ||
    (can(PERMISSIONS.CASE_CREATE) && caseData && user?.id === caseData.doctorId);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setCaseData(await fetchCase(caseId));
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to load case');
      setError(message);
      toast().error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function handleAddNote(event: FormEvent) {
    event.preventDefault();
    if (!caseData) return;
    setSavingNote(true);
    try {
      const updated = await addCaseNote(caseData.caseId, { body: note });
      setCaseData(updated);
      setNote('');
      toast().success('Note added');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to add note'));
    } finally {
      setSavingNote(false);
    }
  }

  async function handlePriorityToggle() {
    if (!caseData) return;
    setPriorityBusy(true);
    try {
      const updated =
        caseData.priority === CASE_PRIORITIES.URGENT
          ? await clearCaseUrgent(caseData.caseId)
          : await markCaseUrgent(caseData.caseId);
      setCaseData(updated);
      toast().success(
        updated.priority === CASE_PRIORITIES.URGENT
          ? 'Marked as Urgent Priority'
          : 'Urgent priority cleared',
      );
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update priority'));
    } finally {
      setPriorityBusy(false);
    }
  }

  async function handleCancel() {
    if (!caseData) return;
    const reason = window.prompt('Reason for cancelling this case:');
    if (!reason || reason.trim().length < 3) {
      toast().warning('Cancellation requires a reason');
      return;
    }
    if (!window.confirm(`Cancel case ${caseData.caseId}?`)) return;

    try {
      const updated = await cancelCase(caseData.caseId, { reason: reason.trim() });
      setCaseData(updated);
      toast().success('Case cancelled');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to cancel case'));
    }
  }

  async function handleDelete() {
    if (!caseData) return;
    const reason = window.prompt('Reason for deleting this case (soft delete):');
    if (!reason || reason.trim().length < 3) {
      toast().warning('Deletion requires a reason');
      return;
    }
    if (!window.confirm(`Delete case ${caseData.caseId}?`)) return;
    if (!window.confirm('Final confirmation: soft-delete this case?')) return;

    try {
      const updated = await softDeleteCase(caseData.caseId, { reason: reason.trim() });
      setCaseData(updated);
      toast().success('Case soft-deleted');
      navigate('/app/cases');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to delete case'));
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading case…</p>;
  }

  if (!caseData) {
    return (
      <div className="space-y-3">
        {error ? <Alert>{error}</Alert> : null}
        <Link to="/app/cases" className="text-sm font-semibold text-brand-600">
          Back to cases
        </Link>
      </div>
    );
  }

  const isUrgent = caseData.priority === CASE_PRIORITIES.URGENT;
  const isCancelled = caseData.status === 'cancelled';
  const waitingClarification = caseData.status === 'waiting_clarification';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link to="/app/cases" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            ← Cases
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">{caseData.caseId}</h1>
          <p className="mt-1 text-[15px] text-muted">{caseData.treatmentSummary}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-brand-50 px-2 py-1 font-medium text-brand-700">
              {CASE_STATUS_LABELS[caseData.status]}
            </span>
            <span
              className={`rounded-md px-2 py-1 font-medium ${
                isUrgent ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {CASE_PRIORITY_LABELS[caseData.priority]}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
              {PAYMENT_STATUS_LABELS[caseData.paymentStatus]}
            </span>
            {caseData.openClarificationCount > 0 ? (
              <span className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-800">
                {caseData.openClarificationCount} open clarification
                {caseData.openClarificationCount === 1 ? '' : 's'}
              </span>
            ) : null}
            {caseData.isDeleted ? (
              <span className="rounded-md bg-red-50 px-2 py-1 font-medium text-red-700">
                Soft-deleted
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {can(PERMISSIONS.CASE_SET_PRIORITY) && !caseData.isDeleted ? (
            <button
              type="button"
              disabled={priorityBusy}
              onClick={() => void handlePriorityToggle()}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${
                isUrgent
                  ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-50'
              }`}
            >
              {priorityBusy ? 'Updating…' : isUrgent ? 'Clear urgent' : 'Mark urgent'}
            </button>
          ) : null}
          {can(PERMISSIONS.CASE_UPDATE) && !caseData.isDeleted ? (
            <Link
              to={`/app/cases/${caseData.caseId}/edit`}
              className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand-300"
            >
              Edit
            </Link>
          ) : null}
          {(can(PERMISSIONS.CASE_UPDATE) || can(PERMISSIONS.CASE_DELETE)) &&
          !caseData.isDeleted &&
          !isCancelled ? (
            <button
              type="button"
              onClick={() => void handleCancel()}
              className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50"
            >
              Cancel case
            </button>
          ) : null}
          {can(PERMISSIONS.CASE_DELETE) && !caseData.isDeleted ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Soft delete
            </button>
          ) : null}
        </div>
      </div>

      {waitingClarification ? (
        <Alert tone="info">
          This case is waiting for clarification. Open the Clarifications tab to review or reply.
        </Alert>
      ) : null}

      <div className="flex gap-2 border-b border-line pb-px">
        {(
          [
            ['overview', 'Overview'],
            ['clarifications', `Clarifications (${caseData.clarifications.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true })
            }
            className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
              tab === id
                ? 'border border-b-white border-line bg-white text-brand-700'
                : 'text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'clarifications' ? (
        <ClarificationsPanel
          caseId={caseData.caseId}
          clarifications={caseData.clarifications}
          onChanged={load}
        />
      ) : (
        <>
          <CaseStatusTimeline
            steps={caseData.timeline}
            currentLabel={CASE_STATUS_LABELS[caseData.status]}
            isCancelled={isCancelled}
          />

          {(can(PERMISSIONS.CASE_VALIDATE) || can(PERMISSIONS.CASE_ASSIGN)) &&
          !caseData.isDeleted ? (
            <CaseValidationAssignPanel
              caseData={caseData}
              canValidate={can(PERMISSIONS.CASE_VALIDATE)}
              canAssign={can(PERMISSIONS.CASE_ASSIGN)}
              canSetPriority={can(PERMISSIONS.CASE_SET_PRIORITY)}
              onUpdated={setCaseData}
              onOpenClarifications={() =>
                setSearchParams({ tab: 'clarifications' }, { replace: true })
              }
            />
          ) : null}

          {can(PERMISSIONS.CASE_DESIGN) && !caseData.isDeleted ? (
            <DesignerProductionPanel
              caseData={caseData}
              onUpdated={setCaseData}
              onOpenClarifications={() =>
                setSearchParams({ tab: 'clarifications' }, { replace: true })
              }
            />
          ) : null}

          {can(PERMISSIONS.CASE_QC_REVIEW) && !caseData.isDeleted ? (
            <QcReviewPanel caseData={caseData} onUpdated={setCaseData} />
          ) : null}

          {can(PERMISSIONS.CASE_CONSULT) && !caseData.isDeleted ? (
            <ClinicalRemarksPanel caseData={caseData} onUpdated={setCaseData} />
          ) : null}

          {user?.id === caseData.doctorId &&
          (caseData.delivery ||
            caseData.status === 'delivered' ||
            caseData.status === 'approved' ||
            caseData.status === 'completed') ? (
            <DoctorDeliveryPanel caseData={caseData} onUpdated={setCaseData} />
          ) : null}

          {caseData.delivery &&
          user?.id !== caseData.doctorId &&
          (caseData.status === 'approved' ||
            caseData.status === 'delivered' ||
            caseData.status === 'completed') ? (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
              <h2 className="text-sm font-semibold text-emerald-950">Delivery package</h2>
              <p className="mt-1 text-sm text-emerald-900/80">
                Delivered
                {caseData.delivery.uploadedByName
                  ? ` by ${caseData.delivery.uploadedByName}`
                  : ''}
                .
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {caseData.delivery.viewLink ? (
                  <a
                    href={caseData.delivery.viewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-brand-700 underline"
                  >
                    Open HTML / view link
                  </a>
                ) : null}
                {caseData.delivery.videoFilename ? (
                  <button
                    type="button"
                    className="font-semibold text-brand-700 underline"
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
            </section>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <section className="space-y-4 rounded-xl border border-line bg-white p-5">
              <h2 className="text-sm font-semibold text-ink">Case information</h2>
              <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                {[
                  ['Patient', caseData.patientName],
                  ['Age', caseData.patientAge?.toString() ?? '—'],
                  ['Gender', caseData.patientGender || '—'],
                  ['Clinic', caseData.clinicName || '—'],
                  ['Country', caseData.country || '—'],
                  ['Doctor', `${caseData.doctorName} (${caseData.doctorEmail})`],
                  ['Assigned designer', caseData.assignedDesignerName || 'Unassigned'],
                  ['Created', new Date(caseData.createdAt).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                      {label}
                    </dt>
                    <dd className="mt-1 text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Free-text instructions
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                  {caseData.instructions || 'No free-text instructions provided.'}
                </p>
              </div>
              {caseData.cancelReason ? (
                <Alert tone="info">Cancel reason: {caseData.cancelReason}</Alert>
              ) : null}
            </section>

            <div className="space-y-4">
              <CasePaymentPanel
                payment={caseData.payment}
                canManage={can(PERMISSIONS.CASE_MANAGE_PAYMENT) && !caseData.isDeleted}
                saving={paymentBusy}
                onSave={async (payload) => {
                  setPaymentBusy(true);
                  try {
                    const updated = await updateCasePayment(caseData.caseId, payload);
                    setCaseData(updated);
                    toast().success('Payment overview updated');
                  } catch (err) {
                    toast().error(getErrorMessage(err, 'Unable to update payment'));
                    throw err;
                  } finally {
                    setPaymentBusy(false);
                  }
                }}
              />
              <CaseFilesPanel
                caseId={caseData.caseId}
                files={caseData.files}
                canUpload={canUpload && !caseData.isDeleted}
                onUpdated={setCaseData}
              />
            </div>
          </div>

          <TreatmentInstructionsPanel
            value={{ ...EMPTY_TREATMENT_INSTRUCTIONS, ...caseData.treatmentInstructions }}
            canEdit={Boolean(canEditTreatment) && !caseData.isDeleted}
            saving={treatmentBusy}
            onSave={async (next) => {
              setTreatmentBusy(true);
              try {
                const updated = await updateTreatmentInstructions(caseData.caseId, next);
                setCaseData(updated);
                toast().success('Treatment instructions saved');
              } catch (err) {
                toast().error(getErrorMessage(err, 'Unable to save treatment instructions'));
                throw err;
              } finally {
                setTreatmentBusy(false);
              }
            }}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-xl border border-line bg-white p-5">
              <h2 className="text-sm font-semibold text-ink">Notes & instructions</h2>
              <p className="mt-1 text-sm text-muted">
                Free-text notes for special requirements or team communication.
              </p>
              {!caseData.isDeleted ? (
                <form onSubmit={handleAddNote} className="mt-3 space-y-3">
                  <TextField
                    label="Add note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Case note or special instruction…"
                  />
                  <div className="max-w-xs">
                    <AuthButton loading={savingNote} disabled={!note.trim()}>
                      Add note
                    </AuthButton>
                  </div>
                </form>
              ) : null}
              <ul className="mt-4 space-y-3">
                {caseData.notes.length === 0 ? (
                  <li className="text-sm text-muted">No notes yet.</li>
                ) : (
                  caseData.notes.map((item) => (
                    <li key={item.id} className="rounded-lg bg-surface px-3 py-3 text-sm">
                      <p className="font-medium text-ink">{item.authorName}</p>
                      <p className="mt-1 whitespace-pre-wrap text-ink">{item.body}</p>
                      <p className="mt-1 text-xs text-muted">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <CaseHistoryPanel history={caseData.history} showFullAudit={showFullAudit} />
          </div>
        </>
      )}
    </div>
  );
}
