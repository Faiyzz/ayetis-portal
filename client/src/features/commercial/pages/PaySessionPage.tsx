import {
  DEMO_CASE_MESSAGES,
  PAYMENT_PROVIDERS,
  PAYMENT_SESSION_STATUSES,
  type PaymentProviderConfigDto,
  type PaymentSessionDto,
} from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AuthButton, TextField } from '@/features/auth/components/AuthUI';
import {
  confirmPaymentSession,
  fetchPaymentProviders,
  fetchPaymentSession,
  selectPaymentProvider,
  submitBankReference,
} from '@/features/commercial/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function PaySessionPage() {
  const { sessionId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<PaymentSessionDto | null>(null);
  const [providers, setProviders] = useState<PaymentProviderConfigDto[]>([]);
  const [bankReference, setBankReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [s, p] = await Promise.all([
        fetchPaymentSession(sessionId),
        fetchPaymentProviders(),
      ]);
      setSession(s);
      setProviders(p.filter((item) => item.enabled));
      if (s.bankReference) setBankReference(s.bankReference);
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to load payment session');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (!session) return;
    if (searchParams.get('paid') === '1' && session.status !== PAYMENT_SESSION_STATUSES.PAID) {
      void confirmPaymentSession(sessionId, { mockStripe: true })
        .then((updated) => {
          setSession(updated);
          if (updated.caseId) {
            toast().success('Payment confirmed');
            navigate(`/app/cases/${updated.caseId}`);
          }
        })
        .catch(() => undefined);
    }
  }, [searchParams, session, sessionId, navigate]);

  async function chooseProvider(provider: string) {
    setWorking(true);
    try {
      const updated = await selectPaymentProvider(sessionId, provider);
      setSession(updated);
      if (updated.checkoutUrl && provider === PAYMENT_PROVIDERS.STRIPE && !searchParams.get('mockStripe')) {
        window.location.href = updated.checkoutUrl;
        return;
      }
      toast().success('Provider selected');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to select provider'));
    } finally {
      setWorking(false);
    }
  }

  async function saveBankRef() {
    setWorking(true);
    try {
      const updated = await submitBankReference(sessionId, bankReference);
      setSession(updated);
      toast().success('Bank reference submitted — awaiting admin confirmation');
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to submit reference'));
    } finally {
      setWorking(false);
    }
  }

  async function mockPay() {
    setWorking(true);
    try {
      const updated = await confirmPaymentSession(sessionId, { mockStripe: true });
      setSession(updated);
      toast().success('Mock payment completed');
      if (updated.caseId) navigate(`/app/cases/${updated.caseId}`);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to complete mock payment'));
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading payment…</p>;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!session) return null;

  const bankProvider = providers.find((p) => p.provider === PAYMENT_PROVIDERS.BANK_TRANSFER);
  const paid = session.status === PAYMENT_SESSION_STATUSES.PAID;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        eyebrow="Payment"
        title="Pay before case create"
        subtitle={`${session.currency} ${session.amount.toFixed(2)} · Status: ${session.status}`}
      />

      {paid ? (
        <Alert tone="success">
          Payment complete.
          {session.caseId ? (
            <>
              {' '}
              <Link className="font-semibold underline" to={`/app/cases/${session.caseId}`}>
                Open case
              </Link>
            </>
          ) : null}
        </Alert>
      ) : (
        <>
          <section className="space-y-3 rounded-xl border border-line bg-white p-4">
            <h2 className="text-sm font-semibold text-ink">Choose payment method</h2>
            <div className="grid gap-2">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  disabled={working}
                  onClick={() => void chooseProvider(provider.provider)}
                  className={[
                    'rounded-lg border px-4 py-3 text-left text-sm',
                    session.provider === provider.provider
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-line hover:border-brand-300',
                  ].join(' ')}
                >
                  <p className="font-semibold text-ink">{provider.label}</p>
                  {provider.instructions ? (
                    <p className="mt-1 text-xs text-muted whitespace-pre-wrap">
                      {provider.instructions}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          </section>

          {session.provider === PAYMENT_PROVIDERS.BANK_TRANSFER ? (
            <section className="space-y-3 rounded-xl border border-line bg-white p-4">
              <h2 className="text-sm font-semibold text-ink">Bank transfer reference</h2>
              {bankProvider?.instructions ? (
                <p className="text-sm text-muted whitespace-pre-wrap">{bankProvider.instructions}</p>
              ) : null}
              <TextField
                label="Payment reference"
                name="bankReference"
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
              />
              <AuthButton loading={working} type="button" onClick={() => void saveBankRef()}>
                Submit reference
              </AuthButton>
            </section>
          ) : null}

          {session.provider === PAYMENT_PROVIDERS.STRIPE &&
          (session.checkoutUrl?.includes('mockStripe') || searchParams.get('mockStripe')) ? (
            <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                Stripe mock mode — mark this session paid to create the case.
              </p>
              <AuthButton loading={working} type="button" onClick={() => void mockPay()}>
                Mark paid (dev)
              </AuthButton>
            </section>
          ) : null}
        </>
      )}

      <p className="text-xs text-muted">{DEMO_CASE_MESSAGES.confirmation}</p>
    </div>
  );
}
