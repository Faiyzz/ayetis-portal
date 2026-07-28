import {
  CASE_PRIORITIES,
  EMPTY_TREATMENT_INSTRUCTIONS,
  PERMISSIONS,
  type CaseDetailDto,
} from '@ayetis/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { dialog } from '@/components/dialog';
import { Alert } from '@/features/auth/components/AuthUI';
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
import { CaseValidationAssignPanel } from '@/features/cases/components/CaseValidationAssignPanel';
import { ClarificationsPanel } from '@/features/cases/components/ClarificationsPanel';
import { ClinicalRemarksPanel } from '@/features/cases/components/ClinicalRemarksPanel';
import { DesignerProductionPanel } from '@/features/cases/components/DesignerProductionPanel';
import { DetailSection } from '@/features/cases/components/DetailSection';
import { DoctorDeliveryPanel } from '@/features/cases/components/DoctorDeliveryPanel';
import { QcReviewPanel } from '@/features/cases/components/QcReviewPanel';
import { TreatmentInstructionsPanel } from '@/features/cases/components/TreatmentInstructionsPanel';
import { ActivityNotes } from '@/features/cases/components/detail/ActivityNotes';
import {
  CaseDetailActionButton,
  CaseDetailHero,
} from '@/features/cases/components/detail/CaseDetailHero';
import { CaseDetailTabs } from '@/features/cases/components/detail/CaseDetailTabs';
import { CaseOverviewTab } from '@/features/cases/components/detail/CaseOverviewTab';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

const TAB_IDS = [
  'overview',
  'work',
  'clinical',
  'files',
  'communication',
  'finance',
  'history',
] as const;

type TabId = (typeof TAB_IDS)[number];

function isTabId(value: string): value is TabId {
  return (TAB_IDS as readonly string[]).includes(value);
}

function buildSections(args: {
  caseData: CaseDetailDto;
  showWorkTab: boolean;
}): CaseDetailNavSection[] {
  const clarifications = args.caseData.clarifications.length;
  const files = args.caseData.files.length;

  const sections: CaseDetailNavSection[] = [
    { id: 'overview', label: 'Overview' },
  ];

  if (args.showWorkTab) {
    sections.push({ id: 'work', label: 'Work' });
  }

  sections.push(
    { id: 'clinical', label: 'Clinical' },
    {
      id: 'files',
      label: files > 0 ? `Files (${files})` : 'Files',
    },
    {
      id: 'communication',
      label:
        clarifications > 0 ? `Communication (${clarifications})` : 'Communication',
    },
    { id: 'finance', label: 'Finance' },
    { id: 'history', label: 'History' },
  );

  return sections;
}

export function CaseDetailPage() {
  const { caseId = '' } = useParams();
  const { can, canAny, user } = usePermissions();
  const setActiveSection = useCaseDetailNav((s) => s.setActiveSection);
  const activeSectionId = useCaseDetailNav((s) => s.activeSectionId);
  const [caseData, setCaseData] = useState<CaseDetailDto | null>(null);
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

  const showWorkTab = Boolean(
    caseData &&
      !caseData.isDeleted &&
      (canValidateOrAssign ||
        canDesign ||
        canQc ||
        showDoctorDelivery ||
        showDeliveryPackage),
  );

  const sections = useMemo(() => {
    if (!caseData) return [];
    return buildSections({ caseData, showWorkTab });
  }, [caseData, showWorkTab]);

  const activeTab: TabId = useMemo(() => {
    if (activeSectionId && isTabId(activeSectionId)) {
      if (activeSectionId === 'work' && !showWorkTab) return 'overview';
      return activeSectionId;
    }
    return 'overview';
  }, [activeSectionId, showWorkTab]);

  function selectTab(id: string) {
    if (!isTabId(id)) return;
    if (id === 'work' && !showWorkTab) return;
    setActiveSection(id);
    window.history.replaceState(null, '', `#${id}`);
  }

  useEffect(() => {
    if (!caseData || sections.length === 0) return;

    const hash = window.location.hash.replace(/^#/, '');
    if (hash && sections.some((s) => s.id === hash)) {
      setActiveSection(hash);
      return;
    }

    // Legacy hashes → map to new tabs
    const legacyMap: Record<string, TabId> = {
      'case-overview': 'overview',
      'status-timeline': 'overview',
      clarifications: 'communication',
      'validation-assignment': 'work',
      'designer-workspace': 'work',
      'qc-review': 'work',
      'clinical-remarks': 'clinical',
      'delivery-review': 'work',
      'delivery-package': 'work',
      payment: 'finance',
      'patient-files': 'files',
      'treatment-instructions': 'clinical',
      'production-notes': 'communication',
      history: 'history',
    };
    if (hash && legacyMap[hash]) {
      const mapped = legacyMap[hash]!;
      if (mapped === 'work' && !showWorkTab) {
        setActiveSection('overview');
        window.history.replaceState(null, '', '#overview');
      } else {
        setActiveSection(mapped);
        window.history.replaceState(null, '', `#${mapped}`);
      }
      return;
    }

    setActiveSection(sections[0]?.id ?? 'overview');
  }, [caseData?.caseId, sections, setActiveSection, showWorkTab]);

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
    const reason = await dialog.prompt({
      title: 'Cancel case',
      message: `Provide a reason for cancelling ${caseData.caseId}.`,
      label: 'Cancellation reason',
      placeholder: 'Why is this case being cancelled?',
      confirmLabel: 'Continue',
      tone: 'warning',
      minLength: 3,
    });
    if (!reason) return;

    const confirmed = await dialog.confirm({
      title: 'Confirm cancellation',
      message: `Cancel case ${caseData.caseId}? This stops further processing.`,
      confirmLabel: 'Cancel case',
      tone: 'warning',
    });
    if (!confirmed) return;

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
    const reason = await dialog.prompt({
      title: 'Request case deletion',
      message: 'This reason is sent to an admin for approval.',
      label: 'Reason',
      placeholder: 'Why should this case be deleted?',
      confirmLabel: 'Continue',
      tone: 'danger',
      minLength: 3,
    });
    if (!reason) return;

    const confirmed = await dialog.confirm({
      title: 'Confirm delete request',
      message: `Request deletion of case ${caseData.caseId}?`,
      confirmLabel: 'Request deletion',
      tone: 'danger',
    });
    if (!confirmed) return;

    const doubleConfirmed = await dialog.confirm({
      title: 'Final confirmation',
      message: 'Submit this delete request to admin for approval?',
      confirmLabel: 'Submit request',
      tone: 'danger',
    });
    if (!doubleConfirmed) return;

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

  const openClarifications = () => selectTab('communication');

  const workPanels = (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">Production work</h2>
        <p className="mt-0.5 text-sm text-muted">
          Validation, design, QC, and delivery tools available for your role.
        </p>
      </div>

      {canValidateOrAssign && !caseData.isDeleted ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
            Validation & assignment
          </h3>
          <CaseValidationAssignPanel
            caseData={caseData}
            canValidate={can(PERMISSIONS.CASE_VALIDATE)}
            canAssign={can(PERMISSIONS.CASE_ASSIGN)}
            canSetPriority={can(PERMISSIONS.CASE_SET_PRIORITY)}
            onUpdated={setCaseData}
            onOpenClarifications={openClarifications}
          />
        </div>
      ) : null}

      {canDesign && !caseData.isDeleted ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
            Designer workspace
          </h3>
          <DesignerProductionPanel
            caseData={caseData}
            onUpdated={setCaseData}
            onOpenClarifications={openClarifications}
          />
        </div>
      ) : null}

      {canQc && !caseData.isDeleted ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
            QC review
          </h3>
          <QcReviewPanel caseData={caseData} onUpdated={setCaseData} />
        </div>
      ) : null}

      {showDoctorDelivery ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
            Delivery review
          </h3>
          <DoctorDeliveryPanel caseData={caseData} onUpdated={setCaseData} />
        </div>
      ) : null}

      {showDeliveryPackage && caseData.delivery ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
            Delivery package
          </h3>
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
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="w-full">
      <a
        href="#case-tab-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-700 focus:shadow"
      >
        Skip to case content
      </a>

      <PageHeader
        eyebrow={
          <Link to="/app/cases" className="hover:text-brand-700">
            ← Cases
          </Link>
        }
        title={caseData.caseId}
        subtitle={caseData.treatmentSummary}
      />

      <div className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="px-5 sm:px-6 lg:px-8">
          <CaseDetailHero
            caseData={caseData}
            onJumpToTab={selectTab}
            actions={
              <>
                {can(PERMISSIONS.CASE_SET_PRIORITY) && !caseData.isDeleted ? (
                  <CaseDetailActionButton
                    tone={isUrgent ? 'urgent' : 'default'}
                    disabled={priorityBusy}
                    onClick={() => void handlePriorityToggle()}
                  >
                    {priorityBusy ? 'Updating…' : isUrgent ? 'Clear urgent' : 'Mark urgent'}
                  </CaseDetailActionButton>
                ) : null}
                {can(PERMISSIONS.CASE_UPDATE) && !caseData.isDeleted ? (
                  <CaseDetailActionButton to={`/app/cases/${caseData.caseId}/edit`}>
                    Edit
                  </CaseDetailActionButton>
                ) : null}
                {showWorkTab && canValidateOrAssign && !caseData.isDeleted ? (
                  <CaseDetailActionButton onClick={() => selectTab('work')}>
                    Assign / validate
                  </CaseDetailActionButton>
                ) : null}
                {(can(PERMISSIONS.CASE_UPDATE) || can(PERMISSIONS.CASE_DELETE)) &&
                !caseData.isDeleted &&
                !isCancelled ? (
                  <CaseDetailActionButton tone="warning" onClick={() => void handleCancel()}>
                    Cancel case
                  </CaseDetailActionButton>
                ) : null}
                {can(PERMISSIONS.CASE_DELETE) && !caseData.isDeleted ? (
                  <CaseDetailActionButton tone="danger" onClick={() => void handleDelete()}>
                    Soft delete
                  </CaseDetailActionButton>
                ) : null}
              </>
            }
          />
          <CaseDetailTabs tabs={sections} activeId={activeTab} onChange={selectTab} />
        </div>
      </div>

      <div id="case-tab-content" className="px-5 pt-5 sm:px-6 lg:px-8">
        {TAB_IDS.map((tabId) => {
          if (tabId === 'work' && !showWorkTab) return null;
          const selected = activeTab === tabId;
          return (
            <div
              key={tabId}
              id={tabId}
              role="tabpanel"
              aria-labelledby={`tab-${tabId}`}
              hidden={!selected}
              className="scroll-mt-40"
            >
              {selected ? (
                <>
                  {tabId === 'overview' ? (
                    <CaseOverviewTab caseData={caseData} onOpenTab={selectTab} />
                  ) : null}

                  {tabId === 'work' ? workPanels : null}

                  {tabId === 'clinical' ? (
                    <div className="space-y-5">
                      <TreatmentInstructionsPanel
                        value={{
                          ...EMPTY_TREATMENT_INSTRUCTIONS,
                          ...caseData.treatmentInstructions,
                        }}
                        canEdit={Boolean(canEditTreatment) && !caseData.isDeleted}
                        saving={treatmentBusy}
                        onSave={async (next) => {
                          setTreatmentBusy(true);
                          try {
                            const updated = await updateTreatmentInstructions(
                              caseData.caseId,
                              next,
                            );
                            setCaseData(updated);
                            toast().success('Treatment instructions saved');
                          } catch (err) {
                            toast().error(
                              getErrorMessage(err, 'Unable to save treatment instructions'),
                            );
                            throw err;
                          } finally {
                            setTreatmentBusy(false);
                          }
                        }}
                      />
                      {canConsult && !caseData.isDeleted ? (
                        <ClinicalRemarksPanel
                          caseData={caseData}
                          onUpdated={setCaseData}
                        />
                      ) : null}
                    </div>
                  ) : null}

                  {tabId === 'files' ? (
                    <CaseFilesPanel
                      caseId={caseData.caseId}
                      files={caseData.files}
                      canUpload={canUpload && !caseData.isDeleted}
                      onUpdated={setCaseData}
                    />
                  ) : null}

                  {tabId === 'communication' ? (
                    <div className="grid gap-5 xl:grid-cols-2">
                      <ClarificationsPanel
                        caseId={caseData.caseId}
                        clarifications={caseData.clarifications}
                        onChanged={load}
                      />
                      <ActivityNotes
                        notes={caseData.notes}
                        canAdd={!caseData.isDeleted}
                        saving={savingNote}
                        onAdd={async (body) => {
                          setSavingNote(true);
                          try {
                            const updated = await addCaseNote(caseData.caseId, { body });
                            setCaseData(updated);
                            toast().success('Note added');
                          } catch (err) {
                            toast().error(getErrorMessage(err, 'Unable to add note'));
                            throw err;
                          } finally {
                            setSavingNote(false);
                          }
                        }}
                      />
                    </div>
                  ) : null}

                  {tabId === 'finance' ? (
                    <div className="max-w-3xl">
                      <CasePaymentPanel
                        payment={caseData.payment}
                        canManage={
                          can(PERMISSIONS.CASE_MANAGE_PAYMENT) && !caseData.isDeleted
                        }
                        saving={paymentBusy}
                        onSave={async (payload) => {
                          setPaymentBusy(true);
                          try {
                            const updated = await updateCasePayment(
                              caseData.caseId,
                              payload,
                            );
                            setCaseData(updated);
                            toast().success('Payment overview updated');
                          } catch (err) {
                            toast().error(
                              getErrorMessage(err, 'Unable to update payment'),
                            );
                            throw err;
                          } finally {
                            setPaymentBusy(false);
                          }
                        }}
                      />
                    </div>
                  ) : null}

                  {tabId === 'history' ? (
                    <CaseHistoryPanel
                      history={caseData.history}
                      showFullAudit={showFullAudit}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
