import {
  ACCOUNT_TYPES,
  ALL_ACCOUNT_TYPES,
  ALL_REGISTRATION_STATUSES,
  REGISTRATION_STATUSES,
  type AccountType,
  type RegistrationStatus,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IRegistrationRequest extends Document {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
  clinicName?: string;
  companyName?: string;
  companyAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  status: RegistrationStatus;
  emailVerifiedAt?: Date;
  verificationTokenHash?: string;
  verificationExpires?: Date;
  rejectionReason?: string;
  approvedUserId?: Types.ObjectId;
  countryId?: Types.ObjectId;
  countryName?: string;
  otherCountryName?: string;
  mobileCountryCode?: string;
  mobileNumber?: string;
  gender?: string;
  language?: string;
  profession?: string;
  professionSpecialization?: string;
  academicTitle?: string;
  academicTitleOther?: string;
  privacyPolicyVersionAccepted?: string;
  preferredCurrency?: string;
  createdAt: Date;
  updatedAt: Date;
}

const registrationRequestSchema = new Schema<IRegistrationRequest>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    accountType: {
      type: String,
      enum: ALL_ACCOUNT_TYPES,
      required: true,
      default: ACCOUNT_TYPES.INDIVIDUAL,
      index: true,
    },
    clinicName: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    companyAddress: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: '' },
      postalCode: { type: String, trim: true, default: '' },
    },
    status: {
      type: String,
      enum: ALL_REGISTRATION_STATUSES,
      required: true,
      default: REGISTRATION_STATUSES.PENDING_EMAIL_VERIFICATION,
      index: true,
    },
    emailVerifiedAt: {
      type: Date,
    },
    verificationTokenHash: {
      type: String,
      select: false,
    },
    verificationExpires: {
      type: Date,
      select: false,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    approvedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    countryId: { type: Schema.Types.ObjectId, ref: 'Country' },
    countryName: { type: String, trim: true },
    otherCountryName: { type: String, trim: true },
    mobileCountryCode: { type: String, trim: true },
    mobileNumber: { type: String, trim: true },
    gender: { type: String, trim: true },
    language: { type: String, trim: true },
    profession: { type: String, trim: true },
    professionSpecialization: { type: String, trim: true },
    academicTitle: { type: String, trim: true },
    academicTitleOther: { type: String, trim: true },
    privacyPolicyVersionAccepted: { type: String, trim: true },
    preferredCurrency: { type: String, uppercase: true, trim: true },
  },
  {
    timestamps: true,
  },
);

registrationRequestSchema.index({ email: 1, status: 1 });

export const RegistrationRequest: Model<IRegistrationRequest> =
  mongoose.models.RegistrationRequest ??
  mongoose.model<IRegistrationRequest>('RegistrationRequest', registrationRequestSchema);
