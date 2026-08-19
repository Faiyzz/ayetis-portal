import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Alert } from '@/features/auth/components/AuthUI';
import { fetchInvoices, openInvoiceHtml } from '@/features/commercial/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';
import type { InvoiceDto } from '@ayetis/shared';

export function MyInvoicesPage() {
  const [items, setItems] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchInvoices();
        if (active) setItems(data);
      } catch (err) {
        const message = getErrorMessage(err, 'Unable to load invoices');
        if (active) {
          setError(message);
          toast().error(message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Billing"
        title="My invoices"
        subtitle="Invoices billed to your account. Open a case for payment status and files."
      />

      {error ? <Alert>{error}</Alert> : null}

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        {loading ? (
          <p className="px-4 py-8 text-sm text-muted">Loading invoices…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Case</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Issued</th>
                  <th className="px-4 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((inv) => {
                  const caseId = inv.caseIds?.[0] || inv.caseId;
                  return (
                    <tr key={inv.id}>
                      <td className="px-4 py-3 font-medium text-ink">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">
                        {caseId ? (
                          <Link
                            to={`/app/cases/${caseId}#finance`}
                            className="font-semibold text-brand-600 hover:text-brand-700"
                          >
                            {caseId}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink">
                        {inv.currency} {inv.total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 capitalize text-ink">{inv.status}</td>
                      <td className="px-4 py-3 text-muted">
                        {new Date(inv.issuedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            void openInvoiceHtml(inv.id).catch((err) => {
                              toast().error(getErrorMessage(err, 'Unable to open invoice'));
                            });
                          }}
                          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
