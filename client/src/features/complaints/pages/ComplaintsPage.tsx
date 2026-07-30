import {
  ALL_COMPLAINT_STATUSES,
  ALL_COMPLAINT_TYPES,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_TYPE_LABELS,
  PERMISSIONS,
  type ComplaintDto,
  type ComplaintReportsDto,
  type ComplaintStatus,
} from '@ayetis/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { PageTabs, type PageTab } from '@/components/PageTabs';
import { usePermissions } from '@/features/auth/permissions';
import { AuthButton } from '@/features/auth/components/AuthUI';
import * as complaintsApi from '@/features/complaints/api';
import { LogComplaintForm } from '@/features/complaints/components/LogComplaintForm';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

function formatRate(value: number | null | undefined) {
  return value == null ? '—' : `${value}%`;
}

const COMPLAINT_TABS: PageTab[] = [
  { id: 'all-complaints', label: 'All complaints' },
  { id: 'monthly-trend', label: 'Monthly trend' },
];

function NewComplaintButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
    >
      <span aria-hidden>+</span>
      New complaint
    </button>
  );
}

function LogComplaintDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-80 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close new complaint dialog"
        onClick={onClose}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[1px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-white px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              Log a new complaint
            </h2>
            <p className="mt-1 text-sm text-muted">
              Link a Case ID when possible. The complaint code is assigned automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink"
          >
            <span className="text-xl leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>
        <div className="p-5">
          <LogComplaintForm inDialog onCreated={onCreated} />
        </div>
      </div>
    </div>
  );
}

export function ComplaintsWorkspace({
  showReports = true,
  title = 'Complaints & ratings',
  embedded = false,
}: {
  showReports?: boolean;
  title?: string;
  embedded?: boolean;
}) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.COMPLAINT_MANAGE);
  const canViewReports =
    showReports &&
    (can(PERMISSIONS.COMPLAINT_VIEW) ||
      can(PERMISSIONS.COMPLAINT_MANAGE) ||
      can(PERMISSIONS.CASE_VIEW_ALL) ||
      can(PERMISSIONS.REPORT_VIEW_ALL));
  const canCreate = can(PERMISSIONS.COMPLAINT_CREATE) || canManage;

  const [items, setItems] = useState<ComplaintDto[]>([]);
  const [reports, setReports] = useState<ComplaintReportsDto | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all-complaints');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const tabs = canViewReports ? COMPLAINT_TABS : COMPLAINT_TABS.slice(0, 1);

  async function load() {
    setLoading(true);
    try {
      const listPromise = complaintsApi.listComplaints();
      const reportsPromise = canViewReports
        ? complaintsApi.getComplaintReports(6)
        : Promise.resolve(null);
      const [list, report] = await Promise.all([listPromise, reportsPromise]);
      setItems(list);
      setReports(report);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load complaints'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewReports]);

  async function setStatus(id: string, status: ComplaintStatus) {
    try {
      await complaintsApi.updateComplaint(id, { status });
      toast().success('Status updated');
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update status'));
    }
  }

  async function addComment(id: string) {
    const comment = commentDrafts[id]?.trim();
    if (!comment) {
      toast().warning('Enter a resolution comment');
      return;
    }
    try {
      await complaintsApi.updateComplaint(id, { comment });
      toast().success('Comment added');
      setCommentDrafts((s) => ({ ...s, [id]: '' }));
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to add comment'));
    }
  }

  const overview = reports?.overview;

  return (
    <div className="space-y-4">
      {!embedded ? (
        <PageHeader
          title={title}
          subtitle={`Log issues against cases, track resolution, and review doctor decision rates${
            canViewReports ? ' and explicit ratings' : ''
          }.`}
        >
          {canCreate ? <NewComplaintButton onClick={() => setShowCreateDialog(true)} /> : null}
        </PageHeader>
      ) : null}

      {embedded && canCreate ? (
        <div className="flex justify-end">
          <NewComplaintButton onClick={() => setShowCreateDialog(true)} />
        </div>
      ) : null}

      <div className="rounded-t-xl border-x border-t border-line bg-white px-3">
        <PageTabs
          tabs={tabs}
          activeId={activeTab}
          onChange={setActiveTab}
          ariaLabel="Complaint sections"
        />
      </div>

      {loading && !items.length && !reports ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : null}

      {activeTab === 'monthly-trend' ? (
        <div
          id="monthly-trend"
          role="tabpanel"
          aria-labelledby="tab-monthly-trend"
          className="space-y-4"
        >
        {overview ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Avg rating (1–5)', overview.averageRating ?? '—'],
            ['Approval rate', formatRate(overview.approvalRate)],
            ['Modification rate', formatRate(overview.rejectionRate)],
            ['Open complaints', overview.complaintsOpen],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
              <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
            </div>
          ))}
          </div>
        ) : null}

        {reports ? (
        <>
          <section className="rounded-xl border border-line bg-white p-5 overflow-x-auto">
            <h2 className="text-sm font-semibold text-ink">Monthly trends</h2>
            <p className="mt-1 text-sm text-muted">
              Complaint volume, explicit ratings, and doctor approve / modification rates by month.
            </p>
            <table className="mt-4 w-full min-w-160 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Month</th>
                  <th className="pb-2 pr-3 font-medium">Complaints</th>
                  <th className="pb-2 pr-3 font-medium">Resolved</th>
                  <th className="pb-2 pr-3 font-medium">Avg rating</th>
                  <th className="pb-2 pr-3 font-medium">Approval</th>
                  <th className="pb-2 font-medium">Modification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reports.months.map((month) => (
                  <tr key={month.key}>
                    <td className="py-2 pr-3 font-medium text-ink">{month.label}</td>
                    <td className="py-2 pr-3 text-ink">
                      {month.complaintsTotal}
                      <span className="text-muted"> ({month.complaintsOpen} open)</span>
                    </td>
                    <td className="py-2 pr-3 text-ink">{month.complaintsResolved}</td>
                    <td className="py-2 pr-3 text-ink">{month.averageRating ?? '—'}</td>
                    <td className="py-2 pr-3 text-ink">{formatRate(month.approvalRate)}</td>
                    <td className="py-2 text-ink">{formatRate(month.rejectionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {ALL_COMPLAINT_TYPES.map((type) => {
                const total = reports.months.reduce((sum, month) => sum + month.byType[type], 0);
                return (
                  <div key={type} className="rounded-lg border border-line px-3 py-2">
                    <p className="text-xs text-muted">{COMPLAINT_TYPE_LABELS[type]}</p>
                    <p className="text-lg font-semibold text-ink">{total}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-line bg-white p-5 overflow-x-auto">
            <h2 className="text-sm font-semibold text-ink">Per-doctor metrics</h2>
            <p className="mt-1 text-sm text-muted">
              Approval / modification rates from doctor decisions. Avg rating is the mean of explicit
              1–5 ratings on complaints for that doctor (not a derived score).
            </p>
            <table className="mt-4 w-full min-w-180 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Doctor</th>
                  <th className="pb-2 pr-3 font-medium">Decisions</th>
                  <th className="pb-2 pr-3 font-medium">Approval</th>
                  <th className="pb-2 pr-3 font-medium">Modification</th>
                  <th className="pb-2 pr-3 font-medium">Avg rating</th>
                  <th className="pb-2 font-medium">Complaints</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reports.byDoctor.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-muted">
                      No doctor decisions or ratings yet.
                    </td>
                  </tr>
                ) : (
                  reports.byDoctor.map((row) => (
                    <tr key={row.doctorId}>
                      <td className="py-2 pr-3 font-medium text-ink">{row.doctorName}</td>
                      <td className="py-2 pr-3 text-ink">{row.decisionsTotal}</td>
                      <td className="py-2 pr-3 text-ink">{formatRate(row.approvalRate)}</td>
                      <td className="py-2 pr-3 text-ink">{formatRate(row.rejectionRate)}</td>
                      <td className="py-2 pr-3 text-ink">
                        {row.averageRating ?? '—'}
                        {row.ratingsCount ? (
                          <span className="text-muted"> ({row.ratingsCount})</span>
                        ) : null}
                      </td>
                      <td className="py-2 text-ink">
                        {row.complaintsCount}
                        {row.openComplaints ? (
                          <span className="text-muted"> · {row.openComplaints} open</span>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
        ) : null}
        </div>
      ) : null}

      {activeTab === 'all-complaints' ? (
      <section
        id="all-complaints"
        role="tabpanel"
        aria-labelledby="tab-all-complaints"
        className="rounded-xl border border-line bg-white p-5"
      >
        <h2 className="text-sm font-semibold text-ink">
          {canViewReports ? 'All complaints' : 'Your filed complaints'}
        </h2>
        <ul className="mt-3 divide-y divide-line">
          {items.length === 0 ? (
            <li className="py-3 text-sm text-muted">No complaints yet.</li>
          ) : (
            items.map((item) => (
              <li key={item.id} className="space-y-3 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{item.complaintCode}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">
                    {COMPLAINT_TYPE_LABELS[item.type]}
                  </span>
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-900">
                    {COMPLAINT_STATUS_LABELS[item.status]}
                  </span>
                  {item.caseId ? (
                    <Link to={`/app/cases/${item.caseId}`} className="text-xs text-brand-700">
                      {item.caseId}
                    </Link>
                  ) : null}
                  {item.rating ? <span className="text-xs text-muted">★ {item.rating}</span> : null}
                  {item.doctorName ? (
                    <span className="text-xs text-muted">Doctor: {item.doctorName}</span>
                  ) : null}
                </div>
                <p className="text-sm text-ink whitespace-pre-wrap">{item.details}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {item.responsibleEmployeeName ? (
                    <span>Employee: {item.responsibleEmployeeName}</span>
                  ) : null}
                  {item.responsibleQcName ? <span>QC: {item.responsibleQcName}</span> : null}
                  {item.responsibleConsultantName ? (
                    <span>Consultant: {item.responsibleConsultantName}</span>
                  ) : null}
                  {item.responsibleSupervisorName ? (
                    <span>Supervisor: {item.responsibleSupervisorName}</span>
                  ) : null}
                  <span>
                    Filed by {item.createdByName} · {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>

                {item.comments.length > 0 ? (
                  <ul className="space-y-2 rounded-lg bg-slate-50 px-3 py-2">
                    {item.comments.map((comment) => (
                      <li key={comment.id} className="text-sm">
                        <p className="text-ink whitespace-pre-wrap">{comment.text}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {comment.authorName} · {new Date(comment.createdAt).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {canManage ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {ALL_COMPLAINT_STATUSES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => void setStatus(item.id, status)}
                          className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                            item.status === status
                              ? 'border-brand-300 bg-brand-50 text-brand-800'
                              : 'border-line text-ink'
                          }`}
                        >
                          {COMPLAINT_STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="block min-w-0 flex-1 space-y-1.5 text-sm">
                        <span className="font-medium text-ink">Add resolution comment</span>
                        <textarea
                          rows={2}
                          value={commentDrafts[item.id] ?? ''}
                          onChange={(e) =>
                            setCommentDrafts((s) => ({ ...s, [item.id]: e.target.value }))
                          }
                          className="w-full rounded-xl border border-line px-3 py-2.5"
                        />
                      </label>
                      <div className="sm:w-40 sm:flex-none">
                        <AuthButton type="button" onClick={() => void addComment(item.id)}>
                          Add comment
                        </AuthButton>
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
      ) : null}

      {showCreateDialog ? (
        <LogComplaintDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => {
            setShowCreateDialog(false);
            setActiveTab('all-complaints');
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

export function ComplaintsPage() {
  return <ComplaintsWorkspace />;
}
