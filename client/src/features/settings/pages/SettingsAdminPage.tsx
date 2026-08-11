import {
  ALL_MASTER_LIST_TYPES,
  BRANDING_LOGO_SLOTS,
  COUNTRY_REQUEST_STATUSES,
  DEFAULT_CASE_SUBMISSION_TABS,
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_REPORT_VISIBILITY,
  DEFAULT_REQUIRED_FIELDS,
  MASTER_LIST_TYPES,
  MASTER_LIST_TYPE_LABELS,
  PERMISSIONS,
  type BrandingConfigDto,
  type BusinessConfigDto,
  type CountryDto,
  type CountryRequestDto,
  type EmailTemplateDto,
  type MasterListItemDto,
  type MasterListType,
  type PrivacyPolicyDto,
  type RegionDto,
  type SystemMessages,
} from '@ayetis/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import { toast } from '@/features/notifications/toastStore';
import {
  fetchBranding,
  fetchBusinessConfig,
  fetchCountries,
  fetchCountryRequests,
  fetchCurrentPrivacy,
  fetchEmailTemplates,
  fetchMasterListItems,
  fetchPrivacyHistory,
  fetchRegions,
  fetchSystemMessages,
  patchBusinessConfig,
  publishPrivacyPolicy,
  reviewCountryRequest,
  updateBranding,
  updateCustomerScope,
  updateSystemMessages,
  uploadBrandingLogo,
  upsertCountry,
  upsertEmailTemplate,
  upsertMasterListItem,
  upsertRegion,
} from '@/features/settings/api';
import { getErrorMessage } from '@/lib/api';

type Tab =
  | 'master'
  | 'regions'
  | 'branding'
  | 'business'
  | 'messages'
  | 'email'
  | 'privacy'
  | 'scope';

const LOGO_SLOT_LABELS: Record<(typeof BRANDING_LOGO_SLOTS)[keyof typeof BRANDING_LOGO_SLOTS], string> = {
  [BRANDING_LOGO_SLOTS.LOGIN]: 'Login',
  [BRANDING_LOGO_SLOTS.HEADER]: 'Header',
  [BRANDING_LOGO_SLOTS.FOOTER]: 'Footer',
  [BRANDING_LOGO_SLOTS.EMAIL]: 'Email',
};

const EMPTY_MASTER_ITEM = {
  id: '',
  label: '',
  code: '',
  sortOrder: '0',
  parentId: '',
  isActive: true,
};

const EMPTY_REGION = {
  id: '',
  code: '',
  name: '',
  isActive: true,
};

const EMPTY_COUNTRY = {
  id: '',
  code: '',
  name: '',
  dialCode: '',
  regionId: '',
  isActive: true,
};

const EMPTY_EMAIL_TEMPLATE = {
  key: '',
  name: '',
  subject: '',
  htmlBody: '',
  placeholders: '',
};

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function mergeToggleKeys(
  defaults: Record<string, boolean>,
  current: Record<string, boolean> | undefined,
): Record<string, boolean> {
  return { ...defaults, ...current };
}

export function SettingsAdminPage() {
  const { can } = usePermissions();
  const canMaster = can(PERMISSIONS.MASTER_DATA_MANAGE);
  const canRegions = can(PERMISSIONS.REGION_MANAGE);
  const canBranding = can(PERMISSIONS.BRANDING_MANAGE);
  const canBusiness = can(PERMISSIONS.SETTINGS_MANAGE);
  const canMessages = can(PERMISSIONS.SETTINGS_MANAGE) || can(PERMISSIONS.REGISTRATION_APPROVE);
  const canEmail = can(PERMISSIONS.EMAIL_TEMPLATE_MANAGE);
  const canPrivacy = can(PERMISSIONS.PRIVACY_MANAGE);
  const canScope = can(PERMISSIONS.SETTINGS_MANAGE);

  const firstTab: Tab = canMaster
    ? 'master'
    : canRegions
      ? 'regions'
      : canBranding
        ? 'branding'
        : canBusiness
          ? 'business'
          : canMessages
            ? 'messages'
            : canEmail
              ? 'email'
              : canPrivacy
                ? 'privacy'
                : 'scope';

  const [tab, setTab] = useState<Tab>(firstTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [listType, setListType] = useState<MasterListType>(MASTER_LIST_TYPES.LANGUAGE);
  const [masterItems, setMasterItems] = useState<MasterListItemDto[]>([]);
  const [professions, setProfessions] = useState<MasterListItemDto[]>([]);
  const [masterForm, setMasterForm] = useState({ ...EMPTY_MASTER_ITEM });

  const [regions, setRegions] = useState<RegionDto[]>([]);
  const [countries, setCountries] = useState<CountryDto[]>([]);
  const [countryRequests, setCountryRequests] = useState<CountryRequestDto[]>([]);
  const [regionForm, setRegionForm] = useState({ ...EMPTY_REGION });
  const [countryForm, setCountryForm] = useState({ ...EMPTY_COUNTRY });
  const [reviewForms, setReviewForms] = useState<
    Record<string, { regionId: string; dialCode: string; reviewNotes: string }>
  >({});

  const [branding, setBranding] = useState<BrandingConfigDto | null>(null);
  const [brandingForm, setBrandingForm] = useState({ companyName: '', notificationEmails: '' });
  const [logoFiles, setLogoFiles] = useState<Record<string, File | null>>({});

  const [businessConfig, setBusinessConfig] = useState<BusinessConfigDto | null>(null);
  const [businessForm, setBusinessForm] = useState({
    maxUploadMb: String(DEFAULT_MAX_UPLOAD_BYTES / (1024 * 1024)),
    requiredFields: { ...DEFAULT_REQUIRED_FIELDS },
    caseSubmissionTabs: { ...DEFAULT_CASE_SUBMISSION_TABS },
    reportVisibility: { ...DEFAULT_REPORT_VISIBILITY },
  });

  const [messages, setMessages] = useState<SystemMessages | null>(null);

  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateDto[]>([]);
  const [emailForm, setEmailForm] = useState({ ...EMPTY_EMAIL_TEMPLATE });

  const [currentPrivacy, setCurrentPrivacy] = useState<PrivacyPolicyDto | null>(null);
  const [privacyHistory, setPrivacyHistory] = useState<PrivacyPolicyDto[]>([]);
  const [privacyForm, setPrivacyForm] = useState({ version: '', bodyHtml: '' });

  const [scopeForm, setScopeForm] = useState({
    subjectType: 'user' as 'user' | 'organization',
    subjectId: '',
    preferredCurrency: '',
    regionIds: '',
    scopedCountryIds: '',
    excludedCountryIds: '',
  });

  async function loadMasterItems(type: MasterListType) {
    const items = await fetchMasterListItems(type, false);
    setMasterItems(items);
    if (type === MASTER_LIST_TYPES.PROFESSION_SPECIALIZATION) {
      setProfessions(await fetchMasterListItems(MASTER_LIST_TYPES.PROFESSION, true));
    }
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const tasks: Promise<void>[] = [];

      if (canMaster) {
        tasks.push(loadMasterItems(listType));
      }
      if (canRegions) {
        tasks.push(
          (async () => {
            const [regionList, countryList, requests] = await Promise.all([
              fetchRegions(),
              fetchCountries(false),
              fetchCountryRequests(COUNTRY_REQUEST_STATUSES.PENDING),
            ]);
            setRegions(regionList);
            setCountries(countryList);
            setCountryRequests(requests);
            setReviewForms(
              Object.fromEntries(
                requests.map((req) => [
                  req.id,
                  { regionId: req.regionId ?? '', dialCode: '', reviewNotes: '' },
                ]),
              ),
            );
          })(),
        );
      }
      if (canBranding) {
        tasks.push(
          (async () => {
            const data = await fetchBranding();
            setBranding(data);
            setBrandingForm({
              companyName: data.companyName,
              notificationEmails: data.notificationEmails.join(', '),
            });
          })(),
        );
      }
      if (canBusiness) {
        tasks.push(
          (async () => {
            const data = await fetchBusinessConfig();
            setBusinessConfig(data);
            setBusinessForm({
              maxUploadMb: String(Math.round(data.maxUploadBytes / (1024 * 1024))),
              requiredFields: mergeToggleKeys(DEFAULT_REQUIRED_FIELDS, data.requiredFields),
              caseSubmissionTabs: mergeToggleKeys(
                DEFAULT_CASE_SUBMISSION_TABS,
                data.caseSubmissionTabs,
              ),
              reportVisibility: mergeToggleKeys(DEFAULT_REPORT_VISIBILITY, data.reportVisibility),
            });
          })(),
        );
      }
      if (canMessages) {
        tasks.push(
          (async () => {
            setMessages(await fetchSystemMessages());
          })(),
        );
      }
      if (canEmail) {
        tasks.push(
          (async () => {
            setEmailTemplates(await fetchEmailTemplates());
          })(),
        );
      }
      if (canPrivacy) {
        tasks.push(
          (async () => {
            const [current, history] = await Promise.all([
              fetchCurrentPrivacy(),
              fetchPrivacyHistory(),
            ]);
            setCurrentPrivacy(current);
            setPrivacyHistory(history);
          })(),
        );
      }

      await Promise.all(tasks);
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to load settings');
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

  useEffect(() => {
    if (!canMaster) return;
    void loadMasterItems(listType).catch((err) => {
      toast().error(getErrorMessage(err, 'Unable to load master list'));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listType]);

  async function saveMasterItem(event: FormEvent) {
    event.preventDefault();
    if (!canMaster) return;
    setSaving(true);
    try {
      await upsertMasterListItem({
        id: masterForm.id || undefined,
        type: listType,
        label: masterForm.label.trim(),
        code: masterForm.code.trim() || null,
        sortOrder: Number(masterForm.sortOrder) || 0,
        parentId:
          listType === MASTER_LIST_TYPES.PROFESSION_SPECIALIZATION
            ? masterForm.parentId || null
            : null,
        isActive: masterForm.isActive,
      });
      toast().success(masterForm.id ? 'Item updated' : 'Item created');
      setMasterForm({ ...EMPTY_MASTER_ITEM });
      await loadMasterItems(listType);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save item'));
    } finally {
      setSaving(false);
    }
  }

  async function saveRegion(event: FormEvent) {
    event.preventDefault();
    if (!canRegions) return;
    setSaving(true);
    try {
      await upsertRegion({
        id: regionForm.id || undefined,
        code: regionForm.code.trim().toUpperCase(),
        name: regionForm.name.trim(),
        isActive: regionForm.isActive,
      });
      toast().success(regionForm.id ? 'Region updated' : 'Region created');
      setRegionForm({ ...EMPTY_REGION });
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save region'));
    } finally {
      setSaving(false);
    }
  }

  async function saveCountry(event: FormEvent) {
    event.preventDefault();
    if (!canRegions) return;
    setSaving(true);
    try {
      await upsertCountry({
        id: countryForm.id || undefined,
        code: countryForm.code.trim(),
        name: countryForm.name.trim(),
        dialCode: countryForm.dialCode.trim() || null,
        regionId: countryForm.regionId || null,
        isActive: countryForm.isActive,
      });
      toast().success(countryForm.id ? 'Country updated' : 'Country created');
      setCountryForm({ ...EMPTY_COUNTRY });
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save country'));
    } finally {
      setSaving(false);
    }
  }

  async function handleReviewRequest(id: string, status: 'approved' | 'rejected') {
    if (!canRegions) return;
    const form = reviewForms[id] ?? { regionId: '', dialCode: '', reviewNotes: '' };
    setSaving(true);
    try {
      await reviewCountryRequest(id, {
        status,
        regionId: form.regionId || null,
        dialCode: form.dialCode.trim() || null,
        reviewNotes: form.reviewNotes.trim() || undefined,
      });
      toast().success(status === 'approved' ? 'Country request approved' : 'Country request rejected');
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to review request'));
    } finally {
      setSaving(false);
    }
  }

  async function saveBranding(event: FormEvent) {
    event.preventDefault();
    if (!canBranding) return;
    setSaving(true);
    try {
      const updated = await updateBranding({
        companyName: brandingForm.companyName.trim(),
        notificationEmails: parseCsv(brandingForm.notificationEmails),
      });
      setBranding(updated);
      toast().success('Branding updated');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update branding'));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(slot: (typeof BRANDING_LOGO_SLOTS)[keyof typeof BRANDING_LOGO_SLOTS]) {
    const file = logoFiles[slot];
    if (!file || !canBranding) return;
    setSaving(true);
    try {
      const updated = await uploadBrandingLogo(slot, file);
      setBranding(updated);
      setLogoFiles((prev) => ({ ...prev, [slot]: null }));
      toast().success(`${LOGO_SLOT_LABELS[slot]} logo uploaded`);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to upload logo'));
    } finally {
      setSaving(false);
    }
  }

  async function saveBusinessConfig(event: FormEvent) {
    event.preventDefault();
    if (!canBusiness) return;
    setSaving(true);
    try {
      const updated = await patchBusinessConfig({
        maxUploadBytes: Math.round(Number(businessForm.maxUploadMb) * 1024 * 1024),
        requiredFields: businessForm.requiredFields,
        caseSubmissionTabs: businessForm.caseSubmissionTabs,
        reportVisibility: businessForm.reportVisibility,
      });
      setBusinessConfig(updated);
      toast().success('Business configuration updated');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update business config'));
    } finally {
      setSaving(false);
    }
  }

  async function saveMessages(event: FormEvent) {
    event.preventDefault();
    if (!canMessages || !messages) return;
    setSaving(true);
    try {
      setMessages(await updateSystemMessages(messages));
      toast().success('System messages updated');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update messages'));
    } finally {
      setSaving(false);
    }
  }

  async function saveEmailTemplate(event: FormEvent) {
    event.preventDefault();
    if (!canEmail) return;
    setSaving(true);
    try {
      await upsertEmailTemplate({
        key: emailForm.key.trim(),
        name: emailForm.name.trim(),
        subject: emailForm.subject.trim(),
        htmlBody: emailForm.htmlBody,
        placeholders: parseCsv(emailForm.placeholders),
      });
      toast().success('Email template saved');
      setEmailForm({ ...EMPTY_EMAIL_TEMPLATE });
      setEmailTemplates(await fetchEmailTemplates());
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to save email template'));
    } finally {
      setSaving(false);
    }
  }

  async function savePrivacy(event: FormEvent) {
    event.preventDefault();
    if (!canPrivacy) return;
    setSaving(true);
    try {
      const published = await publishPrivacyPolicy({
        version: privacyForm.version.trim(),
        bodyHtml: privacyForm.bodyHtml,
      });
      setCurrentPrivacy(published);
      setPrivacyHistory(await fetchPrivacyHistory());
      setPrivacyForm({ version: '', bodyHtml: '' });
      toast().success('Privacy policy published');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to publish privacy policy'));
    } finally {
      setSaving(false);
    }
  }

  async function saveCustomerScope(event: FormEvent) {
    event.preventDefault();
    if (!canScope) return;
    setSaving(true);
    try {
      await updateCustomerScope({
        subjectType: scopeForm.subjectType,
        subjectId: scopeForm.subjectId.trim(),
        preferredCurrency: scopeForm.preferredCurrency.trim() || undefined,
        regionIds: parseCsv(scopeForm.regionIds),
        scopedCountryIds: parseCsv(scopeForm.scopedCountryIds),
        excludedCountryIds: parseCsv(scopeForm.excludedCountryIds),
      });
      toast().success('Customer scope updated');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to update customer scope'));
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: 'master', label: 'Master data', show: canMaster },
    { id: 'regions', label: 'Regions & countries', show: canRegions },
    { id: 'branding', label: 'Branding', show: canBranding },
    { id: 'business', label: 'Business config', show: canBusiness },
    { id: 'messages', label: 'System messages', show: canMessages },
    { id: 'email', label: 'Email templates', show: canEmail },
    { id: 'privacy', label: 'Privacy policy', show: canPrivacy },
    { id: 'scope', label: 'Customer scope', show: canScope },
  ];

  function renderToggleGroup(
    title: string,
    values: Record<string, boolean>,
    onChange: (key: string, checked: boolean) => void,
  ) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(values).map(([key, checked]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={checked} onChange={(e) => onChange(key, e.target.checked)} />
              {key}
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        subtitle="Master data, regions, branding, business rules, messages, templates, and customer scope."
      />

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

      {tab === 'master' && canMaster ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">List type</span>
              <select
                value={listType}
                onChange={(e) => {
                  setListType(e.target.value as MasterListType);
                  setMasterForm({ ...EMPTY_MASTER_ITEM });
                }}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
              >
                {ALL_MASTER_LIST_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {MASTER_LIST_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>

            <form onSubmit={saveMasterItem} className="space-y-3 rounded-xl border border-line bg-white p-4">
              <h2 className="text-sm font-semibold text-ink">
                {masterForm.id ? 'Edit item' : 'New item'}
              </h2>
              <TextField
                label="Label"
                name="label"
                value={masterForm.label}
                onChange={(e) => setMasterForm((p) => ({ ...p, label: e.target.value }))}
                required
              />
              <TextField
                label="Code (optional)"
                name="code"
                value={masterForm.code}
                onChange={(e) => setMasterForm((p) => ({ ...p, code: e.target.value }))}
              />
              <TextField
                label="Sort order"
                name="sortOrder"
                type="number"
                value={masterForm.sortOrder}
                onChange={(e) => setMasterForm((p) => ({ ...p, sortOrder: e.target.value }))}
              />
              {listType === MASTER_LIST_TYPES.PROFESSION_SPECIALIZATION ? (
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink">Parent profession</span>
                  <select
                    value={masterForm.parentId}
                    onChange={(e) => setMasterForm((p) => ({ ...p, parentId: e.target.value }))}
                    className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                  >
                    <option value="">Select…</option>
                    {professions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={masterForm.isActive}
                  onChange={(e) => setMasterForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                Active
              </label>
              <AuthButton loading={saving}>{masterForm.id ? 'Update' : 'Create'}</AuthButton>
            </form>
          </div>

          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Label</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {masterItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-ink">{item.label}</td>
                    <td className="px-4 py-3 text-muted">{item.code ?? '—'}</td>
                    <td className="px-4 py-3">{item.sortOrder}</td>
                    <td className="px-4 py-3">{item.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="font-medium text-brand-600"
                        onClick={() =>
                          setMasterForm({
                            id: item.id,
                            label: item.label,
                            code: item.code ?? '',
                            sortOrder: String(item.sortOrder),
                            parentId: item.parentId ?? '',
                            isActive: item.isActive,
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

      {tab === 'regions' && canRegions ? (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <form onSubmit={saveRegion} className="space-y-3 rounded-xl border border-line bg-white p-4">
              <h2 className="text-sm font-semibold text-ink">
                {regionForm.id ? 'Edit region' : 'New region'}
              </h2>
              <TextField
                label="Code"
                name="regionCode"
                value={regionForm.code}
                onChange={(e) => setRegionForm((p) => ({ ...p, code: e.target.value }))}
                required
              />
              <TextField
                label="Name"
                name="regionName"
                value={regionForm.name}
                onChange={(e) => setRegionForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={regionForm.isActive}
                  onChange={(e) => setRegionForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                Active
              </label>
              <AuthButton loading={saving}>{regionForm.id ? 'Update' : 'Create'}</AuthButton>
            </form>

            <form onSubmit={saveCountry} className="space-y-3 rounded-xl border border-line bg-white p-4">
              <h2 className="text-sm font-semibold text-ink">
                {countryForm.id ? 'Edit country' : 'New country'}
              </h2>
              <TextField
                label="Code"
                name="countryCode"
                value={countryForm.code}
                onChange={(e) => setCountryForm((p) => ({ ...p, code: e.target.value }))}
                required
              />
              <TextField
                label="Name"
                name="countryName"
                value={countryForm.name}
                onChange={(e) => setCountryForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
              <TextField
                label="Dial code"
                name="dialCode"
                value={countryForm.dialCode}
                onChange={(e) => setCountryForm((p) => ({ ...p, dialCode: e.target.value }))}
              />
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Region</span>
                <select
                  value={countryForm.regionId}
                  onChange={(e) => setCountryForm((p) => ({ ...p, regionId: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                >
                  <option value="">None</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.code} — {region.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={countryForm.isActive}
                  onChange={(e) => setCountryForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                Active
              </label>
              <AuthButton loading={saving}>{countryForm.id ? 'Update' : 'Create'}</AuthButton>
            </form>
          </div>

          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Regions</h2>
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Region</th>
                  <th className="px-4 py-3 font-medium">Countries</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {regions.map((region) => (
                  <tr key={region.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{region.name}</p>
                      <p className="text-xs text-muted">{region.code}</p>
                    </td>
                    <td className="px-4 py-3">{region.countryCount}</td>
                    <td className="px-4 py-3">{region.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="font-medium text-brand-600"
                        onClick={() =>
                          setRegionForm({
                            id: region.id,
                            code: region.code,
                            name: region.name,
                            isActive: region.isActive,
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

          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Countries</h2>
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium">Region</th>
                  <th className="px-4 py-3 font-medium">Dial</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {countries.map((country) => (
                  <tr key={country.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{country.name}</p>
                      <p className="text-xs text-muted">
                        {country.code}
                        {country.isOther ? ' · Other' : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {country.regionName ?? country.regionCode ?? '—'}
                    </td>
                    <td className="px-4 py-3">{country.dialCode ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="font-medium text-brand-600"
                        onClick={() =>
                          setCountryForm({
                            id: country.id,
                            code: country.code,
                            name: country.name,
                            dialCode: country.dialCode ?? '',
                            regionId: country.regionId ?? '',
                            isActive: country.isActive,
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

          {countryRequests.length > 0 ? (
            <section className="overflow-hidden rounded-xl border border-line bg-white">
              <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
                Pending country requests
              </h2>
              <div className="divide-y divide-line">
                {countryRequests.map((req) => {
                  const form = reviewForms[req.id] ?? {
                    regionId: '',
                    dialCode: '',
                    reviewNotes: '',
                  };
                  return (
                    <div key={req.id} className="space-y-3 p-4">
                      <div>
                        <p className="font-medium text-ink">{req.proposedName}</p>
                        <p className="text-xs text-muted">
                          {req.requesterEmail ?? 'Unknown requester'}
                          {req.registrationId ? ` · reg ${req.registrationId}` : ''}
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="block space-y-1.5">
                          <span className="text-sm font-medium text-ink">Region</span>
                          <select
                            value={form.regionId}
                            onChange={(e) =>
                              setReviewForms((prev) => ({
                                ...prev,
                                [req.id]: { ...form, regionId: e.target.value },
                              }))
                            }
                            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
                          >
                            <option value="">Select…</option>
                            {regions.map((region) => (
                              <option key={region.id} value={region.id}>
                                {region.code} — {region.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <TextField
                          label="Dial code"
                          name={`dial-${req.id}`}
                          value={form.dialCode}
                          onChange={(e) =>
                            setReviewForms((prev) => ({
                              ...prev,
                              [req.id]: { ...form, dialCode: e.target.value },
                            }))
                          }
                        />
                        <TextField
                          label="Review notes"
                          name={`notes-${req.id}`}
                          value={form.reviewNotes}
                          onChange={(e) =>
                            setReviewForms((prev) => ({
                              ...prev,
                              [req.id]: { ...form, reviewNotes: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleReviewRequest(req.id, 'approved')}
                          className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleReviewRequest(req.id, 'rejected')}
                          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === 'branding' && canBranding && branding ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <form onSubmit={saveBranding} className="space-y-3 rounded-xl border border-line bg-white p-4">
            <h2 className="text-sm font-semibold text-ink">Branding</h2>
            <TextField
              label="Company name"
              name="companyName"
              value={brandingForm.companyName}
              onChange={(e) => setBrandingForm((p) => ({ ...p, companyName: e.target.value }))}
              required
            />
            <TextField
              label="Notification emails (comma-separated)"
              name="notificationEmails"
              value={brandingForm.notificationEmails}
              onChange={(e) =>
                setBrandingForm((p) => ({ ...p, notificationEmails: e.target.value }))
              }
            />
            <AuthButton loading={saving}>Save branding</AuthButton>
          </form>

          <section className="space-y-3 rounded-xl border border-line bg-white p-4">
            <h2 className="text-sm font-semibold text-ink">Logos</h2>
            {(Object.values(BRANDING_LOGO_SLOTS) as Array<(typeof BRANDING_LOGO_SLOTS)[keyof typeof BRANDING_LOGO_SLOTS]>).map(
              (slot) => {
                const urlKey =
                  slot === BRANDING_LOGO_SLOTS.LOGIN
                    ? 'loginLogoUrl'
                    : slot === BRANDING_LOGO_SLOTS.HEADER
                      ? 'headerLogoUrl'
                      : slot === BRANDING_LOGO_SLOTS.FOOTER
                        ? 'footerLogoUrl'
                        : 'emailLogoUrl';
                const url = branding[urlKey];
                return (
                  <div key={slot} className="space-y-2 border-b border-line pb-3 last:border-0">
                    <p className="text-sm font-medium text-ink">{LOGO_SLOT_LABELS[slot]}</p>
                    {url ? (
                      <img src={url} alt={`${slot} logo`} className="max-h-16 object-contain" />
                    ) : (
                      <p className="text-xs text-muted">No logo uploaded</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          setLogoFiles((prev) => ({
                            ...prev,
                            [slot]: e.target.files?.[0] ?? null,
                          }))
                        }
                      />
                      <button
                        type="button"
                        disabled={saving || !logoFiles[slot]}
                        onClick={() => void handleLogoUpload(slot)}
                        className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                      >
                        Upload
                      </button>
                    </div>
                  </div>
                );
              },
            )}
          </section>
        </div>
      ) : null}

      {tab === 'business' && canBusiness ? (
        <form
          onSubmit={saveBusinessConfig}
          className="max-w-2xl space-y-4 rounded-xl border border-line bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-ink">Business configuration</h2>
          {businessConfig?.updatedAt ? (
            <p className="text-xs text-muted">
              Last updated {new Date(businessConfig.updatedAt).toLocaleString()}
            </p>
          ) : null}
          <TextField
            label="Max upload size (MB)"
            name="maxUploadMb"
            type="number"
            value={businessForm.maxUploadMb}
            onChange={(e) => setBusinessForm((p) => ({ ...p, maxUploadMb: e.target.value }))}
            required
          />
          {renderToggleGroup('Required fields', businessForm.requiredFields, (key, checked) =>
            setBusinessForm((p) => ({
              ...p,
              requiredFields: { ...p.requiredFields, [key]: checked },
            })),
          )}
          {renderToggleGroup(
            'Case submission tabs',
            businessForm.caseSubmissionTabs,
            (key, checked) =>
              setBusinessForm((p) => ({
                ...p,
                caseSubmissionTabs: { ...p.caseSubmissionTabs, [key]: checked },
              })),
          )}
          {renderToggleGroup('Report visibility', businessForm.reportVisibility, (key, checked) =>
            setBusinessForm((p) => ({
              ...p,
              reportVisibility: { ...p.reportVisibility, [key]: checked },
            })),
          )}
          <AuthButton loading={saving}>Save configuration</AuthButton>
        </form>
      ) : null}

      {tab === 'messages' && canMessages && messages ? (
        <form
          onSubmit={saveMessages}
          className="max-w-2xl space-y-3 rounded-xl border border-line bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-ink">System messages</h2>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Registration confirmation</span>
            <textarea
              value={messages.registrationConfirmation}
              onChange={(e) =>
                setMessages((p) => (p ? { ...p, registrationConfirmation: e.target.value } : p))
              }
              rows={3}
              className="w-full rounded-xl border border-line px-3.5 py-3 text-[15px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Email verified — pending review</span>
            <textarea
              value={messages.emailVerifiedPending}
              onChange={(e) =>
                setMessages((p) => (p ? { ...p, emailVerifiedPending: e.target.value } : p))
              }
              rows={3}
              className="w-full rounded-xl border border-line px-3.5 py-3 text-[15px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Account blocked</span>
            <textarea
              value={messages.accountBlocked}
              onChange={(e) =>
                setMessages((p) => (p ? { ...p, accountBlocked: e.target.value } : p))
              }
              rows={3}
              className="w-full rounded-xl border border-line px-3.5 py-3 text-[15px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Account suspended</span>
            <textarea
              value={messages.accountSuspended}
              onChange={(e) =>
                setMessages((p) => (p ? { ...p, accountSuspended: e.target.value } : p))
              }
              rows={3}
              className="w-full rounded-xl border border-line px-3.5 py-3 text-[15px]"
            />
          </label>
          <AuthButton loading={saving}>Save messages</AuthButton>
        </form>
      ) : null}

      {tab === 'email' && canEmail ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <form
            onSubmit={saveEmailTemplate}
            className="space-y-3 rounded-xl border border-line bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-ink">Email template</h2>
            <TextField
              label="Key"
              name="key"
              value={emailForm.key}
              onChange={(e) => setEmailForm((p) => ({ ...p, key: e.target.value }))}
              required
            />
            <TextField
              label="Name"
              name="name"
              value={emailForm.name}
              onChange={(e) => setEmailForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <TextField
              label="Subject"
              name="subject"
              value={emailForm.subject}
              onChange={(e) => setEmailForm((p) => ({ ...p, subject: e.target.value }))}
              required
            />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">HTML body</span>
              <textarea
                value={emailForm.htmlBody}
                onChange={(e) => setEmailForm((p) => ({ ...p, htmlBody: e.target.value }))}
                rows={8}
                className="w-full rounded-xl border border-line px-3.5 py-3 font-mono text-sm"
                required
              />
            </label>
            <TextField
              label="Placeholders (comma-separated)"
              name="placeholders"
              value={emailForm.placeholders}
              onChange={(e) => setEmailForm((p) => ({ ...p, placeholders: e.target.value }))}
            />
            <AuthButton loading={saving}>Save template</AuthButton>
          </form>

          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Template</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {emailTemplates.map((template) => (
                  <tr key={template.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{template.name}</p>
                      <p className="text-xs text-muted">{template.key}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{template.subject}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="font-medium text-brand-600"
                        onClick={() =>
                          setEmailForm({
                            key: template.key,
                            name: template.name,
                            subject: template.subject,
                            htmlBody: template.htmlBody,
                            placeholders: template.placeholders.join(', '),
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

      {tab === 'privacy' && canPrivacy ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="space-y-3 rounded-xl border border-line bg-white p-4">
            <h2 className="text-sm font-semibold text-ink">Current privacy policy</h2>
            {currentPrivacy ? (
              <>
                <p className="text-sm text-ink">
                  Version <span className="font-medium">{currentPrivacy.version}</span>
                </p>
                <p className="text-xs text-muted">
                  Published {new Date(currentPrivacy.publishedAt).toLocaleString()}
                  {currentPrivacy.publishedByEmail
                    ? ` by ${currentPrivacy.publishedByEmail}`
                    : ''}
                </p>
                <div
                  className="prose prose-sm max-w-none rounded-lg border border-line bg-surface p-3 text-sm"
                  dangerouslySetInnerHTML={{ __html: currentPrivacy.bodyHtml }}
                />
              </>
            ) : (
              <p className="text-sm text-muted">No privacy policy published yet.</p>
            )}
            {privacyHistory.length > 0 ? (
              <div className="space-y-1 border-t border-line pt-3 text-xs text-muted">
                <p className="font-medium text-ink">History</p>
                {privacyHistory.map((entry) => (
                  <p key={entry.id}>
                    v{entry.version} · {new Date(entry.publishedAt).toLocaleDateString()}
                    {entry.isCurrent ? ' (current)' : ''}
                  </p>
                ))}
              </div>
            ) : null}
          </section>

          <form onSubmit={savePrivacy} className="space-y-3 rounded-xl border border-line bg-white p-4">
            <h2 className="text-sm font-semibold text-ink">Publish new version</h2>
            <TextField
              label="Version"
              name="version"
              value={privacyForm.version}
              onChange={(e) => setPrivacyForm((p) => ({ ...p, version: e.target.value }))}
              required
            />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Body HTML</span>
              <textarea
                value={privacyForm.bodyHtml}
                onChange={(e) => setPrivacyForm((p) => ({ ...p, bodyHtml: e.target.value }))}
                rows={12}
                className="w-full rounded-xl border border-line px-3.5 py-3 font-mono text-sm"
                required
              />
            </label>
            <AuthButton loading={saving}>Publish</AuthButton>
          </form>
        </div>
      ) : null}

      {tab === 'scope' && canScope ? (
        <form
          onSubmit={saveCustomerScope}
          className="max-w-xl space-y-3 rounded-xl border border-line bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-ink">Customer scope</h2>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Subject type</span>
            <select
              value={scopeForm.subjectType}
              onChange={(e) =>
                setScopeForm((p) => ({
                  ...p,
                  subjectType: e.target.value as 'user' | 'organization',
                }))
              }
              className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]"
            >
              <option value="user">User</option>
              <option value="organization">Organization</option>
            </select>
          </label>
          <TextField
            label="Subject ID"
            name="subjectId"
            value={scopeForm.subjectId}
            onChange={(e) => setScopeForm((p) => ({ ...p, subjectId: e.target.value }))}
            required
          />
          <TextField
            label="Preferred currency"
            name="preferredCurrency"
            value={scopeForm.preferredCurrency}
            onChange={(e) => setScopeForm((p) => ({ ...p, preferredCurrency: e.target.value }))}
          />
          <TextField
            label="Region IDs (comma-separated)"
            name="regionIds"
            value={scopeForm.regionIds}
            onChange={(e) => setScopeForm((p) => ({ ...p, regionIds: e.target.value }))}
          />
          <TextField
            label="Scoped country IDs (comma-separated)"
            name="scopedCountryIds"
            value={scopeForm.scopedCountryIds}
            onChange={(e) => setScopeForm((p) => ({ ...p, scopedCountryIds: e.target.value }))}
          />
          <TextField
            label="Excluded country IDs (comma-separated)"
            name="excludedCountryIds"
            value={scopeForm.excludedCountryIds}
            onChange={(e) => setScopeForm((p) => ({ ...p, excludedCountryIds: e.target.value }))}
          />
          <AuthButton loading={saving}>Save scope</AuthButton>
        </form>
      ) : null}
    </div>
  );
}
