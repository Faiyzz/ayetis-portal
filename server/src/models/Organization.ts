import {
  ALL_ORGANIZATION_STATUSES,
  EMPTY_COMPANY_ADDRESS,
  ORGANIZATION_STATUSES,
  type CompanyAddress,
  type OrganizationStatus,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IOrganization extends Document {
  corporateCustomerId: string;
  companyName: string;
  address: CompanyAddress;
  country: string;
  status: OrganizationStatus;
  ownerUserId?: Types.ObjectId;
  /** Monotonic; never reset — drives Sub-Account ID sequences. */
  subAccountSeq: number;
  /** Monotonic; never reset — drives Employee ID sequences. */
  employeeSeq: number;
  billingArrangement?: import('@ayetis/shared').BillingArrangement;
  prepaidCaseBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<CompanyAddress>(
  {
    street: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    country: { type: String, default: '', trim: true },
    postalCode: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const organizationSchema = new Schema<IOrganization>(
  {
    corporateCustomerId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    companyName: { type: String, required: true, trim: true },
    address: { type: addressSchema, default: () => ({ ...EMPTY_COMPANY_ADDRESS }) },
    country: { type: String, default: '', trim: true, index: true },
    status: {
      type: String,
      enum: ALL_ORGANIZATION_STATUSES,
      default: ORGANIZATION_STATUSES.ACTIVE,
      index: true,
    },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    subAccountSeq: { type: Number, default: 0, min: 0 },
    employeeSeq: { type: Number, default: 0, min: 0 },
    billingArrangement: { type: String, trim: true, index: true },
    prepaidCaseBalance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

export const Organization: Model<IOrganization> =
  mongoose.models.Organization ??
  mongoose.model<IOrganization>('Organization', organizationSchema);
