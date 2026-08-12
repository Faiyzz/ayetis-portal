import {
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  DELAY_LEVEL_LABELS,
  DELAY_LEVELS,
  PASSWORD_POLICY_DESCRIPTION,
  ROLE_LABELS,
  type DelayLevel,
  type SupervisorDashboardDto,
  type SupervisorPerformanceDto,
  type SupervisorQueueCaseDto,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { dialog } from '@/components/dialog';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { SlaProgressBar } from '@/features/cases/components/SlaProgressBar';
import { toast } from '@/features/notifications/toastStore';
import api, { getErrorMessage } from '@/lib/api';

const DELAY_PILL: Record<DelayLevel, string> = {
  [DELAY_LEVELS.GREEN]: 'bg-emerald-50 text-emerald-800',
  [DELAY_LEVELS.YELLOW]: 'bg-amber-50 text-amber-900',
  [DELAY_LEVELS.BLUE]: 'bg-sky-50 text-sky-800',
  [DELAY_LEVELS.RED]: 'bg-red-50 text-red-800',
};

function QueueCaseList({ items }: { items: SupervisorQueueCaseDto[] }) {
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-muted">No cases in this queue snapshot.</p>;
  }
  return (
    <ul className="mt-3 divide-y divide-line">
      {items.slice(0, 8).map((item) => (
        <li key={item.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:justify-between">
          <div>
            <Link to={`/app/cases/${item.caseId}`} className="font-semibold text-brand-700">
              {item.caseId}
            </Link>
            <p className="text-sm text-ink">{item.patientName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <SlaProgressBar
              utilizationPercent={item.slaUtilizationPercent}
              progressColor={item.slaProgressColor}
              className="min-w-[72px]"
              showLabel={false}
            />
            <span className={`rounded-md px-2 py-1 font-medium ${DELAY_PILL[item.delayLevel]}`}>
              {DELAY_LEVEL_LABELS[item.delayLevel]}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1">
              {CASE_STATUS_LABELS[item.status]}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1">
              {CASE_PRIORITY_LABELS[item.priority]}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Counts({
  title,
  counts,
}: {
  title: string;
  counts: { pending: number; active: number; completed: number; returned: number };
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {(
          [
            ['Pending', counts.pending],
            ['Active', counts.active],
            ['Returned', counts.returned],
            ['Completed', counts.completed],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-surface/60 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-xl font-bold text-ink">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SupervisorDashboard({ firstName }: { firstName: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'queues';
  const [dashboard, setDashboard] = useState<SupervisorDashboardDto | null>(null);
  const [report, setReport] = useState<SupervisorPerformanceDto | null>(null);
  const [members, setMembers] = useState<
    Array<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      isActive: boolean;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<string | undefined>();
  const [view, setView] = useState<'month' | 'quarter'>('month');
  const [memberForm, setMemberForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'designer',
  });
  const [busy, setBusy] = useState(false);

  async function loadDashboard() {
    setLoading(true);
    try {
      const { data } = await api.get('/supervisor/dashboard');
      setDashboard(data.data);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load supervisor dashboard'));
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers() {
    try {
      const { data } = await api.get('/supervisor/members');
      setMembers(data.data);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load team members'));
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (tab === 'members') void loadMembers();
  }, [tab]);

  useEffect(() => {
    if (tab !== 'performance') return;
    async function load() {
      try {
        const { data } = await api.get('/supervisor/performance', {
          params: { month, view },
        });
        setReport(data.data);
      } catch (err) {
        toast().error(getErrorMessage(err, 'Unable to load team performance'));
      }
    }
    void load();
  }, [tab, month, view]);

  async function handleAddMember(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/supervisor/members', memberForm);
      toast().success('Team member added');
      setMemberForm({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'designer',
      });
      await loadMembers();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to add member'));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(userId: string, email: string) {
    const confirmed = await dialog.confirm({
      title: 'Deactivate member',
      message: `Deactivate ${email}? They will no longer be able to sign in.`,
      confirmLabel: 'Deactivate',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await api.post(`/supervisor/members/${userId}/deactivate`);
      toast().success('Member deactivated');
      await loadMembers();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to deactivate member'));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Supervisor portal"
        title={`Welcome, ${firstName}`}
        subtitle="Monitor designer, QC, and consultant queues, delays, and team performance."
      />

      <div className="flex flex-wrap gap-2 border-b border-line pb-px">
        {(
          [
            ['queues', 'Team queues'],
            ['workload', 'Workload & delays'],
            ['performance', 'Performance'],
            ['members', 'Team members'],
            ['escalated', 'Escalated'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              setSearchParams(id === 'queues' ? {} : { tab: id }, { replace: true })
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

      {loading && !dashboard ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : null}

      {tab === 'queues' && dashboard ? (
        <div className="space-y-4">
          <Counts title="Designer queue" counts={dashboard.queues.designer} />
          <QueueCaseList items={dashboard.queues.designer.items} />
          <Counts title="QC queue" counts={dashboard.queues.qc} />
          <QueueCaseList items={dashboard.queues.qc.items} />
          <Counts title="Consultant queue" counts={dashboard.queues.consultant} />
          <QueueCaseList items={dashboard.queues.consultant.items} />
        </div>
      ) : null}

      {tab === 'workload' && dashboard ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Open cases', dashboard.workload.totalOpen],
              ['Urgent', dashboard.workload.urgentCount],
              ['Flagged delays', dashboard.workload.delayedCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">Delayed cases</h2>
            <QueueCaseList items={dashboard.workload.delayedCases} />
          </div>
        </section>
      ) : null}

      {tab === 'performance' ? (
        <section className="rounded-xl border border-line bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Team performance</h2>
              <p className="mt-1 text-sm text-muted">Month-wise team and individual metrics.</p>
            </div>
            {report ? (
              <>
                <select
                  value={report.periodKey}
                  onChange={(e) => setMonth(e.target.value)}
                  className="rounded-xl border border-line px-3 py-2 text-sm"
                >
                  {report.availableMonths.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  {(['month', 'quarter'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setView(option)}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                        report.view === option
                          ? 'bg-brand-600 text-white'
                          : 'border border-line text-ink'
                      }`}
                    >
                      {option === 'month' ? 'Monthly' : 'Quarter'}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          {report ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Team cases', report.team.totalCases],
                  ['Modifications', report.team.modifications],
                  ['QC reviews', report.team.qcCasesCount],
                  ['QC reverted', report.team.qcRevertedCount],
                  ['Consultant reviews', report.team.consultantReviewCount],
                  ['Consultant QC reverted', report.team.consultantQcRevertedCount],
                  ['Consultations', report.team.consultantConsultationCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-line bg-surface/40 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-surface text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Member</th>
                      <th className="px-3 py-2 font-medium">Role</th>
                      <th className="px-3 py-2 font-medium">Cases</th>
                      <th className="px-3 py-2 font-medium">Done</th>
                      <th className="px-3 py-2 font-medium">Mods</th>
                      <th className="px-3 py-2 font-medium">QC</th>
                      <th className="px-3 py-2 font-medium">Reverted</th>
                      <th className="px-3 py-2 font-medium">Consults</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {report.members.map((member) => (
                      <tr key={member.userId}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-ink">{member.name}</p>
                          <p className="text-xs text-muted">{member.email}</p>
                        </td>
                        <td className="px-3 py-2">
                          {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] ?? member.role}
                        </td>
                        <td className="px-3 py-2">{member.totalCases}</td>
                        <td className="px-3 py-2">{member.completedCases}</td>
                        <td className="px-3 py-2">{member.modifications}</td>
                        <td className="px-3 py-2">{member.qcReviews}</td>
                        <td className="px-3 py-2">{member.qcReverted}</td>
                        <td className="px-3 py-2">{member.consultations}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Loading performance…</p>
          )}
        </section>
      ) : null}

      {tab === 'members' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <form
            onSubmit={handleAddMember}
            className="space-y-3 rounded-xl border border-line bg-white p-5"
          >
            <h2 className="text-sm font-semibold text-ink">Add team member</h2>
            <p className="text-sm text-muted">Designer, QC, or Consultant only.</p>
            <TextField
              label="First name"
              value={memberForm.firstName}
              onChange={(e) => setMemberForm((s) => ({ ...s, firstName: e.target.value }))}
              required
            />
            <TextField
              label="Last name"
              value={memberForm.lastName}
              onChange={(e) => setMemberForm((s) => ({ ...s, lastName: e.target.value }))}
              required
            />
            <TextField
              label="Email"
              type="email"
              value={memberForm.email}
              onChange={(e) => setMemberForm((s) => ({ ...s, email: e.target.value }))}
              required
            />
            <TextField
              label="Temporary password"
              type="password"
              value={memberForm.password}
              onChange={(e) => setMemberForm((s) => ({ ...s, password: e.target.value }))}
              hint={PASSWORD_POLICY_DESCRIPTION}
              required
            />
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-ink">Role</span>
              <select
                value={memberForm.role}
                onChange={(e) => setMemberForm((s) => ({ ...s, role: e.target.value }))}
                className="w-full rounded-xl border border-line px-3 py-2.5"
              >
                <option value="designer">Designer</option>
                <option value="qc">QC</option>
                <option value="orthodontist">Consultant</option>
              </select>
            </label>
            <AuthButton loading={busy}>Add member</AuthButton>
          </form>

          <section className="rounded-xl border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">Current team</h2>
            <ul className="mt-3 divide-y divide-line">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-ink">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-sm text-muted">
                      {member.email} ·{' '}
                      {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] ?? member.role}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-medium ${
                        member.isActive
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {member.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {member.isActive ? (
                      <button
                        type="button"
                        onClick={() => void deactivate(member.id, member.email)}
                        className="rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-red-300"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {tab === 'escalated' && dashboard ? (
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Escalated cases</h2>
          <p className="mt-1 text-sm text-muted">
            Cases escalated for consultant oversight after repeated QC rejection.
          </p>
          <QueueCaseList items={dashboard.escalatedCases} />
        </section>
      ) : null}
    </div>
  );
}
