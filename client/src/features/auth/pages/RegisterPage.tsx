import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDashboardPath } from '@ayetis/shared';
import { Alert, AuthButton, AuthCard, TextField } from '@/features/auth/components/AuthUI';
import { useAuthStore } from '@/features/auth/store';
import { getErrorMessage } from '@/lib/api';

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      const user = useAuthStore.getState().user;
      navigate(user ? getDashboardPath(user.role) : '/app', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create account'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Doctors can register here. Team accounts are provisioned by an admin."
      onSubmit={handleSubmit}
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Log in
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
        placeholder="Min. 8 chars, mixed case + number"
      />

      <AuthButton loading={loading}>Create account</AuthButton>
    </AuthCard>
  );
}
