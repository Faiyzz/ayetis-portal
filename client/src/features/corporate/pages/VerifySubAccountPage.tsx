import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, AuthCard } from '@/features/auth/components/AuthUI';
import * as corporateApi from '@/features/corporate/api';
import { getErrorMessage } from '@/lib/api';

export function VerifySubAccountPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [message, setMessage] = useState('');
  const [tempPassword, setTempPassword] = useState('');
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
        const result = await corporateApi.verifySubAccount(token);
        if (!cancelled) {
          setMessage(result.message);
          if (result.temporaryPassword) setTempPassword(result.temporaryPassword);
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Unable to verify sub-account email'));
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
      title="Sub-account verification"
      subtitle="Confirming your email and issuing a temporary password."
      footer={
        <Link
          to="/login?type=corporate"
          className="font-semibold text-brand-600 hover:text-brand-700"
        >
          Continue to login
        </Link>
      }
    >
      {loading ? <p className="text-sm text-muted">Verifying…</p> : null}
      {error ? <Alert>{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      {tempPassword ? (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 font-mono text-sm text-ink">
          Dev temporary password: {tempPassword}
        </p>
      ) : null}
    </AuthCard>
  );
}
