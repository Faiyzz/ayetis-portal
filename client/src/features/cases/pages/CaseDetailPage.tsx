import {
  CASE_PRIORITIES,
  EMPTY_TREATMENT_INSTRUCTIONS,
  formatCaseIdLabel,
  isCaseDeliveryLocked,
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
import { CaseViewPanel } from '@/features/cases/components/CaseViewPanel';
import { CaseHistoryPanel } from '@/features/cases/components/CaseHistoryPanel';
import { CasePaymentPanel } from '@/features/cases/components/CasePaymentPanel';
import { ClarificationsPanel } from '@/features/cases/components/ClarificationsPanel';
import { ClinicalRemarksPanel } from '@/features/cases/components/ClinicalRemarksPanel';
import { CutReworkPanel } from '@/features/cases/components/CutReworkPanel';
import { CutWorkPanel } from '@/features/cases/components/CutWorkPanel';
import { DesignerProductionPanel } from '@/features/cases/components/DesignerProductionPanel';
import { DetailSection } from '@/features/cases/components/DetailSection';
import { DoctorDeliveryPanel } from '@/features/cases/components/DoctorDeliveryPanel';
import { QcReviewPanel } from '@/features/cases/components/QcReviewPanel';
import { TreatmentInstructionsPanel } from '@/features/cases/components/TreatmentInstructionsPanel';
import { ActivityNotes } from '@/features/cases/components/detail/ActivityNotes';
import {
  CaseDetailActionButton,
  CaseClinicalHeader,
  CaseMoreMenu,
} from '@/features/cases/components/detail/clinical/CaseClinicalHeader';
import { CaseDetailTabs } from '@/features/cases/components/detail/CaseDetailTabs';
import { CaseOverviewTab } from '@/features/cases/components/detail/CaseOverviewTab';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

const TAB_IDS = [
  'overview',
  'work',
  'clinical',
  'files',
  'view',
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
  workLabel: string;
}): CaseDetailNavSection[] {
  const clarifications = args.caseData.clarifications.length;
  const files = args.caseData.files.length;

  const sections: CaseDetailNavSection[] = [
    { id: 'overview', label: 'Overview' },
  ];

  if (args.showWorkTab) {
    sections.push({ id: 'work', label: args.workLabel });
  }

  sections.push(
    { id: 'clinical', label: 'Clinical' },
    {
      id: 'files',
      label: files > 0 ? `Files (${files})` : 'Files',
    },
    { id: 'view', label: 'View' },
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
  const canCut = can(PERMISSIONS.CASE_CUT);
  const canCutRework = can(PERMISSIONS.CASE_CUT_REWORK_REQUEST);
  const canQc = can(PERMISSIONS.CASE_QC_REVIEW);
  const canConsult = can(PERMISSIONS.CASE_CONSULT);
  const deliveryLocked = Boolean(caseData && isCaseDeliveryLocked(caseData.status));
  const editsLocked = Boolean(caseData && (caseData.isDeleted || deliveryLocked));

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
        caseData.status === 'waiting_for_approval' ||
        caseData.status === 'approved'),
  );

  const showDeliveryPackage = Boolean(
    caseData &&
      caseData.delivery &&
      user?.id !== caseData.doctorId &&
      (caseData.status === 'approved' ||
        caseData.status === 'waiting_for_approval'),
  );

  const showWorkTab = Boolean(
    caseData &&
      !caseData.isDeleted &&
      ((!deliveryLocked && (canDesign || canCut || canQc || canConsult || canCutRework)) ||
        showDoctorDelivery ||
        showDeliveryPackage),
  );

  const workLabel = useMemo(() => {
    if (deliveryLocked) return 'Delivery';
    const kinds = [
      canDesign ? 'design' : null,
      canCut ? 'cut' : null,
      canQc ? 'qc' : null,
      canConsult ? 'consult' : null,
      canCutRework ? 'cut_rework' : null,
      showDoctorDelivery || showDeliveryPackage ? 'delivery' : null,
    ].filter(Boolean);
    if (kinds.length === 1 && kinds[0] === 'qc') return 'QC review';
    if (kinds.length === 1 && kinds[0] === 'design') return 'Designer work';
    if (kinds.length === 1 && kinds[0] === 'cut') return 'Cut work';
    if (kinds.length === 1 && kinds[0] === 'consult') return 'Consultation';
    if (kinds.length === 1 && kinds[0] === 'delivery') return 'Delivery';
    return 'Work';
  }, [canDesign, canCut, canQc, canConsult, canCutRework, showDoctorDelivery, showDeliveryPackage, deliveryLocked]);

  const sections = useMemo(() => {
    if (!caseData) return [];
    return buildSections({ caseData, showWorkTab, workLabel });
  }, [caseData, showWorkTab, workLabel]);

  const [workFocus, setWorkFocus] = useState<string>('auto');

  const workOptions = useMemo(() => {
    const options: { id: string; label: string }[] = [];
    if (!deliveryLocked) {
      if (canDesign) options.push({ id: 'design', label: 'Designer workspace' });
      if (canCut) options.push({ id: 'cut', label: 'Cut workspace' });
      if (canQc) options.push({ id: 'qc', label: 'QC review' });
      if (canConsult) options.push({ id: 'consult', label: 'Consultation' });
      if (canCutRework) options.push({ id: 'cut_rework', label: 'Cut rework' });
    }
    if (showDoctorDelivery || showDeliveryPackage) {
      options.push({ id: 'delivery', label: 'Delivery' });
    }
    return options;
  }, [
    canDesign,
    canCut,
    canQc,
    canConsult,
    canCutRework,
    showDoctorDelivery,
    showDeliveryPackage,
    deliveryLocked,
  ]);

  const resolvedWorkFocus =
    workFocus !== 'auto' && workOptions.some((o) => o.id === workFocus)
      ? workFocus
      : workOptions[0]?.id ?? '';

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

  function openAssignment() {
    setActiveSection('overview');
    window.history.replaceState(null, '', '#overview');
    window.setTimeout(() => {
      document.getElementById('assignment-actions')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 60);
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
      view: 'view',
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
          subtitle="Loading clinical dashboard…"
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
        <h2 className="text-sm font-semibold text-ink">{workLabel}</h2>
        <p className="mt-0.5 text-sm text-muted">
          Tools for your role only — switch panels below if you have more than one capability.
        </p>
      </div>

      {workOptions.length > 1 ? (
        <div className="flex flex-wrap gap-2 border-b border-line pb-3">
          {workOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setWorkFocus(option.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                resolvedWorkFocus === option.id
                  ? 'bg-brand-600 text-white'
                  : 'border border-line text-ink hover:border-brand-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {resolvedWorkFocus === 'design' && canDesign && !caseData.isDeleted ? (
        <DesignerProductionPanel
          caseData={caseData}
          onUpdated={setCaseData}
          onOpenClarifications={openClarifications}
        />
      ) : null}

      {resolvedWorkFocus === 'cut' && canCut && !caseData.isDeleted ? (
        <CutWorkPanel
          caseData={caseData}
          onUpdated={setCaseData}
          onOpenFiles={() => setActiveSection('files')}
        />
      ) : null}

      {resolvedWorkFocus === 'cut_rework' && canCutRework && !caseData.isDeleted ? (
        <CutReworkPanel caseData={caseData} onUpdated={setCaseData} />
      ) : null}

      {resolvedWorkFocus === 'qc' && canQc && !caseData.isDeleted ? (
        <QcReviewPanel caseData={caseData} onUpdated={setCaseData} />
      ) : null}

      {resolvedWorkFocus === 'consult' && canConsult && !caseData.isDeleted ? (
        <ClinicalRemarksPanel caseData={caseData} onUpdated={setCaseData} />
      ) : null}

      {resolvedWorkFocus === 'delivery' && showDoctorDelivery ? (
        <DoctorDeliveryPanel caseData={caseData} onUpdated={setCaseData} />
      ) : null}

      {resolvedWorkFocus === 'delivery' && showDeliveryPackage && caseData.delivery ? (
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

      {!resolvedWorkFocus ? (
        <p className="text-sm text-muted">No work actions available for your role on this case.</p>
      ) : null}
    </div>
  );

  const canCancelCase =
    ((can(PERMISSIONS.CASE_UPDATE) || can(PERMISSIONS.CASE_DELETE)) ||
      (user?.id === caseData.doctorId &&
        caseData.status === 'new_case' &&
        (caseData.cancelWindowRemainingSeconds ?? 0) > 0)) &&
    !editsLocked &&
    !isCancelled;

  const showApprove =
    showDoctorDelivery && caseData.status === 'waiting_for_approval' && !editsLocked;
  const showAssign = canValidateOrAssign && !editsLocked;
  const showEdit = can(PERMISSIONS.CASE_UPDATE) && !editsLocked;

  return (
    <div className="font-clinical space-y-5">
      <a
        href="#case-tab-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-teal-800 focus:shadow"
      >
        Skip to case content
      </a>

      <PageHeader
        eyebrow={
          <Link to="/app/cases" className="hover:text-teal-800">
            ← Cases
          </Link>
        }
        title={caseData.patientName}
        subtitle={formatCaseIdLabel(caseData.caseId, caseData.status)}
      />

      <CaseClinicalHeader
        caseData={caseData}
        actions={
          <>
            {showApprove ? (
              <CaseDetailActionButton
                tone="primary"
                onClick={() => {
                  setWorkFocus('delivery');
                  selectTab('work');
                }}
              >
                Approve Plan
              </CaseDetailActionButton>
            ) : showAssign ? (
              <CaseDetailActionButton tone="primary" onClick={openAssignment}>
                Assign / validate
              </CaseDetailActionButton>
            ) : showEdit ? (
              <CaseDetailActionButton
                tone="primary"
                to={`/app/cases/${caseData.caseId}/edit`}
              >
                Edit
              </CaseDetailActionButton>
            ) : null}
            {showEdit && (showApprove || showAssign) ? (
              <CaseDetailActionButton to={`/app/cases/${caseData.caseId}/edit`}>
                Edit
              </CaseDetailActionButton>
            ) : null}
            <CaseMoreMenu
              items={[
                ...(!editsLocked && !isCancelled
                  ? [
                      {
                        id: 'refinement',
                        label: 'Request refinement',
                        onClick: () => selectTab('communication'),
                      },
                      {
                        id: 'checkin',
                        label: 'Schedule check-in',
                        onClick: () => selectTab('communication'),
                      },
                    ]
                  : []),
                ...(can(PERMISSIONS.CASE_SET_PRIORITY) && !editsLocked
                  ? [
                      {
                        id: 'urgent',
                        label: isUrgent ? 'Clear urgent' : 'Mark urgent',
                        onClick: () => void handlePriorityToggle(),
                        disabled: priorityBusy,
                      },
                    ]
                  : []),
                ...(canCancelCase
                  ? [
                      {
                        id: 'cancel',
                        label:
                          (caseData.cancelWindowRemainingSeconds ?? 0) > 0
                            ? `Cancel case (${Math.ceil((caseData.cancelWindowRemainingSeconds ?? 0) / 60)}m left)`
                            : 'Cancel case',
                        onClick: () => void handleCancel(),
                        tone: 'warning' as const,
                      },
                    ]
                  : []),
                ...(can(PERMISSIONS.CASE_DELETE) && !caseData.isDeleted
                  ? [
                      {
                        id: 'delete',
                        label: 'Soft delete',
                        onClick: () => void handleDelete(),
                        tone: 'danger' as const,
                      },
                    ]
                  : []),
              ]}
            />
          </>
        }
      />

      <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-surface/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <CaseDetailTabs tabs={sections} activeId={activeTab} onChange={selectTab} />
      </div>

      <div id="case-tab-content">
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
                    <CaseOverviewTab
                      caseData={caseData}
                      onOpenTab={(id) => {
                        if (id === 'assignment') {
                          openAssignment();
                          return;
                        }
                        if (id === 'work' && canQc) {
                          setWorkFocus('qc');
                          selectTab('work');
                          return;
                        }
                        if (id === 'work' && canDesign) {
                          setWorkFocus('design');
                          selectTab('work');
                          return;
                        }
                        selectTab(id);
                      }}
                      onUpdated={setCaseData}
                      canAssign={can(PERMISSIONS.CASE_ASSIGN) && !editsLocked}
                      canValidate={can(PERMISSIONS.CASE_VALIDATE) && !editsLocked}
                      canSetPriority={can(PERMISSIONS.CASE_SET_PRIORITY) && !editsLocked}
                      canAddNote={!editsLocked}
                      savingNote={savingNote}
                      onAddNote={async (body) => {
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
                  ) : null}

                  {tabId === 'work' ? workPanels : null}

                  {tabId === 'clinical' ? (
                    <div className="space-y-5">
                      <TreatmentInstructionsPanel
                        value={{
                          ...EMPTY_TREATMENT_INSTRUCTIONS,
                          ...caseData.treatmentInstructions,
                        }}
                        canEdit={Boolean(canEditTreatment) && !editsLocked}
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
                    </div>
                  ) : null}

                  {tabId === 'files' ? (
                    <CaseFilesPanel
                      caseId={caseData.caseId}
                      files={caseData.files}
                      canUpload={canUpload && !editsLocked}
                      onUpdated={setCaseData}
                    />
                  ) : null}

                  {tabId === 'view' ? (
                    <CaseViewPanel
                      caseData={caseData}
                      canEdit={(canQc || canConsult) && !caseData.isDeleted}
                      isDoctor={user?.id === caseData.doctorId}
                      onUpdated={setCaseData}
                    />
                  ) : null}

                  {tabId === 'communication' ? (
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
                      <ClarificationsPanel
                        caseId={caseData.caseId}
                        clarifications={caseData.clarifications}
                        onChanged={load}
                        readOnly={editsLocked}
                      />
                      <ActivityNotes
                        notes={caseData.notes}
                        canAdd={!editsLocked}
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
                        invoiceId={caseData.invoiceId}
                        canManage={
                          can(PERMISSIONS.CASE_MANAGE_PAYMENT) && !editsLocked
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
