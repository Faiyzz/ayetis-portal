import {
  CASE_PRIORITIES,
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  EMPTY_TREATMENT_INSTRUCTIONS,
  PAYMENT_STATUS_LABELS,
  PERMISSIONS,
  type CaseDetailDto,
} from '@ayetis/shared';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
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
import {
  useCaseDetailNav,
  type CaseDetailNavSection,
} from '@/features/cases/caseDetailNav';
import { CaseFilesPanel } from '@/features/cases/components/CaseFilesPanel';
import { CaseHistoryPanel } from '@/features/cases/components/CaseHistoryPanel';
import { CasePaymentPanel } from '@/features/cases/components/CasePaymentPanel';
import { CaseStatusTimeline } from '@/features/cases/components/CaseStatusTimeline';
import { CaseValidationAssignPanel } from '@/features/cases/components/CaseValidationAssignPanel';
import { ClarificationsPanel } from '@/features/cases/components/ClarificationsPanel';
import { ClinicalRemarksPanel } from '@/features/cases/components/ClinicalRemarksPanel';
import { DesignerProductionPanel } from '@/features/cases/components/DesignerProductionPanel';
import { DetailSection } from '@/features/cases/components/DetailSection';
import { DoctorDeliveryPanel } from '@/features/cases/components/DoctorDeliveryPanel';
import { QcReviewPanel } from '@/features/cases/components/QcReviewPanel';
import { TreatmentInstructionsPanel } from '@/features/cases/components/TreatmentInstructionsPanel';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

function SectionAnchor({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24">
      {children}
    </div>
  );
}

function buildSections(args: {
  caseData: CaseDetailDto;
  canValidateOrAssign: boolean;
  canDesign: boolean;
  canQc: boolean;
  canConsult: boolean;
  showDoctorDelivery: boolean;
  showDeliveryPackage: boolean;
}): CaseDetailNavSection[] {
  const sections: CaseDetailNavSection[] = [
    { id: 'case-overview', label: 'Overview' },
    { id: 'status-timeline', label: 'Status timeline' },
    {
      id: 'clarifications',
      label:
        args.caseData.clarifications.length > 0
          ? `Clarifications (${args.caseData.clarifications.length})`
          : 'Clarifications',
    },
  ];

  if (args.canValidateOrAssign && !args.caseData.isDeleted) {
    sections.push({ id: 'validation-assignment', label: 'Validation & assignment' });
  }
  if (args.canDesign && !args.caseData.isDeleted) {
    sections.push({ id: 'designer-workspace', label: 'Designer workspace' });
  }
  if (args.canQc && !args.caseData.isDeleted) {
    sections.push({ id: 'qc-review', label: 'QC review' });
  }
  if (args.canConsult && !args.caseData.isDeleted) {
    sections.push({ id: 'clinical-remarks', label: 'Clinical remarks' });
  }
  if (args.showDoctorDelivery) {
    sections.push({ id: 'delivery-review', label: 'Delivery review' });
  }
  if (args.showDeliveryPackage) {
    sections.push({ id: 'delivery-package', label: 'Delivery package' });
  }

  sections.push(
    { id: 'payment', label: 'Payment' },
    { id: 'patient-files', label: 'Patient files' },
    { id: 'treatment-instructions', label: 'Treatment instructions' },
    { id: 'production-notes', label: 'Notes' },
    { id: 'history', label: 'History' },
  );

  return sections;
}

export function CaseDetailPage() {
  const { caseId = '' } = useParams();
  const { can, canAny, user } = usePermissions();
  const setNav = useCaseDetailNav((s) => s.setNav);
  const setActiveSection = useCaseDetailNav((s) => s.setActiveSection);
  const clearNav = useCaseDetailNav((s) => s.clear);
  const [caseData, setCaseData] = useState<CaseDetailDto | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [priorityBusy, setPriorityBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [treatmentBusy, setTreatmentBusy] = useState(false);

  const canUpload = canAny(PERMISSIONS.CASE_CREATE, PERMISSIONS.CASE_UPDATE);
  const showFullAudit = canAny(PERMISSIONS.AUDIT_VIEW, PERMISSIONS.CASE_VIEW_ALL);
  const canEditTreatment =
    can(PERMISSIONS.CASE_UPDATE) ||
    (can(PERMISSIONS.CASE_CREATE) && caseData && user?.id === caseData.doctorId);

  const canValidateOrAssign =
    can(PERMISSIONS.CASE_VALIDATE) || can(PERMISSIONS.CASE_ASSIGN);
  const canDesign = can(PERMISSIONS.CASE_DESIGN);
  const canQc = can(PERMISSIONS.CASE_QC_REVIEW);
  const canConsult = can(PERMISSIONS.CASE_CONSULT);

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

  const showDoctorDelivery = Boolean(
    caseData &&
      user?.id === caseData.doctorId &&
      (caseData.delivery ||
        caseData.status === 'delivered' ||
        caseData.status === 'approved' ||
        caseData.status === 'completed'),
  );

  const showDeliveryPackage = Boolean(
    caseData &&
      caseData.delivery &&
      user?.id !== caseData.doctorId &&
      (caseData.status === 'approved' ||
        caseData.status === 'delivered' ||
        caseData.status === 'completed'),
  );

  const sections = useMemo(() => {
    if (!caseData) return [];
    return buildSections({
      caseData,
      canValidateOrAssign,
      canDesign,
      canQc,
      canConsult,
      showDoctorDelivery,
      showDeliveryPackage,
    });
  }, [
    caseData,
    canValidateOrAssign,
    canDesign,
    canQc,
    canConsult,
    showDoctorDelivery,
    showDeliveryPackage,
  ]);

  useEffect(() => {
    if (!caseData) {
      clearNav();
      return;
    }
    setNav(caseData.caseId, sections);
    return () => clearNav();
  }, [caseData, sections, setNav, clearNav]);

  useEffect(() => {
    if (!caseData || sections.length === 0) return;

    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      const timer = window.setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveSection(hash);
      }, 80);
      return () => window.clearTimeout(timer);
    }

    setActiveSection(sections[0]?.id ?? null);
    return undefined;
  }, [caseData?.caseId, sections, setActiveSection]);

  useEffect(() => {
    if (!caseData || sections.length === 0) return;

    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target.id;
        if (top) setActiveSection(top);
      },
      { rootMargin: '-18% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [caseData, sections, setActiveSection]);

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
    const reason = window.prompt('Reason for deleting this case (sent to admin for approval):');
    if (!reason || reason.trim().length < 3) {
      toast().warning('Deletion requires a reason');
      return;
    }
    if (!window.confirm(`Request deletion of case ${caseData.caseId}?`)) return;
    if (!window.confirm('Second confirmation: submit this delete request to admin?')) return;

    try {
      await softDeleteCase(caseData.caseId, { reason: reason.trim() });
      toast().success('Delete request submitted for admin approval');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to submit delete request'));
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader
          eyebrow={
            <Link to="/app/cases" className="hover:text-brand-700">
              ← Cases
            </Link>
          }
          title={caseId || 'Case'}
          subtitle="Loading case…"
        />
        <p className="text-sm text-muted">Loading case…</p>
      </>
    );
  }

  if (!caseData) {
    return (
      <div className="space-y-3">
        <PageHeader
          eyebrow={
            <Link to="/app/cases" className="hover:text-brand-700">
              ← Cases
            </Link>
          }
          title={caseId || 'Case'}
          subtitle="Unable to load this case"
        />
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
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        eyebrow={
          <Link to="/app/cases" className="hover:text-brand-700">
            ← Cases
          </Link>
        }
        title={caseData.caseId}
        subtitle={caseData.treatmentSummary}
      />

      {waitingClarification ? (
        <Alert tone="info">
          This case is waiting for clarification. Jump to Clarifications in the sidebar to review or
          reply.
        </Alert>
      ) : null}

      <section
        id="case-overview"
        className="scroll-mt-24 overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div className="flex flex-col gap-4 border-b border-line px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-brand-50 px-2.5 py-1 font-semibold text-brand-700">
                {CASE_STATUS_LABELS[caseData.status]}
              </span>
              <span
                className={`rounded-md px-2.5 py-1 font-semibold ${
                  isUrgent ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {CASE_PRIORITY_LABELS[caseData.priority]}
              </span>
              <span className="rounded-md bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                {PAYMENT_STATUS_LABELS[caseData.paymentStatus]}
              </span>
              {caseData.openClarificationCount > 0 ? (
                <span className="rounded-md bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
                  {caseData.openClarificationCount} open clarification
                  {caseData.openClarificationCount === 1 ? '' : 's'}
                </span>
              ) : null}
              {caseData.isDeleted ? (
                <span className="rounded-md bg-red-50 px-2.5 py-1 font-semibold text-red-700">
                  Soft-deleted
                </span>
              ) : null}
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                {caseData.patientName}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {caseData.clinicName || 'No clinic'} · {caseData.country || 'No country'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {can(PERMISSIONS.CASE_SET_PRIORITY) && !caseData.isDeleted ? (
              <button
                type="button"
                disabled={priorityBusy}
                onClick={() => void handlePriorityToggle()}
                className={`rounded-lg border px-3.5 py-2 text-sm font-semibold disabled:opacity-60 ${
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
                className="rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink hover:border-brand-300"
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
                className="rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
              >
                Cancel case
              </button>
            ) : null}
            {can(PERMISSIONS.CASE_DELETE) && !caseData.isDeleted ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Soft delete
              </button>
            ) : null}
          </div>
        </div>

        <dl className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Doctor', caseData.doctorName],
            ['Assigned designer', caseData.assignedDesignerName || 'Unassigned'],
            ['Age / gender', `${caseData.patientAge ?? '—'} · ${caseData.patientGender || '—'}`],
            ['Created', new Date(caseData.createdAt).toLocaleString()],
          ].map(([label, value]) => (
            <div key={label} className="bg-white px-5 py-3.5">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                {label}
              </dt>
              <dd className="mt-1 truncate text-sm font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="border-t border-line px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            Free-text instructions
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {caseData.instructions || 'No free-text instructions provided.'}
          </p>
          {caseData.cancelReason ? (
            <div className="mt-3">
              <Alert tone="info">Cancel reason: {caseData.cancelReason}</Alert>
            </div>
          ) : null}
        </div>
      </section>

      <SectionAnchor id="status-timeline">
        <CaseStatusTimeline
          steps={caseData.timeline}
          currentLabel={CASE_STATUS_LABELS[caseData.status]}
          isCancelled={isCancelled}
        />
      </SectionAnchor>

      <SectionAnchor id="clarifications">
        <ClarificationsPanel
          caseId={caseData.caseId}
          clarifications={caseData.clarifications}
          onChanged={load}
        />
      </SectionAnchor>

      {canValidateOrAssign && !caseData.isDeleted ? (
        <SectionAnchor id="validation-assignment">
          <CaseValidationAssignPanel
            caseData={caseData}
            canValidate={can(PERMISSIONS.CASE_VALIDATE)}
            canAssign={can(PERMISSIONS.CASE_ASSIGN)}
            canSetPriority={can(PERMISSIONS.CASE_SET_PRIORITY)}
            onUpdated={setCaseData}
            onOpenClarifications={() => {
              document.getElementById('clarifications')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
              window.history.replaceState(null, '', '#clarifications');
              setActiveSection('clarifications');
            }}
          />
        </SectionAnchor>
      ) : null}

      {canDesign && !caseData.isDeleted ? (
        <SectionAnchor id="designer-workspace">
          <DesignerProductionPanel
            caseData={caseData}
            onUpdated={setCaseData}
            onOpenClarifications={() => {
              document.getElementById('clarifications')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
              window.history.replaceState(null, '', '#clarifications');
              setActiveSection('clarifications');
            }}
          />
        </SectionAnchor>
      ) : null}

      {canQc && !caseData.isDeleted ? (
        <SectionAnchor id="qc-review">
          <QcReviewPanel caseData={caseData} onUpdated={setCaseData} />
        </SectionAnchor>
      ) : null}

      {canConsult && !caseData.isDeleted ? (
        <SectionAnchor id="clinical-remarks">
          <ClinicalRemarksPanel caseData={caseData} onUpdated={setCaseData} />
        </SectionAnchor>
      ) : null}

      {showDoctorDelivery ? (
        <SectionAnchor id="delivery-review">
          <DoctorDeliveryPanel caseData={caseData} onUpdated={setCaseData} />
        </SectionAnchor>
      ) : null}

      {showDeliveryPackage && caseData.delivery ? (
        <DetailSection
          id="delivery-package"
          title="Delivery package"
          description={
            caseData.delivery.uploadedByName
              ? `Delivered by ${caseData.delivery.uploadedByName}`
              : 'Delivered package links and files'
          }
          tone="success"
        >
          <div className="flex flex-wrap gap-3 text-sm">
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
        </DetailSection>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionAnchor id="payment">
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
        </SectionAnchor>

        <SectionAnchor id="patient-files">
          <CaseFilesPanel
            caseId={caseData.caseId}
            files={caseData.files}
            canUpload={canUpload && !caseData.isDeleted}
            onUpdated={setCaseData}
          />
        </SectionAnchor>
      </div>

      <SectionAnchor id="treatment-instructions">
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
      </SectionAnchor>

      <div className="grid gap-4 xl:grid-cols-2">
        <DetailSection
          id="production-notes"
          title="Notes"
          description="Free-text notes for special requirements or team communication."
        >
          {!caseData.isDeleted ? (
            <form onSubmit={handleAddNote} className="space-y-3">
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
          <ul className={['space-y-3', caseData.isDeleted ? '' : 'mt-4'].filter(Boolean).join(' ')}>
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
        </DetailSection>

        <SectionAnchor id="history">
          <CaseHistoryPanel history={caseData.history} showFullAudit={showFullAudit} />
        </SectionAnchor>
      </div>
    </div>
  );
}
