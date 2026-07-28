import type { AnalyticsDashboardDto } from '@ayetis/shared';
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
    'pipeline' | 'designer' | 'qc' | 'consultant' | 'supervisor' | 'comparison'
  >('pipeline');

  async function load(nextMonth = month, nextView = view) {
    setLoading(true);
    try {
      const { data: res } = await api.get('/reports/dashboard', {
        params: { month: nextMonth, view: nextView },
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

  async function exportCsv(report: string) {
    try {
      const response = await api.get(`/reports/export/${report}`, {
        params: { month, view },
        responseType: 'blob',
      });
      const filename =
        response.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] ||
        `${report}.csv`;
      const text = await (response.data as Blob).text();
      downloadBlob(filename, text, 'text/csv;charset=utf-8');
      toast().success('CSV exported');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to export CSV'));
    }
  }

  function exportPdf() {
    window.print();
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
        <div className="ml-auto flex flex-wrap gap-2">
          <AuthButton type="button" variant="ghost" onClick={() => void exportCsv(tab === 'pipeline' ? 'pipeline' : tab)}>
            Export CSV
          </AuthButton>
          <AuthButton type="button" onClick={exportPdf}>
            Export PDF
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
    </div>
  );
}
