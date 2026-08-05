import {
  ALL_CASE_CATEGORIES,
  CASE_CATEGORY_LABELS,
  PERMISSIONS,
  type DiscountCodeDto,
  type TreatmentPlanDto,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import {
  fetchDiscountCodes,
  fetchTreatmentPlans,
  upsertDiscountCode,
  upsertTreatmentPlan,
} from '@/features/commercial/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

type Tab = 'plans' | 'discounts';

const EMPTY_PLAN = {
  name: '',
  caseCategory: '' as string,
  description: '',
  price: '',
  currency: 'USD',
  estimatedDeliveryHours: '',
  isActive: true,
};

const EMPTY_DISCOUNT = {
  code: '',
  description: '',
  percentOff: '',
  amountOff: '',
  currency: 'USD',
  isActive: true,
};

export function CommercialAdminPage() {
  const { can } = usePermissions();
  const canPlans = can(PERMISSIONS.TREATMENT_PLAN_MANAGE);
  const canDiscounts = can(PERMISSIONS.DISCOUNT_CODE_MANAGE);
  const [tab, setTab] = useState<Tab>(canPlans ? 'plans' : 'discounts');

  const [plans, setPlans] = useState<TreatmentPlanDto[]>([]);
  const [discounts, setDiscounts] = useState<DiscountCodeDto[]>([]);
  const [planForm, setPlanForm] = useState({ ...EMPTY_PLAN, id: '' as string });
  const [discountForm, setDiscountForm] = useState({ ...EMPTY_DISCOUNT, id: '' as string });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [planList, discountList] = await Promise.all([
        canPlans ? fetchTreatmentPlans(false) : Promise.resolve([]),
        canDiscounts ? fetchDiscountCodes() : Promise.resolve([]),
      ]);
      setPlans(planList);
      setDiscounts(discountList);
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to load commercial data');
      setError(message);
      toast().error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function savePlan(event: FormEvent) {
    event.preventDefault();
    if (!canPlans) return;
    setSaving(true);
    try {
      await upsertTreatmentPlan({
        id: planForm.id || undefined,
        name: planForm.name.trim(),
        caseCategory: planForm.caseCategory || null,
        description: planForm.description.trim() || undefined,
        price: Number(planForm.price),
        currency: planForm.currency || 'USD',
        estimatedDeliveryHours: planForm.estimatedDeliveryHours
          ? Number(planForm.estimatedDeliveryHours)
          : null,
        isActive: planForm.isActive,
      });
      toast().success(planForm.id ? 'Treatment plan updated' : 'Treatment plan created');
      setPlanForm({ ...EMPTY_PLAN, id: '' });
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save treatment plan'));
    } finally {
      setSaving(false);
    }
  }

  async function saveDiscount(event: FormEvent) {
    event.preventDefault();
    if (!canDiscounts) return;
    setSaving(true);
    try {
      await upsertDiscountCode({
        id: discountForm.id || undefined,
        code: discountForm.code.trim().toUpperCase(),
        description: discountForm.description.trim() || undefined,
        percentOff: discountForm.percentOff ? Number(discountForm.percentOff) : null,
        amountOff: discountForm.amountOff ? Number(discountForm.amountOff) : null,
        currency: discountForm.currency || 'USD',
        isActive: discountForm.isActive,
      });
      toast().success(discountForm.id ? 'Discount updated' : 'Discount created');
      setDiscountForm({ ...EMPTY_DISCOUNT, id: '' });
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save discount code'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Commercial"
        subtitle="Treatment plans, pricing, and discount codes used in Create New Case."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {canPlans ? (
          <button
            type="button"
            onClick={() => setTab('plans')}
            className={[
              'rounded-lg px-3.5 py-2 text-sm font-semibold',
              tab === 'plans' ? 'bg-brand-500 text-white' : 'border border-line text-ink',
            ].join(' ')}
          >
            Treatment plans
          </button>
        ) : null}
        {canDiscounts ? (
          <button
            type="button"
            onClick={() => setTab('discounts')}
            className={[
              'rounded-lg px-3.5 py-2 text-sm font-semibold',
              tab === 'discounts' ? 'bg-brand-500 text-white' : 'border border-line text-ink',
            ].join(' ')}
          >
            Discount codes
          </button>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-muted">Loading…</p> : null}

      {tab === 'plans' && canPlans ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={savePlan} className="space-y-3 rounded-xl border border-line bg-white p-4">
            <h2 className="text-sm font-semibold text-ink">
              {planForm.id ? 'Edit plan' : 'New treatment plan'}
            </h2>
            <TextField
              label="Name"
              name="name"
              value={planForm.name}
              onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Category</span>
              <select
                value={planForm.caseCategory}
                onChange={(e) => setPlanForm((p) => ({ ...p, caseCategory: e.target.value }))}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
              >
                <option value="">Any</option>
                {ALL_CASE_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {CASE_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Description"
              name="description"
              value={planForm.description}
              onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Price"
                name="price"
                type="number"
                value={planForm.price}
                onChange={(e) => setPlanForm((p) => ({ ...p, price: e.target.value }))}
                required
              />
              <TextField
                label="Currency"
                name="currency"
                value={planForm.currency}
                onChange={(e) => setPlanForm((p) => ({ ...p, currency: e.target.value }))}
              />
            </div>
            <TextField
              label="Est. delivery hours"
              name="hours"
              type="number"
              value={planForm.estimatedDeliveryHours}
              onChange={(e) =>
                setPlanForm((p) => ({ ...p, estimatedDeliveryHours: e.target.value }))
              }
            />
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={planForm.isActive}
                onChange={(e) => setPlanForm((p) => ({ ...p, isActive: e.target.checked }))}
              />
              Active
            </label>
            <div className="flex gap-2">
              <AuthButton loading={saving}>{planForm.id ? 'Update' : 'Create'}</AuthButton>
              {planForm.id ? (
                <button
                  type="button"
                  className="rounded-lg border border-line px-3 py-2 text-sm"
                  onClick={() => setPlanForm({ ...EMPTY_PLAN, id: '' })}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </form>

          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{plan.name}</p>
                      <p className="text-xs text-muted">
                        {plan.caseCategory
                          ? CASE_CATEGORY_LABELS[plan.caseCategory]
                          : 'Any category'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {plan.currency} {plan.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">{plan.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="font-medium text-brand-600"
                        onClick={() =>
                          setPlanForm({
                            id: plan.id,
                            name: plan.name,
                            caseCategory: plan.caseCategory ?? '',
                            description: plan.description,
                            price: String(plan.price),
                            currency: plan.currency,
                            estimatedDeliveryHours:
                              plan.estimatedDeliveryHours != null
                                ? String(plan.estimatedDeliveryHours)
                                : '',
                            isActive: plan.isActive,
                          })
                        }
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {tab === 'discounts' && canDiscounts ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <form
            onSubmit={saveDiscount}
            className="space-y-3 rounded-xl border border-line bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-ink">
              {discountForm.id ? 'Edit discount' : 'New discount code'}
            </h2>
            <TextField
              label="Code"
              name="code"
              value={discountForm.code}
              onChange={(e) => setDiscountForm((p) => ({ ...p, code: e.target.value }))}
              required
            />
            <TextField
              label="Description"
              name="description"
              value={discountForm.description}
              onChange={(e) => setDiscountForm((p) => ({ ...p, description: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Percent off"
                name="percentOff"
                type="number"
                value={discountForm.percentOff}
                onChange={(e) => setDiscountForm((p) => ({ ...p, percentOff: e.target.value }))}
              />
              <TextField
                label="Amount off"
                name="amountOff"
                type="number"
                value={discountForm.amountOff}
                onChange={(e) => setDiscountForm((p) => ({ ...p, amountOff: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={discountForm.isActive}
                onChange={(e) => setDiscountForm((p) => ({ ...p, isActive: e.target.checked }))}
              />
              Active
            </label>
            <div className="flex gap-2">
              <AuthButton loading={saving}>{discountForm.id ? 'Update' : 'Create'}</AuthButton>
              {discountForm.id ? (
                <button
                  type="button"
                  className="rounded-lg border border-line px-3 py-2 text-sm"
                  onClick={() => setDiscountForm({ ...EMPTY_DISCOUNT, id: '' })}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </form>

          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Offer</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {discounts.map((code) => (
                  <tr key={code.id}>
                    <td className="px-4 py-3 font-mono font-medium text-ink">{code.code}</td>
                    <td className="px-4 py-3 text-muted">
                      {code.percentOff != null
                        ? `${code.percentOff}%`
                        : code.amountOff != null
                          ? `${code.currency} ${code.amountOff}`
                          : '—'}
                    </td>
                    <td className="px-4 py-3">{code.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="font-medium text-brand-600"
                        onClick={() =>
                          setDiscountForm({
                            id: code.id,
                            code: code.code,
                            description: code.description,
                            percentOff: code.percentOff != null ? String(code.percentOff) : '',
                            amountOff: code.amountOff != null ? String(code.amountOff) : '',
                            currency: code.currency,
                            isActive: code.isActive,
                          })
                        }
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}
    </div>
  );
}
