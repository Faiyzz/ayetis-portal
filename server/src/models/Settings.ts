import {
  ALL_MASTER_LIST_TYPES,
  BRANDING_LOGO_SLOTS,
  COUNTRY_REQUEST_STATUSES,
  DEFAULT_CASE_SUBMISSION_TABS,
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_REPORT_VISIBILITY,
  DEFAULT_REQUIRED_FIELDS,
  DEFAULT_SLA_HOURS_BY_SEGMENT,
  DEFAULT_SLA_WARNING_PERCENT,
  type CountryRequestStatus,
  type MasterListType,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IMasterListItem extends Document {
  type: MasterListType;
  code?: string;
  label: string;
  sortOrder: number;
  parentId?: Types.ObjectId;
  isActive: boolean;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const masterListItemSchema = new Schema<IMasterListItem>(
  {
    type: { type: String, enum: ALL_MASTER_LIST_TYPES, required: true, index: true },
    code: { type: String, trim: true, uppercase: true },
    label: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    parentId: { type: Schema.Types.ObjectId, ref: 'MasterListItem', index: true },
    isActive: { type: Boolean, default: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

masterListItemSchema.index({ type: 1, label: 1 }, { unique: true });
masterListItemSchema.index({ type: 1, code: 1 }, { unique: true, sparse: true });

export const MasterListItem: Model<IMasterListItem> =
  mongoose.models.MasterListItem ??
  mongoose.model<IMasterListItem>('MasterListItem', masterListItemSchema);

export interface IRegion extends Document {
  code: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const regionSchema = new Schema<IRegion>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const Region: Model<IRegion> =
  mongoose.models.Region ?? mongoose.model<IRegion>('Region', regionSchema);

export interface ICountry extends Document {
  code: string;
  name: string;
  dialCode?: string;
  regionId?: Types.ObjectId;
  isActive: boolean;
  isOther: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const countrySchema = new Schema<ICountry>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, index: true },
    dialCode: { type: String, trim: true },
    regionId: { type: Schema.Types.ObjectId, ref: 'Region', index: true },
    isActive: { type: Boolean, default: true, index: true },
    isOther: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Country: Model<ICountry> =
  mongoose.models.Country ?? mongoose.model<ICountry>('Country', countrySchema);

export interface ICountryRequest extends Document {
  proposedName: string;
  status: CountryRequestStatus;
  registrationId?: Types.ObjectId;
  requesterEmail?: string;
  regionId?: Types.ObjectId;
  createdCountryId?: Types.ObjectId;
  reviewNotes?: string;
  reviewedById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const countryRequestSchema = new Schema<ICountryRequest>(
  {
    proposedName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(COUNTRY_REQUEST_STATUSES),
      default: COUNTRY_REQUEST_STATUSES.PENDING,
      index: true,
    },
    registrationId: { type: Schema.Types.ObjectId, ref: 'RegistrationRequest' },
    requesterEmail: { type: String, trim: true, lowercase: true },
    regionId: { type: Schema.Types.ObjectId, ref: 'Region' },
    createdCountryId: { type: Schema.Types.ObjectId, ref: 'Country' },
    reviewNotes: { type: String, trim: true },
    reviewedById: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const CountryRequest: Model<ICountryRequest> =
  mongoose.models.CountryRequest ??
  mongoose.model<ICountryRequest>('CountryRequest', countryRequestSchema);

export interface IBusinessConfig extends Document {
  key: string;
  companyName: string;
  logos: {
    login?: string;
    header?: string;
    footer?: string;
    email?: string;
  };
  notificationEmails: string[];
  maxUploadBytes: number;
  requiredFields: Record<string, boolean>;
  caseSubmissionTabs: Record<string, boolean>;
  reportVisibility: Record<string, boolean>;
  autoAssignmentEnabled: boolean;
  sla: {
    hoursBySegment: {
      individual: number;
      company: number;
      sub_account: number;
    };
    warningPercent: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const businessConfigSchema = new Schema<IBusinessConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    companyName: { type: String, default: 'Ayetis Portal', trim: true },
    logos: {
      login: { type: String },
      header: { type: String },
      footer: { type: String },
      email: { type: String },
    },
    notificationEmails: { type: [String], default: [] },
    maxUploadBytes: { type: Number, default: DEFAULT_MAX_UPLOAD_BYTES },
    requiredFields: { type: Schema.Types.Mixed, default: () => ({ ...DEFAULT_REQUIRED_FIELDS }) },
    caseSubmissionTabs: {
      type: Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_CASE_SUBMISSION_TABS }),
    },
    reportVisibility: {
      type: Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_REPORT_VISIBILITY }),
    },
    autoAssignmentEnabled: { type: Boolean, default: true },
    sla: {
      hoursBySegment: {
        individual: { type: Number, default: DEFAULT_SLA_HOURS_BY_SEGMENT.individual },
        company: { type: Number, default: DEFAULT_SLA_HOURS_BY_SEGMENT.company },
        sub_account: { type: Number, default: DEFAULT_SLA_HOURS_BY_SEGMENT.sub_account },
      },
      warningPercent: { type: Number, default: DEFAULT_SLA_WARNING_PERCENT, min: 1, max: 100 },
    },
  },
  { timestamps: true },
);

export const BusinessConfig: Model<IBusinessConfig> =
  mongoose.models.BusinessConfig ??
  mongoose.model<IBusinessConfig>('BusinessConfig', businessConfigSchema);

void BRANDING_LOGO_SLOTS;

export interface IEmailTemplate extends Document {
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
  placeholders: string[];
  updatedById?: Types.ObjectId;
  updatedByEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

const emailTemplateSchema = new Schema<IEmailTemplate>(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    htmlBody: { type: String, required: true },
    placeholders: { type: [String], default: [] },
    updatedById: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedByEmail: { type: String },
  },
  { timestamps: true },
);

export const EmailTemplate: Model<IEmailTemplate> =
  mongoose.models.EmailTemplate ??
  mongoose.model<IEmailTemplate>('EmailTemplate', emailTemplateSchema);

export interface IPrivacyPolicy extends Document {
  version: string;
  bodyHtml: string;
  publishedAt: Date;
  publishedById?: Types.ObjectId;
  publishedByEmail?: string;
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const privacyPolicySchema = new Schema<IPrivacyPolicy>(
  {
    version: { type: String, required: true, unique: true, trim: true },
    bodyHtml: { type: String, required: true },
    publishedAt: { type: Date, default: () => new Date() },
    publishedById: { type: Schema.Types.ObjectId, ref: 'User' },
    publishedByEmail: { type: String },
    isCurrent: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

export const PrivacyPolicy: Model<IPrivacyPolicy> =
  mongoose.models.PrivacyPolicy ??
  mongoose.model<IPrivacyPolicy>('PrivacyPolicy', privacyPolicySchema);
