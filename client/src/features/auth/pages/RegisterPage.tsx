import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  MASTER_LIST_TYPES,
  PASSWORD_POLICY_DESCRIPTION,
  PASSWORD_VALIDATION_FAILED,
  validatePasswordComplexity,
  type AccountType,
  type CountryDto,
  type MasterListItemDto,
  type PrivacyPolicyDto,
} from '@ayetis/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SearchableSelect } from '@/components/SearchableSelect';
import * as authApi from '@/features/auth/api';
import { Alert, AuthButton, AuthCard, TextField } from '@/features/auth/components/AuthUI';
import {
  fetchCountries,
  fetchCurrentPrivacy,
  fetchMasterListItems,
} from '@/features/settings/api';
import { getErrorMessage, getFieldError } from '@/lib/api';

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const accountType: AccountType =
    searchParams.get('type') === ACCOUNT_TYPES.CORPORATE
      ? ACCOUNT_TYPES.CORPORATE
      : ACCOUNT_TYPES.INDIVIDUAL;

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    clinicName: '',
    companyName: '',
    street: '',
    city: '',
    state: '',
    countryId: '',
    otherCountryName: '',
    postalCode: '',
    mobileCountryCode: '',
    mobileNumber: '',
    gender: '',
    language: '',
    profession: '',
    professionSpecialization: '',
    academicTitle: '',
    academicTitleOther: '',
    preferredCurrency: 'USD',
    privacyAccepted: false,
  });
  const [countries, setCountries] = useState<CountryDto[]>([]);
  const [genders, setGenders] = useState<MasterListItemDto[]>([]);
  const [languages, setLanguages] = useState<MasterListItemDto[]>([]);
  const [professions, setProfessions] = useState<MasterListItemDto[]>([]);
  const [specializations, setSpecializations] = useState<MasterListItemDto[]>([]);
  const [titles, setTitles] = useState<MasterListItemDto[]>([]);
  const [privacy, setPrivacy] = useState<PrivacyPolicyDto | null>(null);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [devVerifyUrl, setDevVerifyUrl] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [countryList, genderList, languageList, professionList, titleList, privacyDoc] =
          await Promise.all([
            fetchCountries(true),
            fetchMasterListItems(MASTER_LIST_TYPES.GENDER, true),
            fetchMasterListItems(MASTER_LIST_TYPES.LANGUAGE, true),
            fetchMasterListItems(MASTER_LIST_TYPES.PROFESSION, true),
            fetchMasterListItems(MASTER_LIST_TYPES.ACADEMIC_TITLE, true),
            fetchCurrentPrivacy(),
          ]);
        setCountries(countryList);
        setGenders(genderList);
        setLanguages(languageList);
        setProfessions(professionList);
        setTitles(titleList);
        setPrivacy(privacyDoc);
      } catch {
        /* public lists optional if seed not ready */
      }
    })();
  }, []);

  useEffect(() => {
    const parent = professions.find((p) => p.label === form.profession || p.id === form.profession);
    if (!parent) {
      setSpecializations([]);
      return;
    }
    void fetchMasterListItems(MASTER_LIST_TYPES.PROFESSION_SPECIALIZATION, true).then((items) => {
      setSpecializations(items.filter((i) => !i.parentId || i.parentId === parent.id));
    });
  }, [form.profession, professions]);

  const practiceLabel = useMemo(
    () =>
      accountType === ACCOUNT_TYPES.CORPORATE ? 'Company name' : 'Clinic name (optional)',
    [accountType],
  );

  const countryOptions = useMemo(
    () =>
      countries.map((c) => ({
        value: c.id,
        label: c.name,
        meta: c.dialCode || undefined,
      })),
    [countries],
  );

  const selectedCountry = countries.find((c) => c.id === form.countryId);
  const isOtherCountry = Boolean(selectedCountry?.isOther || selectedCountry?.name === 'Other');

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onCountryChange(countryId: string) {
    const country = countries.find((c) => c.id === countryId);
    setForm((prev) => ({
      ...prev,
      countryId,
      otherCountryName: country?.isOther || country?.name === 'Other' ? prev.otherCountryName : '',
      mobileCountryCode: country?.dialCode || prev.mobileCountryCode,
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setPasswordError('');
    if (!privacy?.version || !form.privacyAccepted) {
      setError('You must accept the Privacy Notice to continue');
      return;
    }
    if (!form.countryId) {
      setError('Country is required');
      return;
    }
    if (isOtherCountry && !form.otherCountryName.trim()) {
      setError('Enter your country name');
      return;
    }
    const passwordIssues = validatePasswordComplexity(form.password);
    if (passwordIssues.length) {
      setPasswordError(PASSWORD_VALIDATION_FAILED);
      setError(PASSWORD_VALIDATION_FAILED);
      return;
    }
    setLoading(true);
    try {
      const countryName = isOtherCountry ? 'Other' : selectedCountry?.name || '';
      const result = await authApi.register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        accountType,
        clinicName:
          accountType === ACCOUNT_TYPES.INDIVIDUAL ? form.clinicName || undefined : undefined,
        companyName:
          accountType === ACCOUNT_TYPES.CORPORATE ? form.companyName || undefined : undefined,
        companyAddress:
          accountType === ACCOUNT_TYPES.CORPORATE
            ? {
                street: form.street,
                city: form.city,
                state: form.state,
                country: isOtherCountry ? form.otherCountryName : countryName,
                postalCode: form.postalCode,
              }
            : undefined,
        countryId: form.countryId || undefined,
        countryName,
        otherCountryName: isOtherCountry ? form.otherCountryName : undefined,
        mobileCountryCode: form.mobileCountryCode || undefined,
        mobileNumber: form.mobileNumber || undefined,
        gender: form.gender || undefined,
        language: form.language || undefined,
        profession: form.profession || undefined,
        professionSpecialization: form.professionSpecialization || undefined,
        academicTitle: form.academicTitle || undefined,
        academicTitleOther:
          form.academicTitle === 'Other' ? form.academicTitleOther || undefined : undefined,
        privacyPolicyVersionAccepted: privacy.version,
        preferredCurrency: form.preferredCurrency || undefined,
      });
      setSuccessMessage(result.message);
      setDevVerifyUrl(result.verifyUrl ?? '');
    } catch (err) {
      const passwordField = getFieldError(err, 'password');
      if (passwordField) setPasswordError(PASSWORD_VALIDATION_FAILED);
      setError(getErrorMessage(err, 'Unable to submit registration'));
    } finally {
      setLoading(false);
    }
  }

  if (successMessage) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="Complete email verification to continue the approval process."
        footer={
          <>
            <Link to={`/login?type=${accountType}`} className="font-semibold text-brand-600">
              Back to login
            </Link>
          </>
        }
      >
        <Alert tone="success">{successMessage}</Alert>
        {devVerifyUrl ? (
          <Alert tone="info">
            Dev mode link:{' '}
            <a href={devVerifyUrl} className="font-semibold underline">
              Verify email
            </a>
          </Alert>
        ) : null}
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={`${ACCOUNT_TYPE_LABELS[accountType]} registration`}
      subtitle="Register now. You will verify your email, then an administrator reviews your request before login is enabled."
      onSubmit={handleSubmit}
      footer={
        <>
          Already registered?{' '}
          <Link
            to={`/login?type=${accountType}`}
            className="font-semibold text-brand-600 hover:text-brand-700"
          >
            Log in
          </Link>
          {' · '}
          <Link
            to={`/register?type=${
              accountType === ACCOUNT_TYPES.INDIVIDUAL
                ? ACCOUNT_TYPES.CORPORATE
                : ACCOUNT_TYPES.INDIVIDUAL
            }`}
            className="font-semibold text-brand-600 hover:text-brand-700"
          >
            Switch to{' '}
            {accountType === ACCOUNT_TYPES.INDIVIDUAL
              ? ACCOUNT_TYPE_LABELS.corporate
              : ACCOUNT_TYPE_LABELS.individual}
          </Link>
        </>
      }
    >
      {error ? <Alert>{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="First name"
          name="firstName"
          required
          value={form.firstName}
          onChange={(e) => update('firstName', e.target.value)}
          placeholder="Alex"
        />
        <TextField
          label="Last name"
          name="lastName"
          required
          value={form.lastName}
          onChange={(e) => update('lastName', e.target.value)}
          placeholder="Chen"
        />
      </div>

      <TextField
        label={practiceLabel}
        name={accountType === ACCOUNT_TYPES.CORPORATE ? 'companyName' : 'clinicName'}
        required={accountType === ACCOUNT_TYPES.CORPORATE}
        value={
          accountType === ACCOUNT_TYPES.CORPORATE ? form.companyName : form.clinicName
        }
        onChange={(e) =>
          update(
            accountType === ACCOUNT_TYPES.CORPORATE ? 'companyName' : 'clinicName',
            e.target.value,
          )
        }
        placeholder={
          accountType === ACCOUNT_TYPES.CORPORATE ? 'Acme Dental Group' : 'Smile Clinic'
        }
      />

      {accountType === ACCOUNT_TYPES.CORPORATE ? (
        <div className="space-y-4 rounded-xl border border-line bg-surface/40 p-4">
          <p className="text-sm font-semibold text-ink">Company address</p>
          <TextField
            label="Street"
            name="street"
            required
            value={form.street}
            onChange={(e) => update('street', e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="City"
              name="city"
              required
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
            />
            <TextField
              label="State / Province"
              name="state"
              value={form.state}
              onChange={(e) => update('state', e.target.value)}
            />
          </div>
          <TextField
            label="Postal code"
            name="postalCode"
            value={form.postalCode}
            onChange={(e) => update('postalCode', e.target.value)}
          />
        </div>
      ) : null}

      <SearchableSelect
        label="Country"
        required
        options={countryOptions}
        value={form.countryId}
        onChange={onCountryChange}
        placeholder="Search country…"
      />
      {isOtherCountry ? (
        <TextField
          label="Specify country"
          name="otherCountryName"
          required
          value={form.otherCountryName}
          onChange={(e) => update('otherCountryName', e.target.value)}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Mobile country code"
          name="mobileCountryCode"
          value={form.mobileCountryCode}
          onChange={(e) => update('mobileCountryCode', e.target.value)}
          placeholder="+1"
        />
        <TextField
          label="Mobile number"
          name="mobileNumber"
          value={form.mobileNumber}
          onChange={(e) => update('mobileNumber', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-ink">Gender</span>
          <select
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5"
            value={form.gender}
            onChange={(e) => update('gender', e.target.value)}
          >
            <option value="">—</option>
            {genders.map((g) => (
              <option key={g.id} value={g.label}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-ink">Language</span>
          <select
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5"
            value={form.language}
            onChange={(e) => update('language', e.target.value)}
          >
            <option value="">—</option>
            {languages.map((g) => (
              <option key={g.id} value={g.label}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-ink">Profession</span>
          <select
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5"
            value={form.profession}
            onChange={(e) => {
              update('profession', e.target.value);
              update('professionSpecialization', '');
            }}
          >
            <option value="">—</option>
            {professions.map((g) => (
              <option key={g.id} value={g.label}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-ink">Specialization</span>
          <select
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5"
            value={form.professionSpecialization}
            onChange={(e) => update('professionSpecialization', e.target.value)}
            disabled={!form.profession}
          >
            <option value="">—</option>
            {specializations.map((g) => (
              <option key={g.id} value={g.label}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-ink">Academic title</span>
          <select
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5"
            value={form.academicTitle}
            onChange={(e) => update('academicTitle', e.target.value)}
          >
            <option value="">—</option>
            {titles.map((g) => (
              <option key={g.id} value={g.label}>
                {g.label}
              </option>
            ))}
            <option value="Other">Other</option>
          </select>
        </label>
        {form.academicTitle === 'Other' ? (
          <TextField
            label="Specify title"
            name="academicTitleOther"
            value={form.academicTitleOther}
            onChange={(e) => update('academicTitleOther', e.target.value)}
          />
        ) : (
          <TextField
            label="Preferred currency"
            name="preferredCurrency"
            value={form.preferredCurrency}
            onChange={(e) => update('preferredCurrency', e.target.value.toUpperCase())}
            placeholder="USD"
          />
        )}
      </div>

      {form.academicTitle === 'Other' ? (
        <TextField
          label="Preferred currency"
          name="preferredCurrency"
          value={form.preferredCurrency}
          onChange={(e) => update('preferredCurrency', e.target.value.toUpperCase())}
          placeholder="USD"
        />
      ) : null}

      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={form.email}
        onChange={(e) => update('email', e.target.value)}
        placeholder="you@clinic.com"
      />

      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        value={form.password}
        onChange={(e) => {
          update('password', e.target.value);
          setPasswordError('');
        }}
        hint={PASSWORD_POLICY_DESCRIPTION}
        error={passwordError}
      />

      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="mt-1"
          checked={form.privacyAccepted}
          onChange={(e) => update('privacyAccepted', e.target.checked)}
        />
        <span>
          I have read and accept the{' '}
          {privacy ? (
            <a
              href={`#privacy-${privacy.version}`}
              className="font-semibold text-brand-600 underline"
              onClick={(e) => {
                e.preventDefault();
                window.alert(
                  `Privacy Notice v${privacy.version}\n\n${privacy.bodyHtml.replace(/<[^>]+>/g, ' ').slice(0, 2000)}`,
                );
              }}
            >
              Privacy Notice (v{privacy.version})
            </a>
          ) : (
            <span className="text-muted">Privacy Notice (loading…)</span>
          )}
        </span>
      </label>

      <AuthButton loading={loading}>Submit registration</AuthButton>
    </AuthCard>
  );
}
