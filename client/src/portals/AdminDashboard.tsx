import {
  ALL_COMPLAINT_STATUSES,
  ALL_COMPLAINT_TYPES,
  ALL_DEPARTMENT_TYPES,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_TYPE_LABELS,
  DELETE_REQUEST_STATUS_LABELS,
  DEPARTMENT_TYPE_LABELS,
  type ComplaintDto,
  type DeleteRequestDto,
  type DepartmentDto,
  type RatingsOverviewDto,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { toast } from '@/features/notifications/toastStore';
import api, { getErrorMessage } from '@/lib/api';

export function AdminDashboard({ firstName }: { firstName: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'overview';

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-line bg-white px-5 py-5 sm:px-6">
        <p className="text-sm font-medium text-brand-600">Admin portal</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          Welcome, {firstName}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted">
          Manage users, departments, complaints, priorities, and deletion approvals.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-line pb-px">
        {(
          [
            ['overview', 'Overview'],
            ['departments', 'Departments'],
            ['complaints', 'Complaints & ratings'],
            ['deletions', 'Delete approvals'],
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

      {tab === 'overview' ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Users', '/app/users', 'Add, remove, or transfer accounts'],
            ['Permissions', '/app/roles', 'Assign role and user permissions'],
            ['Cases', '/app/cases', 'Reassign cases and set urgent priority'],
            ['Departments', '/app/admin?tab=departments', 'Org structure and team transfers'],
            ['Complaints', '/app/admin?tab=complaints', 'Doctor complaints and ratings'],
            ['Delete log', '/app/admin?tab=deletions', 'Approve deletions and audit log'],
          ].map(([label, to, description]) => (
            <Link
              key={label}
              to={to}
              className="rounded-xl border border-line bg-white px-4 py-4 hover:border-brand-300"
            >
              <p className="font-semibold text-ink">{label}</p>
              <p className="mt-1 text-sm text-muted">{description}</p>
            </Link>
          ))}
        </section>
      ) : null}

      {tab === 'departments' ? <DepartmentsPanel /> : null}
      {tab === 'complaints' ? <ComplaintsPanel /> : null}
      {tab === 'deletions' ? <DeletionsPanel /> : null}
    </div>
  );
}

function DepartmentsPanel() {
  const [items, setItems] = useState<DepartmentDto[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; email: string; firstName: string; lastName: string; role: string }>>([]);
  const [form, setForm] = useState({
    name: '',
    code: '',
    type: 'general',
    description: '',
  });
  const [transfer, setTransfer] = useState({ userId: '', toDepartmentId: '' });
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [deps, usersRes] = await Promise.all([
        api.get('/departments'),
        api.get('/users'),
      ]);
      setItems(deps.data.data);
      setUsers(usersRes.data.data);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load departments'));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/departments', form);
      toast().success('Department created');
      setForm({ name: '', code: '', type: 'general', description: '' });
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to create department'));
    } finally {
      setBusy(false);
    }
  }

  async function handleTransfer(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/departments/transfer', {
        userId: transfer.userId,
        toDepartmentId: transfer.toDepartmentId || null,
      });
      toast().success('Member transferred');
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to transfer member'));
    } finally {
      setBusy(false);
    }
  }

  async function requestDelete(dept: DepartmentDto) {
    const reason = window.prompt(`Reason for deleting ${dept.code}:`);
    if (!reason || reason.trim().length < 3) return;
    if (!window.confirm('Submit delete request for admin approval?')) return;
    try {
      await api.post(`/departments/${dept.id}/delete-request`, { reason: reason.trim() });
      toast().success('Delete request submitted');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to request delete'));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Add department</h2>
        <TextField
          label="Name"
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          required
        />
        <TextField
          label="Code"
          value={form.code}
          onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
          required
        />
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-ink">Type</span>
          <select
            value={form.type}
            onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
            className="w-full rounded-xl border border-line px-3 py-2.5"
          >
            {ALL_DEPARTMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {DEPARTMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <AuthButton loading={busy}>Create department</AuthButton>
      </form>

      <form onSubmit={handleTransfer} className="space-y-3 rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Transfer member</h2>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-ink">User</span>
          <select
            value={transfer.userId}
            onChange={(e) => setTransfer((s) => ({ ...s, userId: e.target.value }))}
            className="w-full rounded-xl border border-line px-3 py-2.5"
            required
          >
            <option value="">Select user…</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName} ({user.email})
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-ink">To department</span>
          <select
            value={transfer.toDepartmentId}
            onChange={(e) => setTransfer((s) => ({ ...s, toDepartmentId: e.target.value }))}
            className="w-full rounded-xl border border-line px-3 py-2.5"
          >
            <option value="">Unassigned</option>
            {items.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.code} — {dept.name}
              </option>
            ))}
          </select>
        </label>
        <AuthButton loading={busy}>Transfer</AuthButton>
      </form>

      <section className="lg:col-span-2 rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Departments</h2>
        <ul className="mt-3 divide-y divide-line">
          {items.map((dept) => (
            <li key={dept.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:justify-between">
              <div>
                <p className="font-semibold text-ink">
                  {dept.code} — {dept.name}
                </p>
                <p className="text-sm text-muted">
                  {DEPARTMENT_TYPE_LABELS[dept.type]} · {dept.memberCount} members
                  {dept.supervisorName ? ` · Supervisor: ${dept.supervisorName}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void requestDelete(dept)}
                className="rounded-xl border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700"
              >
                Request delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ComplaintsPanel() {
  const [items, setItems] = useState<ComplaintDto[]>([]);
  const [ratings, setRatings] = useState<RatingsOverviewDto | null>(null);
  const [form, setForm] = useState({
    details: '',
    caseId: '',
    type: 'quality',
    rating: '',
  });
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [list, overview] = await Promise.all([
        api.get('/complaints'),
        api.get('/complaints/ratings'),
      ]);
      setItems(list.data.data);
      setRatings(overview.data.data);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load complaints'));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/complaints', {
        details: form.details,
        caseId: form.caseId || undefined,
        type: form.type,
        rating: form.rating ? Number(form.rating) : null,
      });
      toast().success('Complaint filed');
      setForm({ details: '', caseId: '', type: 'quality', rating: '' });
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to file complaint'));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await api.patch(`/complaints/${id}`, { status });
      toast().success('Complaint updated');
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update complaint'));
    }
  }

  return (
    <div className="space-y-4">
      {ratings ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Avg satisfaction', ratings.averageSatisfaction ?? '—'],
            ['Approval rate', ratings.approvalRate != null ? `${ratings.approvalRate}%` : '—'],
            ['Modification rate', ratings.rejectionRate != null ? `${ratings.rejectionRate}%` : '—'],
            ['Open complaints', ratings.complaintsOpen],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
              <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">File complaint / rating</h2>
        <TextField
          label="Case ID (optional)"
          value={form.caseId}
          onChange={(e) => setForm((s) => ({ ...s, caseId: e.target.value }))}
        />
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-ink">Type</span>
          <select
            value={form.type}
            onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
            className="w-full rounded-xl border border-line px-3 py-2.5"
          >
            {ALL_COMPLAINT_TYPES.map((type) => (
              <option key={type} value={type}>
                {COMPLAINT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Rating 1–5 (optional)"
          value={form.rating}
          onChange={(e) => setForm((s) => ({ ...s, rating: e.target.value }))}
        />
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-ink">Details</span>
          <textarea
            required
            rows={3}
            value={form.details}
            onChange={(e) => setForm((s) => ({ ...s, details: e.target.value }))}
            className="w-full rounded-xl border border-line px-3 py-2.5"
          />
        </label>
        <AuthButton loading={busy}>Submit</AuthButton>
      </form>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">All complaints</h2>
        <ul className="mt-3 divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="space-y-2 py-3">
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
              </div>
              <p className="text-sm text-ink whitespace-pre-wrap">{item.details}</p>
              <div className="flex flex-wrap gap-2">
                {ALL_COMPLAINT_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => void setStatus(item.id, status)}
                    className="rounded-lg border border-line px-2 py-1 text-xs font-semibold"
                  >
                    {COMPLAINT_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DeletionsPanel() {
  const [pending, setPending] = useState<DeleteRequestDto[]>([]);
  const [log, setLog] = useState<DeleteRequestDto[]>([]);
  const [subTab, setSubTab] = useState<'pending' | 'log'>('pending');

  async function load() {
    try {
      const [p, l] = await Promise.all([
        api.get('/deletions', { params: { status: 'pending' } }),
        api.get('/deletions/log'),
      ]);
      setPending(p.data.data);
      setLog(l.data.data);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load delete requests'));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function review(request: DeleteRequestDto, decision: 'approve' | 'reject') {
    if (!window.confirm(`${decision === 'approve' ? 'Approve' : 'Reject'} delete for ${request.recordLabel}?`)) {
      return;
    }
    const confirmation = window.prompt('Type DELETE to confirm this irreversible review step:');
    if (confirmation !== 'DELETE') {
      toast().warning('Confirmation cancelled — you must type DELETE');
      return;
    }
    try {
      await api.post(`/deletions/${request.id}/review`, { decision, confirmation });
      toast().success(`Request ${decision}d`);
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to review delete request'));
    }
  }

  const items = subTab === 'pending' ? pending : log;

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab('pending')}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            subTab === 'pending' ? 'bg-brand-600 text-white' : 'border border-line'
          }`}
        >
          Pending ({pending.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('log')}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            subTab === 'log' ? 'bg-brand-600 text-white' : 'border border-line'
          }`}
        >
          Deleted log ({log.length})
        </button>
      </div>

      <ul className="mt-4 divide-y divide-line">
        {items.length === 0 ? (
          <li className="py-4 text-sm text-muted">No records.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{item.recordLabel}</span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">
                  {item.recordType}
                </span>
                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-900">
                  {DELETE_REQUEST_STATUS_LABELS[item.status]}
                </span>
                {item.caseId ? (
                  <Link to={`/app/cases/${item.caseId}`} className="text-xs text-brand-700">
                    {item.caseId}
                  </Link>
                ) : null}
              </div>
              <p className="text-sm text-ink">
                <span className="font-medium">{item.requestedByName}</span> ({item.requestedByEmail}):{' '}
                {item.reason}
              </p>
              <p className="text-xs text-muted">
                Requested {new Date(item.createdAt).toLocaleString()}
                {item.reviewedAt
                  ? ` · Reviewed ${new Date(item.reviewedAt).toLocaleString()} by ${item.reviewedByName}`
                  : ''}
              </p>
              {subTab === 'pending' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void review(item, 'approve')}
                    className="rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void review(item, 'reject')}
                    className="rounded-xl border border-line px-3 py-1.5 text-sm font-semibold"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
