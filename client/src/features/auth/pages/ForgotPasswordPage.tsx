import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '@/features/auth/api';
import { Alert, AuthButton, AuthCard, TextField } from '@/features/auth/components/AuthUI';
import { getErrorMessage } from '@/lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setDevResetUrl('');
    setLoading(true);
    try {
      const result = await forgotPassword(email);
      setSuccess(result.message);
      if (result.resetUrl) {
        setDevResetUrl(result.resetUrl);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to send reset link'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Reset password"
      subtitle="Enter your email and we’ll send a secure reset link."
      onSubmit={handleSubmit}
      footer={
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Back to login
        </Link>
      }
    >
      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {devResetUrl ? (
        <Alert tone="info">
          Dev mode link:{' '}
          <a href={devResetUrl} className="font-semibold underline">
            Open reset page
          </a>
        </Alert>
      ) : null}

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

      <AuthButton loading={loading}>Send reset link</AuthButton>
    </AuthCard>
  );
}
