import {
  ALL_ACCOUNT_TYPES,
  ALL_CASE_CATEGORIES,
  ALL_CASE_STATUSES,
  ALL_CASE_TYPES,
  ALL_PAYMENT_STATUSES,
  ALL_REFUND_STATUSES,
  REFUND_STATUSES,
  type AccountType,
  type CaseCategory,
  type CaseStatus,
  type CaseType,
  type PaymentStatus,
  type RefundStatus,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface ICancellationAudit extends Document {
  caseMongoId: Types.ObjectId;
  caseId: string;
  patientId?: string;
  patientName: string;
  doctorUserId: Types.ObjectId;
  doctorName: string;
  doctorDisplayId?: string;
  companyName?: string;
  accountType?: AccountType;
  caseCategory?: CaseCategory;
  caseType?: CaseType;
  treatmentPlanName?: string;
  caseValue?: number;
  invoiceNumber?: string;
  paymentStatus?: PaymentStatus;
  refundAmount: number;
  refundStatus: RefundStatus;
  cancellationReason: string;
  cancellationRemarks?: string;
  statusAtCancellation: CaseStatus;
  submittedAt?: Date;
  cancelledAt: Date;
  remainingWindowSeconds: number;
  cancelledById: Types.ObjectId;
  cancelledByName: string;
  cancelledByEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  paymentTransactionReference?: string;
  refundTransactionReference?: string;
  createdAt: Date;
  updatedAt: Date;
}

const cancellationAuditSchema = new Schema<ICancellationAudit>(
  {
    caseMongoId: { type: Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    caseId: { type: String, required: true, index: true },
    patientId: { type: String },
    patientName: { type: String, required: true },
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorName: { type: String, required: true },
    doctorDisplayId: { type: String, index: true },
    companyName: { type: String },
    accountType: { type: String, enum: ALL_ACCOUNT_TYPES },
    caseCategory: { type: String, enum: ALL_CASE_CATEGORIES, index: true },
    caseType: { type: String, enum: ALL_CASE_TYPES },
    treatmentPlanName: { type: String },
    caseValue: { type: Number },
    invoiceNumber: { type: String, index: true },
    paymentStatus: { type: String, enum: ALL_PAYMENT_STATUSES },
    refundAmount: { type: Number, default: 0 },
    refundStatus: {
      type: String,
      enum: ALL_REFUND_STATUSES,
      default: REFUND_STATUSES.NOT_APPLICABLE,
      index: true,
    },
    cancellationReason: { type: String, required: true },
    cancellationRemarks: { type: String },
    statusAtCancellation: { type: String, enum: ALL_CASE_STATUSES, required: true },
    submittedAt: { type: Date },
    cancelledAt: { type: Date, required: true, index: true },
    remainingWindowSeconds: { type: Number, default: 0 },
    cancelledById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cancelledByName: { type: String, required: true },
    cancelledByEmail: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    paymentTransactionReference: { type: String },
    refundTransactionReference: { type: String },
  },
  { timestamps: true },
);

cancellationAuditSchema.index({ cancelledAt: -1 });
cancellationAuditSchema.index({ refundStatus: 1, cancelledAt: -1 });

export const CancellationAudit: Model<ICancellationAudit> =
  mongoose.models.CancellationAudit ??
  mongoose.model<ICancellationAudit>('CancellationAudit', cancellationAuditSchema);
