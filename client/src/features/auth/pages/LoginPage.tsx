import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, getDashboardPath, type AccountType } from '@ayetis/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, AuthButton, AuthCard, TextField } from '@/features/auth/components/AuthUI';
import { useAuthStore } from '@/features/auth/store';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const initialType =
    searchParams.get('type') === ACCOUNT_TYPES.CORPORATE
      ? ACCOUNT_TYPES.CORPORATE
      : ACCOUNT_TYPES.INDIVIDUAL;
  const [accountType, setAccountType] = useState<AccountType>(initialType);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, accountType);
      const user = useAuthStore.getState().user;
      toast().success('Welcome back', 'Signed in');
      navigate(user ? getDashboardPath(user.role) : '/app', { replace: true });
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to log in');
      setError(message);
      toast().error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-121 rounded-3xl border border-line bg-panel/95 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-8 lg:p-10">
      <AuthCard
        title="Welcome back"
        subtitle="Choose your account type, then sign in to your digital orthodontic workspace."
        onSubmit={handleSubmit}
        brandTone="dark"
        footer={
          <>
            Don&apos;t have an account?{' '}
            <Link
              to={`/register?type=${accountType}`}
              className="font-semibold text-slate-800 hover:text-slate-950"
            >
              Register Here
            </Link>
          </>
        }
      >
        {error ? <Alert>{error}</Alert> : null}

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          {ALL_LOGIN_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setAccountType(type)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                accountType === type
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {ACCOUNT_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@clinic.com"
          className="focus:border-slate-500 focus:ring-slate-900/10"
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
            className="focus:border-slate-500 focus:ring-slate-900/10"
          />
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-slate-700 hover:text-slate-950"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <AuthButton loading={loading} variant="dark">
          Sign in securely
        </AuthButton>

        <div className="flex items-center justify-center gap-2 pt-1 text-xs text-slate-500">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            className="size-3.5"
          >
            <rect x="4" y="8" width="12" height="9" rx="2" strokeWidth="1.5" />
            <path d="M7 8V6a3 3 0 0 1 6 0v2" strokeWidth="1.5" />
          </svg>
          Secure access to protected patient information
        </div>
      </AuthCard>
    </div>
  );
}

const ALL_LOGIN_TYPES = [ACCOUNT_TYPES.INDIVIDUAL, ACCOUNT_TYPES.CORPORATE] as const;
