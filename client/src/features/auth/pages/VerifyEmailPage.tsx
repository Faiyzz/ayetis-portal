import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '@/features/auth/api';
import { Alert, AuthCard } from '@/features/auth/components/AuthUI';
import { getErrorMessage } from '@/lib/api';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setError('Verification token is missing.');
        setLoading(false);
        return;
      }
      try {
        const result = await verifyEmail(token);
        if (!cancelled) setMessage(result.message);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Unable to verify email'));
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
      title="Email verification"
      subtitle="Confirming your registration email address."
      footer={
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Back to login
        </Link>
      }
    >
      {loading ? <p className="text-sm text-muted">Verifying…</p> : null}
      {error ? <Alert>{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
    </AuthCard>
  );
}
