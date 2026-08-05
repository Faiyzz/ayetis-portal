import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  PASSWORD_POLICY_DESCRIPTION,
  type AccountType,
} from '@ayetis/shared';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as authApi from '@/features/auth/api';
import { Alert, AuthButton, AuthCard, TextField } from '@/features/auth/components/AuthUI';
import { getErrorMessage } from '@/lib/api';

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
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [devVerifyUrl, setDevVerifyUrl] = useState('');

  const practiceLabel = useMemo(
    () =>
      accountType === ACCOUNT_TYPES.CORPORATE ? 'Company name' : 'Clinic name (optional)',
    [accountType],
  );

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
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
      });
      setSuccessMessage(result.message);
      setDevVerifyUrl(result.verifyUrl ?? '');
    } catch (err) {
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
        onChange={(e) => update('password', e.target.value)}
        placeholder={PASSWORD_POLICY_DESCRIPTION}
      />

      <AuthButton loading={loading}>Submit registration</AuthButton>
    </AuthCard>
  );
}
