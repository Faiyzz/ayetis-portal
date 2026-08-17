import {
  ALL_CASE_CATEGORIES,
  CASE_CATEGORY_LABELS,
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  CASE_TYPES_BY_CATEGORY,
  formatCaseIdLabel,
  type CaseCategory,
  type CaseListItemDto,
  type CaseType,
  type DoctorCaseSummaryDto,
  type DoctorDeliveryQueueItemDto,
} from '@ayetis/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';
import {
  acknowledgeCaseStatus,
  fetchCases,
  fetchDoctorCaseSummary,
  fetchDoctorDeliveries,
} from '@/features/cases/api';
import { SlaProgressBar } from '@/features/cases/components/SlaProgressBar';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

type SortField =
  | 'createdAt'
  | 'updatedAt'
  | 'caseId'
  | 'patientName'
  | 'status'
  | 'caseCategory'
  | 'caseType';

export function DoctorDashboard({ firstName }: { firstName: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryTab = (searchParams.get('category') as CaseCategory | 'all' | null) || 'all';
  const typeTab = (searchParams.get('type') as CaseType | 'all' | null) || 'all';

  const [deliveries, setDeliveries] = useState<DoctorDeliveryQueueItemDto[]>([]);
  const [cases, setCases] = useState<CaseListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<DoctorCaseSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [caseIdFilter, setCaseIdFilter] = useState(searchParams.get('caseId') || '');
  const [patientFilter, setPatientFilter] = useState(searchParams.get('patient') || '');
  const [sortBy, setSortBy] = useState<SortField>(
    (searchParams.get('sortBy') as SortField) || 'updatedAt',
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc',
  );

  const typeOptions = useMemo(() => {
    if (categoryTab === 'all') {
      return Object.values(CASE_TYPES_BY_CATEGORY).flat();
    }
    return CASE_TYPES_BY_CATEGORY[categoryTab] ?? [];
  }, [categoryTab]);

  async function load() {
    setLoading(true);
    try {
      const [deliveryList, caseList, caseSummary] = await Promise.all([
        fetchDoctorDeliveries(),
        fetchCases({
          page: 1,
          pageSize: 50,
          caseCategory: categoryTab === 'all' ? undefined : categoryTab,
          caseType: typeTab === 'all' ? undefined : typeTab,
          caseId: caseIdFilter.trim() || undefined,
          patient: patientFilter.trim() || undefined,
          sortBy,
          sortDir,
        }),
        fetchDoctorCaseSummary(),
      ]);
      setDeliveries(deliveryList);
      setCases(caseList.items);
      setTotal(caseList.total);
      setSummary(caseSummary);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load doctor dashboard'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryTab, typeTab, sortBy, sortDir]);

  function updateFilters(next: {
    category?: CaseCategory | 'all';
    type?: CaseType | 'all';
  }) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      const category = next.category ?? categoryTab;
      const type = next.type ?? typeTab;
      if (category === 'all') params.delete('category');
      else params.set('category', category);
      if (type === 'all') params.delete('type');
      else params.set('type', type);
      return params;
    });
  }

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (caseIdFilter.trim()) params.set('caseId', caseIdFilter.trim());
      else params.delete('caseId');
      if (patientFilter.trim()) params.set('patient', patientFilter.trim());
      else params.delete('patient');
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);
      return params;
    });
    void load();
  }

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir(field === 'caseId' || field === 'patientName' ? 'asc' : 'desc');
    }
  }

  async function handleAcknowledge(caseId: string) {
    try {
      await acknowledgeCaseStatus(caseId);
      toast().success('Status update acknowledged');
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to acknowledge status'));
    }
  }

  const awaiting = deliveries.filter(
    (item) => item.status === 'waiting_for_approval' && !item.doctorDecision,
  );

  const sortHint = (field: SortField) =>
    sortBy === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Doctor portal"
        title={`Welcome, ${firstName}`}
        subtitle="Case summary by category, dual status columns, and split Status / Clarification alerts."
      />

      <div className="flex flex-wrap gap-3">
        <Link
          to="/app/cases/new"
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Create case
        </Link>
        <Link
          to="/app/cases"
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand-300"
        >
          All my cases
        </Link>
        <Link
          to="/app/notifications?channel=status_alerts"
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand-300"
        >
          Status Alerts
        </Link>
        <Link
          to="/app/notifications?channel=clarifications"
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand-300"
        >
          Clarifications
        </Link>
      </div>

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Case summary</h2>
            <p className="mt-1 text-sm text-muted">
              Live counts by category and sub-type. Click a tab to filter the list.
              {summary?.pendingStatusAckCount
                ? ` · ${summary.pendingStatusAckCount} status update(s) awaiting acknowledgment`
                : ''}
            </p>
          </div>
          <p className="text-2xl font-bold text-ink">{summary?.total ?? '—'}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateFilters({ category: 'all', type: 'all' })}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              categoryTab === 'all' ? 'bg-brand-600 text-white' : 'border border-line text-ink'
            }`}
          >
            All ({summary?.total ?? 0})
          </button>
          {ALL_CASE_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => updateFilters({ category, type: 'all' })}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                categoryTab === category
                  ? 'bg-brand-600 text-white'
                  : 'border border-line text-ink'
              }`}
            >
              {CASE_CATEGORY_LABELS[category]} ({summary?.byCategory[category] ?? 0})
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateFilters({ type: 'all' })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              typeTab === 'all' ? 'bg-brand-50 text-brand-800' : 'border border-line text-muted'
            }`}
          >
            All types
          </button>
          {typeOptions.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => updateFilters({ type })}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                typeTab === type ? 'bg-brand-50 text-brand-800' : 'border border-line text-muted'
              }`}
            >
              {CASE_TYPE_LABELS[type]} ({summary?.byType[type] ?? 0})
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Awaiting your review</h2>
        <p className="mt-1 text-sm text-muted">Delivered plans waiting for a decision.</p>
        {loading ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : awaiting.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing waiting for approval.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {awaiting.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <Link
                    to={`/app/cases/${item.caseId}`}
                    className="font-semibold text-brand-700 hover:text-brand-800"
                  >
                    {item.caseId}
                  </Link>
                  <p className="text-sm text-ink">{item.patientName}</p>
                  <p className="text-xs text-muted">{item.treatmentSummary}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  {item.hasDeliveryVideo ? (
                    <span className="rounded-md bg-slate-100 px-2 py-1">Video</span>
                  ) : null}
                  {item.hasDeliveryLink ? (
                    <span className="rounded-md bg-slate-100 px-2 py-1">Link</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Case list</h2>
        <p className="mt-1 text-sm text-muted">
          Filter by Case ID, patient, category, and type. Sortable columns. Status / Updated status
          show previous vs new until acknowledged.
        </p>

        <form
          onSubmit={applySearch}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <TextField
            label="Case ID"
            name="caseId"
            value={caseIdFilter}
            onChange={(e) => setCaseIdFilter(e.target.value)}
            placeholder="AY-…"
          />
          <TextField
            label="Patient ID / Name"
            name="patient"
            value={patientFilter}
            onChange={(e) => setPatientFilter(e.target.value)}
            placeholder="Name or ID"
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
            >
              <option value="updatedAt">Updated</option>
              <option value="createdAt">Created</option>
              <option value="caseId">Case ID</option>
              <option value="patientName">Patient</option>
              <option value="status">Status</option>
              <option value="caseCategory">Category</option>
              <option value="caseType">Type</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <label className="block w-full space-y-1.5">
              <span className="text-sm font-medium text-ink">Direction</span>
              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
            <AuthButton type="submit">Search</AuthButton>
          </div>
        </form>

        {loading ? (
          <p className="mt-4 text-sm text-muted">Loading cases…</p>
        ) : cases.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No cases match these filters.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-2 py-2">
                    <button type="button" onClick={() => toggleSort('caseId')}>
                      Case ID{sortHint('caseId')}
                    </button>
                  </th>
                  <th className="px-2 py-2">
                    <button type="button" onClick={() => toggleSort('patientName')}>
                      Patient{sortHint('patientName')}
                    </button>
                  </th>
                  <th className="px-2 py-2">
                    <button type="button" onClick={() => toggleSort('caseCategory')}>
                      Category{sortHint('caseCategory')}
                    </button>
                  </th>
                  <th className="px-2 py-2">
                    <button type="button" onClick={() => toggleSort('caseType')}>
                      Type{sortHint('caseType')}
                    </button>
                  </th>
                  <th className="px-2 py-2">
                    <button type="button" onClick={() => toggleSort('status')}>
                      Status{sortHint('status')}
                    </button>
                  </th>
                  <th className="px-2 py-2">Updated status</th>
                  <th className="px-2 py-2">SLA</th>
                  <th className="px-2 py-2">
                    <button type="button" onClick={() => toggleSort('updatedAt')}>
                      Updated{sortHint('updatedAt')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {cases.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-2 py-3">
                      <Link
                        to={`/app/cases/${item.caseId}`}
                        className="font-semibold text-brand-700"
                      >
                        {formatCaseIdLabel(item.caseId, item.status)}
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-ink">{item.patientName}</td>
                    <td className="px-2 py-3 text-muted">
                      {item.caseCategory
                        ? CASE_CATEGORY_LABELS[item.caseCategory]
                        : '—'}
                    </td>
                    <td className="px-2 py-3 text-muted">
                      {item.caseType ? CASE_TYPE_LABELS[item.caseType] : '—'}
                    </td>
                    <td className="px-2 py-3">
                      <span className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-800">
                        {CASE_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      {item.statusPendingDoctorAck && item.previousStatus ? (
                        <div className="space-y-1">
                          <p className="text-xs text-muted">
                            {CASE_STATUS_LABELS[item.previousStatus]} →{' '}
                            <span className="font-semibold text-amber-800">
                              {CASE_STATUS_LABELS[item.status]}
                            </span>
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleAcknowledge(item.caseId)}
                            className="text-xs font-semibold text-brand-700 hover:underline"
                          >
                            Acknowledge
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <SlaProgressBar
                        utilizationPercent={item.slaUtilizationPercent}
                        progressColor={item.slaProgressColor}
                        className="min-w-[88px]"
                      />
                    </td>
                    <td className="px-2 py-3 text-xs text-muted">
                      {new Date(item.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted">
              Showing {cases.length} of {total}
              {categoryTab !== 'all'
                ? ` · ${CASE_CATEGORY_LABELS[categoryTab as CaseCategory]}`
                : ''}
              {typeTab !== 'all' ? ` · ${CASE_TYPE_LABELS[typeTab as CaseType]}` : ''}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
