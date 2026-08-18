import {
  AUDIT_ACTIONS,
  CASE_STATUSES,
  PAYMENT_STATUSES,
  isInvoiceScheduleArrangement,
  PRICE_SUBJECT_TYPES,
  type BatchInvoiceResult,
  type InvoiceDto,
  type PaymentProviderId,
  type PaymentReceiptDto,
} from '@ayetis/shared';
import { Types } from 'mongoose';
import { Case, type ICase } from '../../models/Case';
import {
  Invoice,
  PaymentReceipt,
  type IInvoice,
  type IPaymentReceipt,
} from '../../models/Commercial';
import { generateInvoiceNumber, generateReceiptNumber } from '../../models/DocumentCounter';
import { Organization } from '../../models/Organization';
import { User } from '../../models/User';
import { AppError } from '../../utils/AppError';
import { recordActivity, type RequestAuditContext } from '../audit/audit.service';
import { sendEmail } from '../../services/email';
import { loadBillingSubject } from './pricingBilling.service';

export function invoiceDto(doc: IInvoice): InvoiceDto {
  const billed =
    doc.billedCaseIds && doc.billedCaseIds.length > 0
      ? doc.billedCaseIds
      : [];
  return {
    id: doc.id,
    invoiceNumber: doc.invoiceNumber,
    caseId: doc.caseId ? String(doc.caseId) : null,
    caseIds: billed,
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildInvoiceHtml(input: {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  lineDescription: string;
  lineItems?: Array<{ description: string; amount: number }>;
  subtotal: number;
  discountAmount: number;
  total: number;
  currency: string;
  issuedAt: Date;
  status: string;
}): string {
  const rows =
    input.lineItems && input.lineItems.length > 0
      ? input.lineItems
          .map(
            (item) =>
              `<tr><td>${escapeHtml(item.description)}</td><td>${input.currency} ${item.amount.toFixed(2)}</td></tr>`,
          )
          .join('')
      : `<tr><td>${escapeHtml(input.lineDescription)}</td><td>${input.currency} ${input.subtotal.toFixed(2)}</td></tr>`;
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
  <p><strong>Bill to</strong><br/>${escapeHtml(input.customerName)}<br/>${escapeHtml(input.customerEmail)}</p>
  <table>
    <thead><tr><th>Description</th><th>Amount</th></tr></thead>
    <tbody>
      ${rows}
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
  batchedCaseIds?: string[];
  billedCaseIds?: string[];
  lineItems?: Array<{ description: string; amount: number }>;
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
  if (input.paymentSessionId) {
    const existingInvoice = await Invoice.findOne({ paymentSessionId: input.paymentSessionId });
    if (existingInvoice) {
      const existingReceipt = await PaymentReceipt.findOne({ invoiceId: existingInvoice._id });
      return {
        invoice: invoiceDto(existingInvoice),
        receipt: existingReceipt ? receiptDto(existingReceipt) : null,
      };
    }
  }

  const invoiceNumber = await generateInvoiceNumber();
  const issuedAt = new Date();
  const status = input.markPaid ? 'paid' : 'issued';
  const htmlBody = buildInvoiceHtml({
    invoiceNumber,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    lineDescription: input.lineDescription,
    lineItems: input.lineItems,
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
    batchedCaseIds: (input.batchedCaseIds ?? []).map((id) => new Types.ObjectId(id)),
    billedCaseIds: input.billedCaseIds ?? [],
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
  if (filter.caseId) {
    q.$or = [
      { billedCaseIds: filter.caseId },
      ...(Types.ObjectId.isValid(filter.caseId)
        ? [{ caseId: filter.caseId }, { batchedCaseIds: filter.caseId }]
        : []),
    ];
  }
  if (filter.customerUserId) q.customerUserId = filter.customerUserId;
  const items = await Invoice.find(q).sort({ createdAt: -1 }).limit(200);
  return items.map(invoiceDto);
}

function caseAmount(caseDoc: ICase): number {
  const due = Number(caseDoc.payment?.amountDue ?? 0);
  const payable = Number(caseDoc.commercial?.finalPayableAmount ?? 0);
  const paid = Number(caseDoc.payment?.amountPaid ?? 0);
  const gross = due > 0 ? due : payable;
  return Math.max(0, Number((gross - paid).toFixed(2)));
}

async function resolveInvoiceCustomer(subject: {
  subjectType: string;
  subjectId: string;
  label: string;
}): Promise<{ email: string; name: string; userId: string | null } | null> {
  if (subject.subjectType === PRICE_SUBJECT_TYPES.ORGANIZATION) {
    const org = await Organization.findById(subject.subjectId);
    if (!org) return null;
    const owner = org.ownerUserId
      ? await User.findById(org.ownerUserId)
      : await User.findOne({ organizationId: org._id }).sort({ createdAt: 1 });
    if (!owner?.email) return null;
    return {
      email: owner.email,
      name: org.companyName || subject.label,
      userId: String(owner._id),
    };
  }
  const user = await User.findById(subject.subjectId);
  if (!user?.email) return null;
  return {
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim() || user.email,
    userId: String(user._id),
  };
}

/**
 * Issue real invoices for unbilled cases on weekly/bi-monthly/monthly/quarterly
 * billing arrangements (URD commercial). Groups by billing subject + currency.
 */
export async function generateScheduledInvoices(
  input: {
    caseIds?: string[];
    actor?: { id?: string; email?: string; role?: string };
    audit?: RequestAuditContext;
  } = {},
): Promise<BatchInvoiceResult> {
  const and: Record<string, unknown>[] = [
    { isDeleted: false },
    { isDemo: { $ne: true } },
    { $or: [{ invoiceId: { $exists: false } }, { invoiceId: null }] },
    { status: { $nin: [CASE_STATUSES.CANCELLED, CASE_STATUSES.SAVED_FOR_SUBMISSION] } },
  ];
  if (input.caseIds && input.caseIds.length > 0) {
    const objectIds = input.caseIds.filter((id) => /^[a-fA-F0-9]{24}$/.test(id));
    and.push({
      $or: [
        { caseId: { $in: input.caseIds } },
        ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
      ],
    });
  }

  const cases = await Case.find({ $and: and }).limit(500);
  const skipped: Array<{ caseId: string; reason: string }> = [];
  const groups = new Map<
    string,
    {
      subject: Awaited<ReturnType<typeof loadBillingSubject>>;
      currency: string;
      cases: ICase[];
    }
  >();

  for (const caseDoc of cases) {
    const doctorId = caseDoc.doctorId ? String(caseDoc.doctorId) : '';
    if (!doctorId) {
      skipped.push({ caseId: caseDoc.caseId, reason: 'No doctor on case' });
      continue;
    }
    let subject: Awaited<ReturnType<typeof loadBillingSubject>>;
    try {
      subject = await loadBillingSubject(doctorId);
    } catch {
      skipped.push({ caseId: caseDoc.caseId, reason: 'Unable to resolve billing subject' });
      continue;
    }
    if (!isInvoiceScheduleArrangement(subject.billingArrangement)) {
      skipped.push({
        caseId: caseDoc.caseId,
        reason: subject.billingArrangement
          ? `Arrangement is ${subject.billingArrangement}`
          : 'No invoice-schedule billing arrangement',
      });
      continue;
    }
    const amount = caseAmount(caseDoc);
    if (amount <= 0) {
      skipped.push({ caseId: caseDoc.caseId, reason: 'No outstanding amount' });
      continue;
    }
    const currency = (
      caseDoc.payment?.currency ||
      caseDoc.commercial?.currency ||
      'USD'
    ).toUpperCase();
    const key = `${subject.subjectType}:${subject.subjectId}:${currency}`;
    const existing = groups.get(key);
    if (existing) {
      existing.cases.push(caseDoc);
    } else {
      groups.set(key, { subject, currency, cases: [caseDoc] });
    }
  }

  const invoices: InvoiceDto[] = [];
  const billedCaseIds: string[] = [];

  for (const group of groups.values()) {
    const customer = await resolveInvoiceCustomer(group.subject);
    if (!customer) {
      for (const caseDoc of group.cases) {
        skipped.push({ caseId: caseDoc.caseId, reason: 'No billing email for customer' });
      }
      continue;
    }

    const lineItems = group.cases.map((caseDoc) => ({
      description: `${caseDoc.caseId} — ${caseDoc.patientName} (${caseDoc.commercial?.treatmentPlanName || 'Case'})`,
      amount: caseAmount(caseDoc),
    }));
    const subtotal = Number(lineItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
    const humanIds = group.cases.map((c) => c.caseId);
    const docs = await issueInvoiceAndReceipt({
      caseId: String(group.cases[0]!._id),
      batchedCaseIds: group.cases.map((c) => String(c._id)),
      billedCaseIds: humanIds,
      lineItems,
      customerUserId: customer.userId,
      customerEmail: customer.email,
      customerName: customer.name,
      currency: group.currency,
      subtotal,
      discountAmount: 0,
      total: subtotal,
      lineDescription: `Scheduled invoice (${group.subject.billingArrangement}) — ${humanIds.join(', ')}`,
      markPaid: false,
      sendMail: true,
      actor: input.actor,
      audit: input.audit,
    });

    for (const caseDoc of group.cases) {
      caseDoc.invoiceId = docs.invoice.id as never;
      caseDoc.payment = {
        ...caseDoc.payment,
        status: PAYMENT_STATUSES.PENDING,
        currency: group.currency,
        amountDue: caseAmount(caseDoc),
        amountPaid: caseDoc.payment?.amountPaid ?? 0,
        invoiceNumber: docs.invoice.invoiceNumber,
        notes: caseDoc.payment?.notes ?? '',
      };
      await caseDoc.save();
      billedCaseIds.push(caseDoc.caseId);
    }

    invoices.push(docs.invoice);
  }

  await recordActivity({
    action: AUDIT_ACTIONS.INVOICE_BATCH,
    summary: `Generated ${invoices.length} scheduled invoice(s) covering ${billedCaseIds.length} case(s)`,
    actorId: input.actor?.id,
    actorEmail: input.actor?.email,
    actorRole: input.actor?.role,
    targetType: 'invoice',
    targetId: invoices[0]?.id,
    metadata: { invoiceCount: invoices.length, billedCaseIds, skipped: skipped.length },
    ipAddress: input.audit?.ipAddress,
    userAgent: input.audit?.userAgent,
  });

  return {
    invoices,
    billedCaseIds,
    skipped,
    message:
      invoices.length === 0
        ? 'No eligible unbilled cases on invoice-schedule arrangements.'
        : `Issued ${invoices.length} invoice(s) for ${billedCaseIds.length} case(s).`,
  };
}
