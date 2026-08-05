import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset } from '@/features/auth/api';
import { Alert, AuthCard } from '@/features/auth/components/AuthUI';
import { getErrorMessage } from '@/lib/api';

export function ConfirmPasswordResetPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [devTemp, setDevTemp] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setError('Confirmation token is missing. Request a new password reset.');
        setLoading(false);
        return;
      }
      try {
        const result = await confirmPasswordReset(token);
        if (!cancelled) {
          setMessage(result.message);
          setDevTemp(result.temporaryPassword ?? '');
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Unable to confirm password reset'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthCard
      title="Password reset confirmed"
      subtitle="A temporary password is emailed after successful confirmation."
      footer={
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Back to login
        </Link>
      }
    >
      {loading ? <p className="text-sm text-muted">Confirming…</p> : null}
      {error ? <Alert>{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      {devTemp ? (
        <Alert tone="info">
          Dev mode temporary password: <span className="font-mono font-semibold">{devTemp}</span>
        </Alert>
      ) : null}
    </AuthCard>
  );
}
