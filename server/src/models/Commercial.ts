import {
  ALL_PAYMENT_PROVIDERS,
  PAYMENT_SESSION_STATUSES,
  PREPAID_LEDGER_KINDS,
  PRICE_SUBJECT_TYPES,
  type PaymentProviderId,
  type PaymentSessionStatus,
  type PrepaidLedgerKind,
  type PriceSubjectType,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface ICustomerPriceOverride extends Document {
  subjectType: PriceSubjectType;
  subjectId: Types.ObjectId;
  treatmentPlanId: Types.ObjectId;
  price: number;
  currency: string;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customerPriceOverrideSchema = new Schema<ICustomerPriceOverride>(
  {
    subjectType: {
      type: String,
      enum: Object.values(PRICE_SUBJECT_TYPES),
      required: true,
      index: true,
    },
    subjectId: { type: Schema.Types.ObjectId, required: true, index: true },
    treatmentPlanId: {
      type: Schema.Types.ObjectId,
      ref: 'TreatmentPlan',
      required: true,
      index: true,
    },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true },
    effectiveFrom: { type: Date },
    effectiveUntil: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

customerPriceOverrideSchema.index(
  { subjectType: 1, subjectId: 1, treatmentPlanId: 1 },
  { unique: true },
);

export const CustomerPriceOverride: Model<ICustomerPriceOverride> =
  mongoose.models.CustomerPriceOverride ??
  mongoose.model<ICustomerPriceOverride>(
    'CustomerPriceOverride',
    customerPriceOverrideSchema,
  );

export interface IPrepaidLedgerEntry extends Document {
  subjectType: PriceSubjectType;
  subjectId: Types.ObjectId;
  kind: PrepaidLedgerKind;
  deltaCases: number;
  balanceAfter: number;
  caseId?: Types.ObjectId;
  reason: string;
  actorId?: Types.ObjectId;
  actorEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

const prepaidLedgerSchema = new Schema<IPrepaidLedgerEntry>(
  {
    subjectType: {
      type: String,
      enum: Object.values(PRICE_SUBJECT_TYPES),
      required: true,
      index: true,
    },
    subjectId: { type: Schema.Types.ObjectId, required: true, index: true },
    kind: {
      type: String,
      enum: Object.values(PREPAID_LEDGER_KINDS),
      required: true,
    },
    deltaCases: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', index: true },
    reason: { type: String, default: '', trim: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorEmail: { type: String, trim: true },
  },
  { timestamps: true },
);

export const PrepaidLedgerEntry: Model<IPrepaidLedgerEntry> =
  mongoose.models.PrepaidLedgerEntry ??
  mongoose.model<IPrepaidLedgerEntry>('PrepaidLedgerEntry', prepaidLedgerSchema);

export interface IPaymentSession extends Document {
  userId: Types.ObjectId;
  status: PaymentSessionStatus;
  provider?: PaymentProviderId;
  amount: number;
  currency: string;
  discountCode?: string;
  treatmentPlanId?: Types.ObjectId;
  isDemo: boolean;
  createPayload: Record<string, unknown>;
  checkoutUrl?: string;
  bankReference?: string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  caseId?: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  receiptId?: Types.ObjectId;
  expiresAt?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSessionSchema = new Schema<IPaymentSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(PAYMENT_SESSION_STATUSES),
      default: PAYMENT_SESSION_STATUSES.PENDING,
      index: true,
    },
    provider: { type: String, enum: ALL_PAYMENT_PROVIDERS },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true },
    discountCode: { type: String, uppercase: true, trim: true },
    treatmentPlanId: { type: Schema.Types.ObjectId, ref: 'TreatmentPlan' },
    isDemo: { type: Boolean, default: false },
    createPayload: { type: Schema.Types.Mixed, required: true },
    checkoutUrl: { type: String },
    bankReference: { type: String, trim: true },
    stripeSessionId: { type: String, index: true },
    stripePaymentIntentId: { type: String },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case' },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    receiptId: { type: Schema.Types.ObjectId, ref: 'PaymentReceipt' },
    expiresAt: { type: Date },
    paidAt: { type: Date },
  },
  { timestamps: true },
);

export const PaymentSession: Model<IPaymentSession> =
  mongoose.models.PaymentSession ??
  mongoose.model<IPaymentSession>('PaymentSession', paymentSessionSchema);

export interface IInvoice extends Document {
  invoiceNumber: string;
  caseId?: Types.ObjectId;
  paymentSessionId?: Types.ObjectId;
  customerUserId?: Types.ObjectId;
  customerEmail: string;
  customerName: string;
  currency: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  status: 'draft' | 'issued' | 'paid' | 'void';
  lineDescription: string;
  htmlBody: string;
  issuedAt: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', index: true },
    paymentSessionId: { type: Schema.Types.ObjectId, ref: 'PaymentSession' },
    customerUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    customerEmail: { type: String, required: true },
    customerName: { type: String, required: true },
    currency: { type: String, default: 'USD', uppercase: true },
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['draft', 'issued', 'paid', 'void'],
      default: 'issued',
      index: true,
    },
    lineDescription: { type: String, default: '' },
    htmlBody: { type: String, default: '' },
    issuedAt: { type: Date, default: () => new Date() },
    paidAt: { type: Date },
  },
  { timestamps: true },
);

export const Invoice: Model<IInvoice> =
  mongoose.models.Invoice ?? mongoose.model<IInvoice>('Invoice', invoiceSchema);

export interface IPaymentReceipt extends Document {
  receiptNumber: string;
  invoiceId: Types.ObjectId;
  invoiceNumber: string;
  caseId?: Types.ObjectId;
  paymentSessionId?: Types.ObjectId;
  amount: number;
  currency: string;
  provider?: PaymentProviderId;
  providerReference?: string;
  htmlBody: string;
  paidAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentReceiptSchema = new Schema<IPaymentReceipt>(
  {
    receiptNumber: { type: String, required: true, unique: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    invoiceNumber: { type: String, required: true },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', index: true },
    paymentSessionId: { type: Schema.Types.ObjectId, ref: 'PaymentSession' },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true },
    provider: { type: String, enum: ALL_PAYMENT_PROVIDERS },
    providerReference: { type: String },
    htmlBody: { type: String, default: '' },
    paidAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

export const PaymentReceipt: Model<IPaymentReceipt> =
  mongoose.models.PaymentReceipt ??
  mongoose.model<IPaymentReceipt>('PaymentReceipt', paymentReceiptSchema);

export interface IPaymentProviderConfig extends Document {
  provider: PaymentProviderId;
  label: string;
  enabled: boolean;
  instructions: string;
  config: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentProviderConfigSchema = new Schema<IPaymentProviderConfig>(
  {
    provider: {
      type: String,
      enum: ALL_PAYMENT_PROVIDERS,
      required: true,
      unique: true,
    },
    label: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true, index: true },
    instructions: { type: String, default: '' },
    config: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

export const PaymentProviderConfig: Model<IPaymentProviderConfig> =
  mongoose.models.PaymentProviderConfig ??
  mongoose.model<IPaymentProviderConfig>(
    'PaymentProviderConfig',
    paymentProviderConfigSchema,
  );
