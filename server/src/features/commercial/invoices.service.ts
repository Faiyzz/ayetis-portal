import {
  AUDIT_ACTIONS,
  PAYMENT_PROVIDERS,
  type InvoiceDto,
  type PaymentProviderId,
  type PaymentReceiptDto,
} from '@ayetis/shared';
import {
  Invoice,
  PaymentReceipt,
  type IInvoice,
  type IPaymentReceipt,
} from '../../models/Commercial';
import { generateInvoiceNumber, generateReceiptNumber } from '../../models/DocumentCounter';
import { AppError } from '../../utils/AppError';
import { recordActivity, type RequestAuditContext } from '../audit/audit.service';
import { sendEmail } from '../../services/email';

export function invoiceDto(doc: IInvoice): InvoiceDto {
  return {
    id: doc.id,
    invoiceNumber: doc.invoiceNumber,
    caseId: doc.caseId ? String(doc.caseId) : null,
    paymentSessionId: doc.paymentSessionId ? String(doc.paymentSessionId) : null,
    customerUserId: doc.customerUserId ? String(doc.customerUserId) : null,
    customerEmail: doc.customerEmail,
    customerName: doc.customerName,
    currency: doc.currency,
    subtotal: doc.subtotal,
    discountAmount: doc.discountAmount,
    total: doc.total,
    status: doc.status,
    lineDescription: doc.lineDescription,
    issuedAt: doc.issuedAt.toISOString(),
    paidAt: doc.paidAt ? doc.paidAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function receiptDto(doc: IPaymentReceipt): PaymentReceiptDto {
  return {
    id: doc.id,
    receiptNumber: doc.receiptNumber,
    invoiceId: String(doc.invoiceId),
    invoiceNumber: doc.invoiceNumber,
    caseId: doc.caseId ? String(doc.caseId) : null,
    paymentSessionId: doc.paymentSessionId ? String(doc.paymentSessionId) : null,
    amount: doc.amount,
    currency: doc.currency,
    provider: doc.provider ?? null,
    providerReference: doc.providerReference ?? null,
    paidAt: doc.paidAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

function buildInvoiceHtml(input: {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  lineDescription: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  currency: string;
  issuedAt: Date;
  status: string;
}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${input.invoiceNumber}</title>
<style>
  body{font-family:Georgia,serif;color:#1a1a1a;margin:40px;line-height:1.5}
  h1{font-size:28px;margin:0 0 8px}
  .muted{color:#666;font-size:14px}
  table{width:100%;border-collapse:collapse;margin-top:28px}
  th,td{text-align:left;padding:10px 0;border-bottom:1px solid #ddd}
  .total{font-size:18px;font-weight:700}
  @media print{body{margin:16px}}
</style></head><body>
  <h1>Invoice ${input.invoiceNumber}</h1>
  <p class="muted">Issued ${input.issuedAt.toISOString().slice(0, 10)} · Status: ${input.status}</p>
  <p><strong>Bill to</strong><br/>${input.customerName}<br/>${input.customerEmail}</p>
  <table>
    <thead><tr><th>Description</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>${input.lineDescription}</td><td>${input.currency} ${input.subtotal.toFixed(2)}</td></tr>
      <tr><td>Discount</td><td>− ${input.currency} ${input.discountAmount.toFixed(2)}</td></tr>
      <tr><td class="total">Total</td><td class="total">${input.currency} ${input.total.toFixed(2)}</td></tr>
    </tbody>
  </table>
  <p class="muted" style="margin-top:40px">Ayetis Portal · Commercial</p>
</body></html>`;
}

function buildReceiptHtml(input: {
  receiptNumber: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  provider: string | null;
  paidAt: Date;
}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${input.receiptNumber}</title>
<style>
  body{font-family:Georgia,serif;color:#1a1a1a;margin:40px;line-height:1.5}
  h1{font-size:28px;margin:0 0 8px}
  .muted{color:#666;font-size:14px}
  @media print{body{margin:16px}}
</style></head><body>
  <h1>Receipt ${input.receiptNumber}</h1>
  <p class="muted">Paid ${input.paidAt.toISOString().slice(0, 10)}</p>
  <p>Payment of <strong>${input.currency} ${input.amount.toFixed(2)}</strong>
  for invoice <strong>${input.invoiceNumber}</strong>
  ${input.provider ? `via ${input.provider}` : ''}.</p>
  <p class="muted" style="margin-top:40px">Ayetis Portal · Thank you</p>
</body></html>`;
}

export async function issueInvoiceAndReceipt(input: {
  caseId?: string | null;
  paymentSessionId?: string | null;
  customerUserId?: string | null;
  customerEmail: string;
  customerName: string;
  currency: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  lineDescription: string;
  provider?: PaymentProviderId | null;
  providerReference?: string | null;
  markPaid?: boolean;
  sendMail?: boolean;
  actor?: { id?: string; email?: string; role?: string };
  audit?: RequestAuditContext;
}): Promise<{ invoice: InvoiceDto; receipt: PaymentReceiptDto | null }> {
  const invoiceNumber = await generateInvoiceNumber();
  const issuedAt = new Date();
  const status = input.markPaid ? 'paid' : 'issued';
  const htmlBody = buildInvoiceHtml({
    invoiceNumber,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    lineDescription: input.lineDescription,
    subtotal: input.subtotal,
    discountAmount: input.discountAmount,
    total: input.total,
    currency: input.currency,
    issuedAt,
    status,
  });

  const invoice = await Invoice.create({
    invoiceNumber,
    caseId: input.caseId || undefined,
    paymentSessionId: input.paymentSessionId || undefined,
    customerUserId: input.customerUserId || undefined,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    currency: input.currency,
    subtotal: input.subtotal,
    discountAmount: input.discountAmount,
    total: input.total,
    status,
    lineDescription: input.lineDescription,
    htmlBody,
    issuedAt,
    paidAt: input.markPaid ? issuedAt : undefined,
  });

  await recordActivity({
    action: AUDIT_ACTIONS.INVOICE_ISSUE,
    summary: `Invoice ${invoiceNumber} issued`,
    actorId: input.actor?.id,
    actorEmail: input.actor?.email,
    actorRole: input.actor?.role,
    targetType: 'invoice',
    targetId: invoice.id,
    metadata: { total: input.total, caseId: input.caseId },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
  });

  let receipt: InstanceType<typeof PaymentReceipt> | null = null;
  if (input.markPaid) {
    const receiptNumber = await generateReceiptNumber();
    const paidAt = issuedAt;
    const receiptHtml = buildReceiptHtml({
      receiptNumber,
      invoiceNumber,
      amount: input.total,
      currency: input.currency,
      provider: input.provider ?? null,
      paidAt,
    });
    receipt = await PaymentReceipt.create({
      receiptNumber,
      invoiceId: invoice._id,
      invoiceNumber,
      caseId: input.caseId || undefined,
      paymentSessionId: input.paymentSessionId || undefined,
      amount: input.total,
      currency: input.currency,
      provider: input.provider || undefined,
      providerReference: input.providerReference || undefined,
      htmlBody: receiptHtml,
      paidAt,
    });

    if (AUDIT_ACTIONS.PAYMENT_SESSION_PAID) {
      await recordActivity({
        action: AUDIT_ACTIONS.PAYMENT_SESSION_PAID,
        summary: `Receipt ${receiptNumber} created for ${invoiceNumber}`,
        actorEmail: input.actor?.email,
        targetType: 'payment',
        targetId: receipt.id,
      });
    }
  }

  if (input.sendMail !== false) {
    try {
      await sendEmail({
        to: input.customerEmail,
        subject: `Invoice ${invoiceNumber} — Ayetis`,
        html: htmlBody,
        text: `Invoice ${invoiceNumber} total ${input.currency} ${input.total.toFixed(2)}`,
      });
      if (receipt) {
        await sendEmail({
          to: input.customerEmail,
          subject: `Receipt ${receipt.receiptNumber} — Ayetis`,
          html: receipt.htmlBody,
          text: `Receipt ${receipt.receiptNumber} for ${invoiceNumber}`,
        });
      }
    } catch (err) {
      console.warn('[invoice] email failed', err);
    }
  }

  return {
    invoice: invoiceDto(invoice),
    receipt: receipt ? receiptDto(receipt) : null,
  };
}

export async function getInvoice(id: string) {
  const doc = await Invoice.findById(id);
  if (!doc) throw new AppError('Invoice not found', 404);
  return doc;
}

export async function getReceipt(id: string) {
  const doc = await PaymentReceipt.findById(id);
  if (!doc) throw new AppError('Receipt not found', 404);
  return doc;
}

export async function listInvoices(filter: {
  caseId?: string;
  customerUserId?: string;
}): Promise<InvoiceDto[]> {
  const q: Record<string, unknown> = {};
  if (filter.caseId) q.caseId = filter.caseId;
  if (filter.customerUserId) q.customerUserId = filter.customerUserId;
  const items = await Invoice.find(q).sort({ createdAt: -1 }).limit(200);
  return items.map(invoiceDto);
}

export async function generateScheduledInvoiceStub(caseIds: string[]): Promise<{
  eligibleCaseIds: string[];
  message: string;
}> {
  void PAYMENT_PROVIDERS;
  return {
    eligibleCaseIds: caseIds,
    message:
      'Batch invoice generation stub — export eligible cases and generate consolidated Invoice HTML in a later pass.',
  };
}
