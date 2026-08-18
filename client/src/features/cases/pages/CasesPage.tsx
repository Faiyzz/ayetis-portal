import {
  ALL_CASE_CATEGORIES,
  ALL_CASE_PRIORITIES,
  ALL_CASE_STATUSES,
  CASE_CATEGORIES,
  CASE_CATEGORY_LABELS,
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  CASE_STATUSES,
  PAYMENT_STATUS_LABELS,
  PERMISSIONS,
  formatCaseIdLabel,
  isCaseDraft,
  isCaseStatus,
  type CaseCategory,
  type CaseListItemDto,
  type CasePriority,
  type CaseStatus,
  type ClarificationButtonState,
  type CountryDto,
  type RegionDto,
} from '@ayetis/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import { useAuthStore } from '@/features/auth/store';
import { fetchCases } from '@/features/cases/api';
import { SlaProgressBar } from '@/features/cases/components/SlaProgressBar';
import { toast } from '@/features/notifications/toastStore';
import { fetchCountries, fetchRegions } from '@/features/settings/api';
import { getErrorMessage } from '@/lib/api';

function StatusPill({ status }: { status: CaseStatus }) {
  const cancelled = status === 'cancelled';
  const draft = isCaseDraft(status);
  return (
    <span
      className={[
        'inline-flex rounded-md px-2 py-1 text-xs font-medium',
        cancelled
          ? 'bg-red-50 text-red-700'
          : draft
            ? 'bg-amber-50 text-amber-800'
            : 'bg-brand-50 text-brand-700',
      ].join(' ')}
    >
      {CASE_STATUS_LABELS[status]}
    </span>
  );
}

function SlaBar({ item }: { item: CaseListItemDto }) {
  return (
    <SlaProgressBar
      utilizationPercent={item.slaUtilizationPercent}
      progressColor={item.slaProgressColor}
      emptyLabel="—"
    />
  );
}

function ClarificationButton({
  state,
  caseId,
}: {
  state: ClarificationButtonState;
  caseId: string;
}) {
  if (state === 'none') {
    return <span className="text-xs text-muted">—</span>;
  }
  const classes =
    state === 'green'
      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
      : 'bg-sky-600 text-white hover:bg-sky-700';
  const label = state === 'green' ? 'Responded' : 'Clarification';
  return (
    <Link
      to={`/app/cases/${caseId}?tab=clarifications`}
      className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {label}
    </Link>
  );
}

export function CasesPage() {
  const { can, canAny } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const canResumeDrafts =
    can(PERMISSIONS.CASE_CREATE) ||
    can(PERMISSIONS.CASE_VIEW_ALL) ||
    can(PERMISSIONS.CASE_VIEW_ORG) ||
    can(PERMISSIONS.CASE_VIEW_FACILITY);
  const [searchParams, setSearchParams] = useSearchParams();
  const isDoctorView =
    can(PERMISSIONS.CASE_VIEW_OWN) &&
    !canAny(PERMISSIONS.CASE_VIEW_ALL, PERMISSIONS.CASE_VIEW_ASSIGNED);
  const isDesignerView =
    can(PERMISSIONS.CASE_VIEW_ASSIGNED) && !can(PERMISSIONS.CASE_VIEW_ALL);
  const [items, setItems] = useState<CaseListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  async function copyCaseId(caseId: string) {
    try {
      await navigator.clipboard.writeText(caseId);
      toast().success(`Copied ${caseId}`);
    } catch {
      toast().error('Unable to copy case ID');
    }
  }
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<CaseStatus | ''>(() => {
    const fromUrl = searchParams.get('status');
    return fromUrl && isCaseStatus(fromUrl) ? fromUrl : '';
  });
  const [priority, setPriority] = useState<CasePriority | ''>('');
  const [countryId, setCountryId] = useState('');
  const [regionId, setRegionId] = useState('');
  const [countries, setCountries] = useState<CountryDto[]>([]);
  const [regions, setRegions] = useState<RegionDto[]>([]);
  const [categoryTab, setCategoryTab] = useState<CaseCategory | 'all'>('all');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [demoOnly, setDemoOnly] = useState(searchParams.get('isDemo') === 'true');
  const [loading, setLoading] = useState(true);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const cat of ALL_CASE_CATEGORIES) counts[cat] = 0;
    for (const item of items) {
      if (item.caseCategory) counts[item.caseCategory] = (counts[item.caseCategory] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const visibleItems = useMemo(() => {
    if (categoryTab === 'all') return items;
    return items.filter((item) => item.caseCategory === categoryTab);
  }, [items, categoryTab]);

  async function load(nextPage = page, nextStatus = status) {
    setLoading(true);
    try {
      const data = await fetchCases({
        page: nextPage,
        pageSize,
        q,
        status: nextStatus,
        priority,
        includeDeleted: can(PERMISSIONS.CASE_DELETE) ? includeDeleted : false,
        isDemo: demoOnly ? true : undefined,
        countryId: countryId || undefined,
        regionId: regionId || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load cases'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    void Promise.all([fetchCountries(true), fetchRegions()])
      .then(([nextCountries, nextRegions]) => {
        setCountries(nextCountries);
        setRegions(nextRegions);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilter(event: FormEvent) {
    event.preventDefault();
    void load(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cases"
        title={
          isDoctorView
            ? 'My submitted cases'
            : isDesignerView
              ? 'My assigned cases'
              : 'Case listing'
        }
        subtitle={
          isDoctorView
            ? 'Track every case you have submitted in one place — status, priority, and payment.'
            : isDesignerView
              ? 'Cases assigned to you for production. Open a case to review files and instructions.'
              : 'Search and filter cases relevant to your role.'
        }
      >
        {can(PERMISSIONS.CASE_CREATE) ? (
          <Link
            to="/app/cases/new"
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Create case
          </Link>
        ) : null}
      </PageHeader>

      <form
        onSubmit={handleFilter}
        className="grid gap-3 rounded-xl border border-line bg-white p-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]"
      >
        <TextField
          label="Search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Case ID, patient, doctor…"
        />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CaseStatus | '')}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          >
            <option value="">All statuses</option>
            {ALL_CASE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {CASE_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Priority</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as CasePriority | '')}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          >
            <option value="">All priorities</option>
            {ALL_CASE_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {CASE_PRIORITY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Region</span>
          <select
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          >
            <option value="">All regions</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Country</span>
          <select
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          >
            <option value="">All countries</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={status === CASE_STATUSES.NEW_CASE}
              onChange={(e) => {
                const next = e.target.checked ? CASE_STATUSES.NEW_CASE : '';
                setStatus(next);
                setSearchParams(
                  next
                    ? { status: next, ...(demoOnly ? { isDemo: 'true' } : {}) }
                    : demoOnly
                      ? { isDemo: 'true' }
                      : {},
                  { replace: true },
                );
                void load(1, next);
              }}
            />
            New cases only
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={status === CASE_STATUSES.SAVED_FOR_SUBMISSION}
              onChange={(e) => {
                const next = e.target.checked ? CASE_STATUSES.SAVED_FOR_SUBMISSION : '';
                setStatus(next);
                void load(1, next);
              }}
            />
            Drafts only
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={demoOnly}
              onChange={(e) => {
                const next = e.target.checked;
                setDemoOnly(next);
                setSearchParams(next ? { isDemo: 'true' } : {}, { replace: true });
              }}
            />
            Demo cases only
          </label>
          {can(PERMISSIONS.CASE_DELETE) ? (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
              />
              Include deleted
            </label>
          ) : null}
          <AuthButton loading={loading}>Apply</AuthButton>
        </div>
      </form>

      {isDoctorView ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryTab('all')}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-semibold',
              categoryTab === 'all' ? 'bg-brand-500 text-white' : 'border border-line text-ink',
            ].join(' ')}
          >
            All ({categoryCounts.all ?? 0})
          </button>
          {ALL_CASE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryTab(cat)}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-semibold',
                categoryTab === cat ? 'bg-brand-500 text-white' : 'border border-line text-ink',
              ].join(' ')}
            >
              {CASE_CATEGORY_LABELS[cat].split(' ')[0]} ({categoryCounts[cat] ?? 0})
            </button>
          ))}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Case ID</th>
                <th className="px-4 py-3 font-medium">Patient</th>
                {!isDoctorView && !isDesignerView ? (
                  <th className="px-4 py-3 font-medium">Doctor</th>
                ) : null}
                {!isDoctorView ? <th className="px-4 py-3 font-medium">Assignee</th> : null}
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Clarification</th>
                <th className="px-4 py-3 font-medium">SLA</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-muted">
                    Loading cases…
                  </td>
                </tr>
              ) : visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-muted">
                    No cases found.
                  </td>
                </tr>
              ) : (
                visibleItems.map((item) => (
                  <tr key={item.id} className={item.isDeleted ? 'opacity-60' : undefined}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          to={`/app/cases/${item.caseId}`}
                          className="font-semibold text-brand-600 hover:text-brand-700"
                        >
                          {formatCaseIdLabel(item.caseId, item.status)}
                        </Link>
                        {item.status === 'saved_for_submission' &&
                        (user?.id === item.doctorId || canResumeDrafts) ? (
                          <Link
                            to={`/app/cases/${item.caseId}/resume`}
                            className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 hover:bg-brand-100"
                          >
                            Resume
                          </Link>
                        ) : null}
                        {item.isDemo ? (
                          <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                            Demo
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void copyCaseId(item.caseId)}
                          className="text-xs text-muted hover:text-ink"
                          title="Copy case ID"
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink">{item.patientName}</td>
                    {!isDoctorView && !isDesignerView ? (
                      <td className="px-4 py-3 text-ink">{item.doctorName}</td>
                    ) : null}
                    {!isDoctorView ? (
                      <td className="px-4 py-3 text-muted">
                        {item.assignedDesignerName || '—'}
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-xs text-muted">
                      {item.caseCategory
                        ? CASE_CATEGORY_LABELS[item.caseCategory] ?? item.caseCategory
                        : CASE_CATEGORY_LABELS[CASE_CATEGORIES.DIGITAL_ALIGNER]}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ClarificationButton
                        state={item.clarificationButtonState}
                        caseId={item.caseId}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <SlaBar item={item} />
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {CASE_PRIORITY_LABELS[item.priority]}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {PAYMENT_STATUS_LABELS[item.paymentStatus]}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(item.updatedAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
          <span>
            {total} case{total === 1 ? '' : 's'} · Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => void load(page - 1)}
              className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => void load(page + 1)}
              className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
