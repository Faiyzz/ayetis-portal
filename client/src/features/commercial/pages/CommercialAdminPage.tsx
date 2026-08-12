import {
  ALL_BILLING_ARRANGEMENTS,
  ALL_CASE_CATEGORIES,
  ALL_PAYMENT_PROVIDERS,
  BILLING_ARRANGEMENT_LABELS,
  CASE_CATEGORY_LABELS,
  PAYMENT_PROVIDER_LABELS,
  PERMISSIONS,
  PRICE_SUBJECT_TYPES,
  type BillingArrangement,
  type CustomerPriceOverrideDto,
  type DiscountCodeDto,
  type InvoiceDto,
  type PaymentProviderConfigDto,
  type PrepaidLedgerEntryDto,
  type PriceSubjectType,
  type TreatmentPlanDto,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import {
  creditPrepaid,
  fetchCustomerPrices,
  fetchDiscountCodes,
  fetchInvoices,
  fetchPaymentProviders,
  generateBatchInvoices,
  fetchPrepaidLedger,
  fetchTreatmentPlans,
  updateBillingArrangement,
  upsertCustomerPrice,
  upsertDiscountCode,
  upsertPaymentProvider,
  upsertTreatmentPlan,
} from '@/features/commercial/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

type Tab =
  | 'plans'
  | 'prices'
  | 'discounts'
  | 'billing'
  | 'providers'
  | 'invoices';

const EMPTY_PLAN = {
  name: '',
  caseCategory: '' as string,
  description: '',
  price: '',
  currency: 'USD',
  estimatedDeliveryHours: '',
  isActive: true,
  isDefault: false,
  isFreeDemo: false,
};

const EMPTY_DISCOUNT = {
  code: '',
  description: '',
  percentOff: '',
  amountOff: '',
  currency: 'USD',
  isActive: true,
  maxUses: '',
};

export function CommercialAdminPage() {
  const { can } = usePermissions();
  const canPlans = can(PERMISSIONS.TREATMENT_PLAN_MANAGE);
  const canDiscounts = can(PERMISSIONS.DISCOUNT_CODE_MANAGE);
  const canPrices = can(PERMISSIONS.CUSTOMER_PRICE_MANAGE);
  const canBilling = can(PERMISSIONS.BILLING_ARRANGE_MANAGE);
  const canPrepaid = can(PERMISSIONS.PREPAID_MANAGE);
  const canProviders = can(PERMISSIONS.PAYMENT_PROVIDER_MANAGE);
  const canInvoices = can(PERMISSIONS.INVOICE_VIEW);
  const canManageInvoices = can(PERMISSIONS.INVOICE_MANAGE);

  const firstTab: Tab = canPlans
    ? 'plans'
    : canPrices
      ? 'prices'
      : canDiscounts
        ? 'discounts'
        : canBilling
          ? 'billing'
          : canProviders
            ? 'providers'
            : 'invoices';

  const [tab, setTab] = useState<Tab>(firstTab);
  const [plans, setPlans] = useState<TreatmentPlanDto[]>([]);
  const [discounts, setDiscounts] = useState<DiscountCodeDto[]>([]);
  const [prices, setPrices] = useState<CustomerPriceOverrideDto[]>([]);
  const [providers, setProviders] = useState<PaymentProviderConfigDto[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [ledger, setLedger] = useState<PrepaidLedgerEntryDto[]>([]);
  const [planForm, setPlanForm] = useState({ ...EMPTY_PLAN, id: '' as string });
  const [discountForm, setDiscountForm] = useState({ ...EMPTY_DISCOUNT, id: '' as string });
  const [priceForm, setPriceForm] = useState({
    id: '',
    subjectType: PRICE_SUBJECT_TYPES.USER as PriceSubjectType,
    subjectId: '',
    treatmentPlanId: '',
    price: '',
    currency: 'USD',
  });
  const [billingForm, setBillingForm] = useState({
    subjectType: PRICE_SUBJECT_TYPES.USER as PriceSubjectType,
    subjectId: '',
    billingArrangement: '' as string,
    creditCases: '1',
    reason: '',
  });
  const [providerForm, setProviderForm] = useState({
    id: '',
    provider: 'bank_transfer',
    label: '',
    enabled: true,
    instructions: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [batching, setBatching] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [planList, discountList, priceList, providerList, invoiceList] = await Promise.all([
        canPlans || canPrices ? fetchTreatmentPlans(false) : Promise.resolve([]),
        canDiscounts ? fetchDiscountCodes() : Promise.resolve([]),
        canPrices ? fetchCustomerPrices() : Promise.resolve([]),
        canProviders || canInvoices ? fetchPaymentProviders() : Promise.resolve([]),
        canInvoices ? fetchInvoices() : Promise.resolve([]),
      ]);
      setPlans(planList);
      setDiscounts(discountList);
      setPrices(priceList);
      setProviders(providerList);
      setInvoices(invoiceList);
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
        isDefault: planForm.isDefault,
        isFreeDemo: planForm.isFreeDemo,
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
        maxUses: discountForm.maxUses ? Number(discountForm.maxUses) : null,
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

  async function savePrice(event: FormEvent) {
    event.preventDefault();
    if (!canPrices) return;
    setSaving(true);
    try {
      await upsertCustomerPrice({
        id: priceForm.id || undefined,
        subjectType: priceForm.subjectType,
        subjectId: priceForm.subjectId.trim(),
        treatmentPlanId: priceForm.treatmentPlanId,
        price: Number(priceForm.price),
        currency: priceForm.currency || 'USD',
      });
      toast().success('Customer price saved');
      setPriceForm({
        id: '',
        subjectType: PRICE_SUBJECT_TYPES.USER,
        subjectId: '',
        treatmentPlanId: '',
        price: '',
        currency: 'USD',
      });
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save price'));
    } finally {
      setSaving(false);
    }
  }

  async function saveBilling(event: FormEvent) {
    event.preventDefault();
    if (!canBilling) return;
    setSaving(true);
    try {
      await updateBillingArrangement({
        subjectType: billingForm.subjectType,
        subjectId: billingForm.subjectId.trim(),
        billingArrangement: (billingForm.billingArrangement || null) as BillingArrangement | null,
      });
      toast().success('Billing arrangement updated');
      if (canPrepaid) {
        setLedger(
          await fetchPrepaidLedger(billingForm.subjectType, billingForm.subjectId.trim()),
        );
      }
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update billing'));
    } finally {
      setSaving(false);
    }
  }

  async function doCredit(event: FormEvent) {
    event.preventDefault();
    if (!canPrepaid) return;
    setSaving(true);
    try {
      await creditPrepaid({
        subjectType: billingForm.subjectType,
        subjectId: billingForm.subjectId.trim(),
        cases: Number(billingForm.creditCases),
        reason: billingForm.reason || undefined,
      });
      toast().success('Prepaid balance credited');
      setLedger(await fetchPrepaidLedger(billingForm.subjectType, billingForm.subjectId.trim()));
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to credit prepaid'));
    } finally {
      setSaving(false);
    }
  }

  async function saveProvider(event: FormEvent) {
    event.preventDefault();
    if (!canProviders) return;
    setSaving(true);
    try {
      await upsertPaymentProvider({
        id: providerForm.id || undefined,
        provider: providerForm.provider,
        label: providerForm.label.trim(),
        enabled: providerForm.enabled,
        instructions: providerForm.instructions,
      });
      toast().success('Provider saved');
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save provider'));
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: 'plans', label: 'Plans', show: canPlans },
    { id: 'prices', label: 'Customer prices', show: canPrices },
    { id: 'discounts', label: 'Discount codes', show: canDiscounts },
    { id: 'billing', label: 'Billing & prepaid', show: canBilling || canPrepaid },
    { id: 'providers', label: 'Payment providers', show: canProviders },
    { id: 'invoices', label: 'Invoices', show: canInvoices },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Commercial"
        subtitle="Pricing engine — plans, overrides, discounts, billing, payments, and invoices."
      >
        <Link
          to="/app/cases?isDemo=true"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Demo cases
        </Link>
      </PageHeader>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'rounded-lg px-3.5 py-2 text-sm font-semibold',
                tab === t.id ? 'bg-brand-500 text-white' : 'border border-line text-ink',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
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
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={planForm.isActive}
                onChange={(e) => setPlanForm((p) => ({ ...p, isActive: e.target.checked }))}
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={planForm.isDefault}
                onChange={(e) => setPlanForm((p) => ({ ...p, isDefault: e.target.checked }))}
              />
              Default plan
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={planForm.isFreeDemo}
                onChange={(e) => setPlanForm((p) => ({ ...p, isFreeDemo: e.target.checked }))}
              />
              Free demo plan
            </label>
            <AuthButton loading={saving}>{planForm.id ? 'Update' : 'Create'}</AuthButton>
          </form>

          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Flags</th>
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
                    <td className="px-4 py-3 text-xs text-muted">
                      {[
                        plan.isActive ? 'Active' : 'Inactive',
                        plan.isDefault ? 'Default' : null,
                        plan.isFreeDemo ? 'Free demo' : null,
                        plan.archivedAt ? 'Archived' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </td>
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
                            isDefault: plan.isDefault,
                            isFreeDemo: plan.isFreeDemo,
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

      {tab === 'prices' && canPrices ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={savePrice} className="space-y-3 rounded-xl border border-line bg-white p-4">
            <h2 className="text-sm font-semibold text-ink">Customer / org price override</h2>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Subject type</span>
              <select
                value={priceForm.subjectType}
                onChange={(e) =>
                  setPriceForm((p) => ({
                    ...p,
                    subjectType: e.target.value as PriceSubjectType,
                  }))
                }
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
              >
                <option value={PRICE_SUBJECT_TYPES.USER}>User</option>
                <option value={PRICE_SUBJECT_TYPES.ORGANIZATION}>Organization</option>
              </select>
            </label>
            <TextField
              label="Subject ID"
              name="subjectId"
              value={priceForm.subjectId}
              onChange={(e) => setPriceForm((p) => ({ ...p, subjectId: e.target.value }))}
              required
            />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Treatment plan</span>
              <select
                value={priceForm.treatmentPlanId}
                onChange={(e) =>
                  setPriceForm((p) => ({ ...p, treatmentPlanId: e.target.value }))
                }
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                required
              >
                <option value="">Select…</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Price"
              name="price"
              type="number"
              value={priceForm.price}
              onChange={(e) => setPriceForm((p) => ({ ...p, price: e.target.value }))}
              required
            />
            <AuthButton loading={saving}>Save override</AuthButton>
          </form>
          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {prices.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{row.subjectLabel}</p>
                      <p className="text-xs text-muted">
                        {row.subjectType} · {row.subjectId}
                      </p>
                    </td>
                    <td className="px-4 py-3">{row.treatmentPlanName}</td>
                    <td className="px-4 py-3">
                      {row.currency} {row.price.toFixed(2)}
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
            <TextField
              label="Max uses (optional)"
              name="maxUses"
              type="number"
              value={discountForm.maxUses}
              onChange={(e) => setDiscountForm((p) => ({ ...p, maxUses: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={discountForm.isActive}
                onChange={(e) => setDiscountForm((p) => ({ ...p, isActive: e.target.checked }))}
              />
              Active
            </label>
            <AuthButton loading={saving}>{discountForm.id ? 'Update' : 'Create'}</AuthButton>
          </form>
          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Offer</th>
                  <th className="px-4 py-3 font-medium">Usage</th>
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
                    <td className="px-4 py-3">
                      {code.usageCount}
                      {code.maxUses != null ? ` / ${code.maxUses}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {tab === 'billing' && (canBilling || canPrepaid) ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {canBilling ? (
            <form
              onSubmit={saveBilling}
              className="space-y-3 rounded-xl border border-line bg-white p-4"
            >
              <h2 className="text-sm font-semibold text-ink">Billing arrangement</h2>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Subject type</span>
                <select
                  value={billingForm.subjectType}
                  onChange={(e) =>
                    setBillingForm((p) => ({
                      ...p,
                      subjectType: e.target.value as PriceSubjectType,
                    }))
                  }
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                >
                  <option value={PRICE_SUBJECT_TYPES.USER}>User</option>
                  <option value={PRICE_SUBJECT_TYPES.ORGANIZATION}>Organization</option>
                </select>
              </label>
              <TextField
                label="Subject ID"
                name="billingSubjectId"
                value={billingForm.subjectId}
                onChange={(e) => setBillingForm((p) => ({ ...p, subjectId: e.target.value }))}
                required
              />
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Arrangement</span>
                <select
                  value={billingForm.billingArrangement}
                  onChange={(e) =>
                    setBillingForm((p) => ({ ...p, billingArrangement: e.target.value }))
                  }
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                >
                  <option value="">None (pay before create)</option>
                  {ALL_BILLING_ARRANGEMENTS.map((value) => (
                    <option key={value} value={value}>
                      {BILLING_ARRANGEMENT_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <AuthButton loading={saving}>Save arrangement</AuthButton>
            </form>
          ) : null}

          {canPrepaid ? (
            <form onSubmit={doCredit} className="space-y-3 rounded-xl border border-line bg-white p-4">
              <h2 className="text-sm font-semibold text-ink">Credit prepaid cases</h2>
              <p className="text-xs text-muted">
                Uses the subject fields from Billing arrangement.
              </p>
              <TextField
                label="Cases to credit"
                name="creditCases"
                type="number"
                value={billingForm.creditCases}
                onChange={(e) => setBillingForm((p) => ({ ...p, creditCases: e.target.value }))}
                required
              />
              <TextField
                label="Reason"
                name="reason"
                value={billingForm.reason}
                onChange={(e) => setBillingForm((p) => ({ ...p, reason: e.target.value }))}
              />
              <AuthButton loading={saving}>Credit balance</AuthButton>
              {ledger.length > 0 ? (
                <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-xs text-muted">
                  {ledger.map((entry) => (
                    <li key={entry.id}>
                      {entry.kind} {entry.deltaCases} → bal {entry.balanceAfter} · {entry.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}

      {tab === 'providers' && canProviders ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <form
            onSubmit={saveProvider}
            className="space-y-3 rounded-xl border border-line bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-ink">Payment provider</h2>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Provider</span>
              <select
                value={providerForm.provider}
                onChange={(e) => setProviderForm((p) => ({ ...p, provider: e.target.value }))}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
              >
                {ALL_PAYMENT_PROVIDERS.map((value) => (
                  <option key={value} value={value}>
                    {PAYMENT_PROVIDER_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Label"
              name="label"
              value={providerForm.label}
              onChange={(e) => setProviderForm((p) => ({ ...p, label: e.target.value }))}
              required
            />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Instructions</span>
              <textarea
                value={providerForm.instructions}
                onChange={(e) =>
                  setProviderForm((p) => ({ ...p, instructions: e.target.value }))
                }
                rows={4}
                className="w-full rounded-xl border border-line px-3.5 py-3 text-[15px]"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={providerForm.enabled}
                onChange={(e) => setProviderForm((p) => ({ ...p, enabled: e.target.checked }))}
              />
              Enabled
            </label>
            <AuthButton loading={saving}>Save provider</AuthButton>
          </form>
          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {providers.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{row.label}</p>
                      <p className="text-xs text-muted">{row.provider}</p>
                    </td>
                    <td className="px-4 py-3">{row.enabled ? 'Enabled' : 'Disabled'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="font-medium text-brand-600"
                        onClick={() =>
                          setProviderForm({
                            id: row.id,
                            provider: row.provider,
                            label: row.label,
                            enabled: row.enabled,
                            instructions: row.instructions,
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

      {tab === 'invoices' && canInvoices ? (
        <section className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Invoices</h2>
              <p className="mt-0.5 text-sm text-muted">
                Weekly / bi-monthly / monthly / quarterly arrangements are billed in a batch. Prepaid
                and Stripe checkout invoices appear here as they are paid.
              </p>
            </div>
            {canManageInvoices ? (
              <div className="w-full max-w-xs shrink-0 sm:w-auto">
              <AuthButton
                type="button"
                loading={batching}
                onClick={() => {
                  void (async () => {
                    setBatching(true);
                    try {
                      const result = await generateBatchInvoices();
                      toast().success(result.message);
                      await load();
                    } catch (err) {
                      toast().error(getErrorMessage(err, 'Unable to generate invoices'));
                    } finally {
                      setBatching(false);
                    }
                  })();
                }}
              >
                Generate scheduled invoices
              </AuthButton>
              </div>
            ) : null}
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Cases</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3 font-mono">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <p>{inv.customerName}</p>
                    <p className="text-xs text-muted">{inv.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {(inv.caseIds ?? []).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {inv.currency} {inv.total.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">{inv.status}</td>
                  <td className="px-4 py-3 text-right">
                    <a
                      className="font-medium text-brand-600"
                      href={`/api/commercial/invoices/${inv.id}/html`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Print HTML
                    </a>
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
