/**
 * Configurable Master Data & Business Configuration (URD §5.11 / §5.19).
 */

export const MASTER_LIST_TYPES = {
  LANGUAGE: 'language',
  GENDER: 'gender',
  MOBILE_COUNTRY_CODE: 'mobile_country_code',
  PROFESSION: 'profession',
  PROFESSION_SPECIALIZATION: 'profession_specialization',
  ACADEMIC_TITLE: 'academic_title',
  SUPPORTED_SOFTWARE: 'supported_software',
} as const;

export type MasterListType = (typeof MASTER_LIST_TYPES)[keyof typeof MASTER_LIST_TYPES];

export const ALL_MASTER_LIST_TYPES: MasterListType[] = Object.values(MASTER_LIST_TYPES);

export const MASTER_LIST_TYPE_LABELS: Record<MasterListType, string> = {
  [MASTER_LIST_TYPES.LANGUAGE]: 'Languages',
  [MASTER_LIST_TYPES.GENDER]: 'Genders',
  [MASTER_LIST_TYPES.MOBILE_COUNTRY_CODE]: 'Mobile Country Codes',
  [MASTER_LIST_TYPES.PROFESSION]: 'Professions',
  [MASTER_LIST_TYPES.PROFESSION_SPECIALIZATION]: 'Professional Specializations',
  [MASTER_LIST_TYPES.ACADEMIC_TITLE]: 'Academic Titles',
  [MASTER_LIST_TYPES.SUPPORTED_SOFTWARE]: 'Supported Software',
};

export function isMasterListType(value: string): value is MasterListType {
  return (ALL_MASTER_LIST_TYPES as string[]).includes(value);
}

export interface MasterListItemDto {
  id: string;
  type: MasterListType;
  code: string | null;
  label: string;
  sortOrder: number;
  parentId: string | null;
  isActive: boolean;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface RegionDto {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  countryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CountryDto {
  id: string;
  code: string;
  name: string;
  dialCode: string | null;
  regionId: string | null;
  regionCode: string | null;
  regionName: string | null;
  isActive: boolean;
  isOther: boolean;
  createdAt: string;
  updatedAt: string;
}

export const COUNTRY_REQUEST_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type CountryRequestStatus =
  (typeof COUNTRY_REQUEST_STATUSES)[keyof typeof COUNTRY_REQUEST_STATUSES];

export interface CountryRequestDto {
  id: string;
  proposedName: string;
  status: CountryRequestStatus;
  registrationId: string | null;
  requesterEmail: string | null;
  regionId: string | null;
  createdCountryId: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const BRANDING_LOGO_SLOTS = {
  LOGIN: 'login',
  HEADER: 'header',
  FOOTER: 'footer',
  EMAIL: 'email',
} as const;

export type BrandingLogoSlot =
  (typeof BRANDING_LOGO_SLOTS)[keyof typeof BRANDING_LOGO_SLOTS];

export interface BrandingConfigDto {
  companyName: string;
  loginLogoUrl: string | null;
  headerLogoUrl: string | null;
  footerLogoUrl: string | null;
  emailLogoUrl: string | null;
  notificationEmails: string[];
  updatedAt: string | null;
}

export const DEFAULT_MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

export interface BusinessConfigDto {
  maxUploadBytes: number;
  requiredFields: Record<string, boolean>;
  caseSubmissionTabs: Record<string, boolean>;
  reportVisibility: Record<string, boolean>;
  updatedAt: string | null;
}

export const DEFAULT_REQUIRED_FIELDS: Record<string, boolean> = {
  gender: true,
  language: false,
  profession: true,
  professionSpecialization: false,
  academicTitle: false,
  mobileNumber: true,
  privacyNotice: true,
};

export const DEFAULT_CASE_SUBMISSION_TABS: Record<string, boolean> = {
  records: true,
  clinical: true,
  occlusion_commercial: true,
  files: true,
};

export const DEFAULT_REPORT_VISIBILITY: Record<string, boolean> = {
  cancellations: true,
  analytics: true,
  complaints: true,
};

export interface EmailTemplateDto {
  id: string;
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
  placeholders: string[];
  updatedAt: string;
  updatedByEmail: string | null;
}

export interface PrivacyPolicyDto {
  id: string;
  version: string;
  bodyHtml: string;
  publishedAt: string;
  publishedByEmail: string | null;
  isCurrent: boolean;
}

/** Default region seeds (URD NAM/APAC/CEMEA/LATAM/WEU). */
export const DEFAULT_REGIONS: Array<{ code: string; name: string }> = [
  { code: 'NAM', name: 'North America' },
  { code: 'APAC', name: 'Asia-Pacific' },
  { code: 'CEMEA', name: 'Central Europe, Middle East & Africa' },
  { code: 'LATAM', name: 'Latin America' },
  { code: 'WEU', name: 'Western Europe' },
];

export const EMAIL_TEMPLATE_KEYS = {
  REGISTRATION_CONFIRMATION: 'registration_confirmation',
  ACCOUNT_APPROVED: 'account_approved',
  ACCOUNT_REJECTED: 'account_rejected',
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
  ACCOUNT_BLOCKED: 'account_blocked',
} as const;

export type EmailTemplateKey =
  (typeof EMAIL_TEMPLATE_KEYS)[keyof typeof EMAIL_TEMPLATE_KEYS];

export const DEFAULT_EMAIL_TEMPLATE_DEFS: Array<{
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
  placeholders: string[];
}> = [
  {
    key: EMAIL_TEMPLATE_KEYS.REGISTRATION_CONFIRMATION,
    name: 'Registration confirmation',
    subject: 'Confirm your Ayetis registration',
    htmlBody:
      '<p>Hello {{firstName}},</p><p>Please verify your email: <a href="{{verifyUrl}}">Verify email</a></p>',
    placeholders: ['firstName', 'verifyUrl'],
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ACCOUNT_APPROVED,
    name: 'Account approved',
    subject: 'Your Ayetis account is ready',
    htmlBody:
      '<p>Hello {{firstName}},</p><p>Your account has been approved. Sign in at <a href="{{portalUrl}}">{{portalUrl}}</a></p>',
    placeholders: ['firstName', 'portalUrl', 'email'],
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ACCOUNT_REJECTED,
    name: 'Registration rejected',
    subject: 'Registration update',
    htmlBody:
      '<p>Hello {{firstName}},</p><p>Your registration was not approved.</p><p>{{reason}}</p>',
    placeholders: ['firstName', 'reason'],
  },
  {
    key: EMAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION,
    name: 'Email verification',
    subject: 'Verify your email',
    htmlBody:
      '<p>Hello {{firstName}},</p><p><a href="{{verifyUrl}}">Verify your email</a></p>',
    placeholders: ['firstName', 'verifyUrl'],
  },
  {
    key: EMAIL_TEMPLATE_KEYS.PASSWORD_RESET,
    name: 'Password reset',
    subject: 'Reset your password',
    htmlBody:
      '<p>Hello {{firstName}},</p><p><a href="{{resetUrl}}">Reset password</a></p>',
    placeholders: ['firstName', 'resetUrl'],
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ACCOUNT_BLOCKED,
    name: 'Account blocked',
    subject: 'Account blocked',
    htmlBody:
      '<p>Hello {{firstName}},</p><p>Your account has been temporarily blocked. Contact your POC.</p>',
    placeholders: ['firstName'],
  },
];

export function mergeTemplatePlaceholders(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    return vars[key] ?? '';
  });
}
