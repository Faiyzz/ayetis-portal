import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '@/features/auth/api';
import { Alert, AuthButton, AuthCard, TextField } from '@/features/auth/components/AuthUI';
import { getErrorMessage } from '@/lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devConfirmUrl, setDevConfirmUrl] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setDevConfirmUrl('');
    setLoading(true);
    try {
      const result = await forgotPassword(email);
      setSuccess(result.message);
      if (result.confirmUrl) {
        setDevConfirmUrl(result.confirmUrl);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to start password reset'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Reset password"
      subtitle="We will email a confirmation link. After you confirm, a temporary password is sent and you must change it on first login."
      onSubmit={handleSubmit}
      footer={
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Back to login
        </Link>
      }
    >
      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {devConfirmUrl ? (
        <Alert tone="info">
          Dev mode link:{' '}
          <a href={devConfirmUrl} className="font-semibold underline">
            Confirm reset
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

      <AuthButton loading={loading}>Send confirmation email</AuthButton>
    </AuthCard>
  );
}
