import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, AuthButton, AuthCard, TextField } from '@/features/auth/components/AuthUI';
import { useAuthStore } from '@/features/auth/store';
import { getErrorMessage } from '@/lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to log in'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to manage cases, reviews, and deliveries."
      onSubmit={handleSubmit}
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
            Create one
          </Link>
        </>
      }
    >
      {error ? <Alert>{error}</Alert> : null}

      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@clinic.com"
      />

      <div className="space-y-1.5">
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <AuthButton loading={loading}>Log in</AuthButton>
    </AuthCard>
  );
}
