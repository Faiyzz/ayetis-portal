import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '@/features/auth/api';
import { Alert, AuthButton, AuthCard, TextField } from '@/features/auth/components/AuthUI';
import { useAuthStore } from '@/features/auth/store';
import { getErrorMessage } from '@/lib/api';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('Reset token is missing. Request a new link.');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const payload = await resetPassword(token, password);
      setSession(payload.user, payload.tokens.accessToken);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to reset password'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Use at least 8 characters with upper, lower, and a number."
      onSubmit={handleSubmit}
      footer={
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Back to login
        </Link>
      }
    >
      {error ? <Alert>{error}</Alert> : null}
      {!token ? (
        <Alert>This reset link is incomplete. Please request a new one.</Alert>
      ) : null}

      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <TextField
        label="Confirm password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      <AuthButton loading={loading} disabled={!token}>
        Update password
      </AuthButton>
    </AuthCard>
  );
}
