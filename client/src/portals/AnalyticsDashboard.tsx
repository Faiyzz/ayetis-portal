import {
  ALL_CASE_PRIORITIES,
  ALL_CASE_STATUSES,
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  type AnalyticsDashboardDto,
} from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { AuthButton } from '@/features/auth/components/AuthUI';
import { toast } from '@/features/notifications/toastStore';
import api, { getErrorMessage } from '@/lib/api';

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsDashboard({ firstName }: { firstName: string }) {
  const [data, setData] = useState<AnalyticsDashboardDto | null>(null);
  const [month, setMonth] = useState<string | undefined>();
  const [view, setView] = useState<'month' | 'quarter'>('month');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    | 'pipeline'
    | 'designer'
    | 'qc'
    | 'consultant'
    | 'supervisor'
    | 'comparison'
    | 'clarifications'
    | 'doctors'
  >('pipeline');
  const [doctor, setDoctor] = useState('');
  const [customer, setCustomer] = useState('');
  const [designer, setDesigner] = useState('');
  const [consultant, setConsultant] = useState('');
  const [qc, setQc] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [sla, setSla] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  async function load(nextMonth = month, nextView = view) {
    setLoading(true);
    try {
      const { data: res } = await api.get('/reports/dashboard', {
        params: {
          month: nextMonth,
          view: nextView,
          doctor: doctor || undefined,
          customer: customer || undefined,
          designer: designer || undefined,
          consultant: consultant || undefined,
          qc: qc || undefined,
          supervisor: supervisor || undefined,
          priority: priority || undefined,
          status: status || undefined,
          sla: sla || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });
      setData(res.data);
      if (!nextMonth) setMonth(res.data.period.periodKey);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load reports'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportParams(format?: string) {
    return {
      month,
      view,
      format,
      doctor: doctor || undefined,
      customer: customer || undefined,
      designer: designer || undefined,
      consultant: consultant || undefined,
      qc: qc || undefined,
      supervisor: supervisor || undefined,
      priority: priority || undefined,
      status: status || undefined,
      sla: sla || undefined,
      from: from || undefined,
      to: to || undefined,
    };
  }

  async function exportCsv(report: string, format: 'csv' | 'xls' | 'html' = 'csv') {
    try {
      const response = await api.get(`/reports/export/${report}`, {
        params: exportParams(format === 'csv' ? undefined : format),
        responseType: 'blob',
      });
      const filename =
        response.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] ||
        `${report}.${format}`;
      const text = await (response.data as Blob).text();
      if (format === 'html') {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/html' }));
        window.open(url, '_blank');
        toast().success('Printable report opened');
        return;
      }
      downloadBlob(
        filename,
        text,
        format === 'xls' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8',
      );
      toast().success(format === 'xls' ? 'Excel exported' : 'CSV exported');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to export report'));
    }
  }

  return (
    <div className="space-y-6 print:space-y-3">
      <PageHeader
        eyebrow="Reporting & Analytics"
        title={`Welcome, ${firstName}`}
        subtitle="Pipeline health and department performance. Filter by month or quarter, then export CSV or print/PDF."
      />

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4 print:hidden">
        {data ? (
          <>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">Period</span>
              <select
                value={data.period.periodKey}
                onChange={(e) => {
                  setMonth(e.target.value);
                  void load(e.target.value, view);
                }}
                className="rounded-xl border border-line px-3 py-2"
              >
                {data.period.availableMonths.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              {(['month', 'quarter'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setView(option);
                    void load(month, option);
                  }}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                    view === option ? 'bg-brand-600 text-white' : 'border border-line text-ink'
                  }`}
                >
                  {option === 'month' ? 'Monthly' : 'Quarter'}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted self-center">{data.period.periodLabel}</p>
          </>
        ) : null}
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl border border-line px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-xl border border-line px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Doctor</span>
          <input
            value={doctor}
            onChange={(e) => setDoctor(e.target.value)}
            placeholder="Name or ID"
            className="rounded-xl border border-line px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Customer</span>
          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Name"
            className="rounded-xl border border-line px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Designer</span>
          <input
            value={designer}
            onChange={(e) => setDesigner(e.target.value)}
            placeholder="Name"
            className="rounded-xl border border-line px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Consultant</span>
          <input
            value={consultant}
            onChange={(e) => setConsultant(e.target.value)}
            placeholder="Name"
            className="rounded-xl border border-line px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">QC</span>
          <input
            value={qc}
            onChange={(e) => setQc(e.target.value)}
            placeholder="Name"
            className="rounded-xl border border-line px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Supervisor</span>
          <input
            value={supervisor}
            onChange={(e) => setSupervisor(e.target.value)}
            placeholder="Name"
            className="rounded-xl border border-line px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Priority</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded-xl border border-line px-3 py-2"
          >
            <option value="">All</option>
            {ALL_CASE_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {CASE_PRIORITY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-line px-3 py-2"
          >
            <option value="">All</option>
            {ALL_CASE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {CASE_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">SLA</span>
          <select
            value={sla}
            onChange={(e) => setSla(e.target.value)}
            className="rounded-xl border border-line px-3 py-2"
          >
            <option value="">All</option>
            <option value="breached">Breached</option>
            <option value="ok">Within SLA</option>
          </select>
        </label>
        <AuthButton type="button" variant="ghost" onClick={() => void load(month, view)}>
          Apply filters
        </AuthButton>
        <div className="ml-auto flex flex-wrap gap-2">
          <AuthButton type="button" variant="ghost" onClick={() => void exportCsv(tab === 'pipeline' ? 'pipeline' : tab)}>
            Export CSV
          </AuthButton>
          <AuthButton type="button" variant="ghost" onClick={() => void exportCsv(tab === 'pipeline' ? 'pipeline' : tab, 'xls')}>
            Excel
          </AuthButton>
          <AuthButton type="button" onClick={() => void exportCsv(tab === 'pipeline' ? 'pipeline' : tab, 'html')}>
            Print / PDF
          </AuthButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-line pb-px print:hidden">
        {(
          [
            ['pipeline', 'Case pipeline'],
            ['designer', 'Designers'],
            ['qc', 'QC'],
            ['consultant', 'Consultants'],
            ['supervisor', 'Supervisors'],
            ['comparison', 'Comparison'],
            ['clarifications', 'Clarifications'],
            ['doctors', 'Doctors'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
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

      {loading && !data ? <p className="text-sm text-muted">Loading reports…</p> : null}

      {data && tab === 'pipeline' ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Total (period)', data.pipeline.total],
              ['New', data.pipeline.newlySubmitted],
              ['Unassigned', data.pipeline.unassigned],
              ['Assigned', data.pipeline.assigned],
              ['In production', data.pipeline.inProduction],
              ['QC pending', data.pipeline.qcPending],
              ['QC rejected', data.pipeline.qcRejected],
              ['Completed', data.pipeline.completed],
              ['SLA breached', data.pipeline.slaBreached],
              ['On hold', data.pipeline.onHold],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">Status breakdown</h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              {data.pipeline.byStatus.map((row) => (
                <li key={row.status} className="flex justify-between py-2">
                  <span>{row.label}</span>
                  <span className="font-semibold">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {data && tab === 'designer' ? (
        <section className="rounded-xl border border-line bg-white p-5 overflow-x-auto">
          <h2 className="text-sm font-semibold text-ink">Designer department</h2>
          <p className="mt-1 text-sm text-muted">
            Assigned {data.designer.totals.assigned} · Completed {data.designer.totals.completed} ·
            Revisions {data.designer.totals.revisions} · Avg hours{' '}
            {data.designer.totals.averageCompletionHours ?? '—'}
          </p>
          <table className="mt-4 w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="pb-2">Designer</th>
                <th className="pb-2">Assigned</th>
                <th className="pb-2">Completed</th>
                <th className="pb-2">Revisions</th>
                <th className="pb-2">Avg hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.designer.members.map((m) => (
                <tr key={m.userId}>
                  <td className="py-2 font-medium">{m.name}</td>
                  <td className="py-2">{m.assigned}</td>
                  <td className="py-2">{m.completed}</td>
                  <td className="py-2">{m.revisions}</td>
                  <td className="py-2">{m.averageCompletionHours ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {data && tab === 'qc' ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Reviewed', data.qc.reviewed],
              ['Approved', data.qc.approved],
              ['Rejected', data.qc.rejected],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-white px-4 py-3">
                <p className="text-xs uppercase text-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-line bg-white p-5">
            <h2 className="text-sm font-semibold">Error trends</h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              {data.qc.errorTrends.length === 0 ? (
                <li className="py-2 text-muted">No rejection errors in this period.</li>
              ) : (
                data.qc.errorTrends.map((row) => (
                  <li key={row.code} className="flex justify-between py-2">
                    <span>{row.label}</span>
                    <span className="font-semibold">{row.count}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      ) : null}

      {data && tab === 'consultant' ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Reviewed', data.consultant.reviewed],
              ['Remarks', data.consultant.remarksCount],
              ['Rejected (escalated QC)', data.consultant.rejected],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-white px-4 py-3">
                <p className="text-xs uppercase text-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-line bg-white p-5">
            <h2 className="text-sm font-semibold">Remarks by color</h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              {data.consultant.remarksByColor.map((row) => (
                <li key={row.indicator} className="flex justify-between py-2">
                  <span>{row.label}</span>
                  <span className="font-semibold">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {data && tab === 'supervisor' ? (
        <section className="space-y-4">
          {data.supervisor.teams.map((team) => (
            <div key={team.supervisorId} className="rounded-xl border border-line bg-white p-5">
              <h2 className="text-sm font-semibold text-ink">{team.supervisorName}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-4 text-sm">
                <div>
                  <p className="text-xs text-muted">Designer completed</p>
                  <p className="font-semibold">{team.designerCompleted}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">QC reviewed</p>
                  <p className="font-semibold">{team.qcReviewed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">QC rejected</p>
                  <p className="font-semibold">{team.qcRejected}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Consultant reviewed</p>
                  <p className="font-semibold">{team.consultantReviewed}</p>
                </div>
              </div>
              <ul className="mt-4 divide-y divide-line text-sm">
                {team.members.slice(0, 40).map((member) => (
                  <li key={`${team.supervisorId}-${member.userId}`} className="flex justify-between py-2">
                    <span>
                      {member.name}{' '}
                      <span className="text-muted">({member.role})</span>
                    </span>
                    <span className="font-semibold">{member.casesHandled}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      {data && tab === 'comparison' ? (
        <section className="rounded-xl border border-line bg-white p-5 overflow-x-auto">
          <h2 className="text-sm font-semibold text-ink">Department comparison</h2>
          <table className="mt-4 w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="pb-2">Department</th>
                <th className="pb-2">Headcount</th>
                <th className="pb-2">Volume</th>
                <th className="pb-2">Completed / reviewed</th>
                <th className="pb-2">Reject / revision %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.comparison.rows.map((row) => (
                <tr key={row.department}>
                  <td className="py-2 font-medium">{row.label}</td>
                  <td className="py-2">{row.headcount}</td>
                  <td className="py-2">{row.volume}</td>
                  <td className="py-2">{row.completedOrReviewed}</td>
                  <td className="py-2">
                    {row.rejectionOrRevisionRate != null ? `${row.rejectionOrRevisionRate}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {data && tab === 'doctors' ? (
        <section className="rounded-xl border border-line bg-white p-5 overflow-x-auto">
          <h2 className="text-sm font-semibold text-ink">Doctor performance</h2>
          <p className="mt-1 text-sm text-muted">
            Approval rate = approved ÷ viewed · Modification rate = modifications ÷ viewed
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-4 text-sm">
            <div>
              <p className="text-xs text-muted">Viewed</p>
              <p className="font-semibold">{data.doctors.totals.viewed}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Approval %</p>
              <p className="font-semibold">{data.doctors.totals.approvalRate ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Modification %</p>
              <p className="font-semibold">{data.doctors.totals.modificationRate ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Avg review hours</p>
              <p className="font-semibold">{data.doctors.totals.averageReviewHours ?? '—'}</p>
            </div>
          </div>
          <table className="mt-4 w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="pb-2">Doctor</th>
                <th className="pb-2">Viewed</th>
                <th className="pb-2">Approved</th>
                <th className="pb-2">Mods</th>
                <th className="pb-2">Approval %</th>
                <th className="pb-2">Mod %</th>
                <th className="pb-2">Avg hours</th>
                <th className="pb-2">Satisfaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.doctors.members.map((m) => (
                <tr key={m.doctorId}>
                  <td className="py-2 font-medium">
                    {m.doctorName}
                    {m.doctorDisplayId ? (
                      <span className="ml-1 text-xs text-muted">{m.doctorDisplayId}</span>
                    ) : null}
                  </td>
                  <td className="py-2">{m.viewed}</td>
                  <td className="py-2">{m.approved}</td>
                  <td className="py-2">{m.modifications}</td>
                  <td className="py-2">{m.approvalRate ?? '—'}</td>
                  <td className="py-2">{m.modificationRate ?? '—'}</td>
                  <td className="py-2">{m.averageReviewHours ?? '—'}</td>
                  <td className="py-2">{m.satisfactionScore ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {data && tab === 'clarifications' ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Total', data.clarifications.total],
              ['Open', data.clarifications.openCount],
              ['Awaiting doctor', data.clarifications.awaitingDoctor],
              ['Escalated', data.clarifications.escalatedCount],
              ['Awaiting team', data.clarifications.awaitingTeam],
              ['Unread by doctor', data.clarifications.unreadByDoctor],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">By sender role</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {data.clarifications.bySenderRole.map((row) => (
                <li key={row.role} className="rounded-lg bg-surface/60 px-3 py-2 text-sm">
                  <p className="text-muted">{row.label}</p>
                  <p className="text-lg font-bold text-ink">{row.count}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-white p-5 overflow-x-auto">
            <h2 className="text-sm font-semibold text-ink">Clarification audit trail</h2>
            <p className="mt-1 text-sm text-muted">
              Read and escalation status for exportable audit (use Export CSV on this tab).
            </p>
            <table className="mt-4 w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="pb-2">Case</th>
                  <th className="pb-2">Subject</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Escalation</th>
                  <th className="pb-2">Doctor read</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.clarifications.items.slice(0, 100).map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 font-medium">{row.caseId}</td>
                    <td className="py-2">{row.subject}</td>
                    <td className="py-2">{row.senderRole}</td>
                    <td className="py-2">{row.status}</td>
                    <td className="py-2">{row.escalationStatus}</td>
                    <td className="py-2">{row.doctorRead ? 'Yes' : 'No'}</td>
                    <td className="py-2 text-xs text-muted">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
