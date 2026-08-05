import { ROLES, type Role } from './roles';

export const ACCOUNT_TYPES = {
  INDIVIDUAL: 'individual',
  CORPORATE: 'corporate',
} as const;

export type AccountType = (typeof ACCOUNT_TYPES)[keyof typeof ACCOUNT_TYPES];

export const ALL_ACCOUNT_TYPES: AccountType[] = Object.values(ACCOUNT_TYPES);

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [ACCOUNT_TYPES.INDIVIDUAL]: 'Individual Client',
  [ACCOUNT_TYPES.CORPORATE]: 'Corporate Client',
};

export function isAccountType(value: string): value is AccountType {
  return (ALL_ACCOUNT_TYPES as string[]).includes(value);
}

export const ACCOUNT_STATUSES = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BLOCKED: 'blocked',
} as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[keyof typeof ACCOUNT_STATUSES];

export const ALL_ACCOUNT_STATUSES: AccountStatus[] = Object.values(ACCOUNT_STATUSES);

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  [ACCOUNT_STATUSES.ACTIVE]: 'Active',
  [ACCOUNT_STATUSES.SUSPENDED]: 'Suspended',
  [ACCOUNT_STATUSES.BLOCKED]: 'Blocked',
};

export function isAccountStatus(value: string): value is AccountStatus {
  return (ALL_ACCOUNT_STATUSES as string[]).includes(value);
}

export function isAccountActive(status: AccountStatus): boolean {
  return status === ACCOUNT_STATUSES.ACTIVE;
}

export function canLogin(status: AccountStatus): boolean {
  return status === ACCOUNT_STATUSES.ACTIVE || status === ACCOUNT_STATUSES.SUSPENDED;
}

export function canSubmitWork(status: AccountStatus): boolean {
  return status === ACCOUNT_STATUSES.ACTIVE;
}

export const REGISTRATION_STATUSES = {
  PENDING_EMAIL_VERIFICATION: 'pending_email_verification',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  HELD: 'held',
} as const;

export type RegistrationStatus =
  (typeof REGISTRATION_STATUSES)[keyof typeof REGISTRATION_STATUSES];

export const ALL_REGISTRATION_STATUSES: RegistrationStatus[] = Object.values(REGISTRATION_STATUSES);

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  [REGISTRATION_STATUSES.PENDING_EMAIL_VERIFICATION]: 'Pending Email Verification',
  [REGISTRATION_STATUSES.PENDING_APPROVAL]: 'Pending Approval',
  [REGISTRATION_STATUSES.APPROVED]: 'Approved',
  [REGISTRATION_STATUSES.REJECTED]: 'Rejected',
  [REGISTRATION_STATUSES.HELD]: 'Held',
};

export function isRegistrationStatus(value: string): value is RegistrationStatus {
  return (ALL_REGISTRATION_STATUSES as string[]).includes(value);
}

export interface DoctorDisplayInput {
  doctorUserId: string;
  doctorName: string;
  doctorId: string | null | undefined;
}

/**
 * Doctor Name is visible only to Main Admin and the doctor themselves.
 * All other roles see Doctor ID only.
 */
export function canViewDoctorName(
  viewerRole: Role,
  viewerId: string,
  doctorUserId: string,
): boolean {
  if (viewerRole === ROLES.ADMIN) return true;
  if (viewerRole === ROLES.DOCTOR && viewerId === doctorUserId) return true;
  return false;
}

export function formatDoctorDisplay(
  viewerRole: Role,
  viewerId: string,
  doctor: DoctorDisplayInput,
): string {
  if (canViewDoctorName(viewerRole, viewerId, doctor.doctorUserId)) {
    return doctor.doctorName;
  }
  return doctor.doctorId || doctor.doctorUserId;
}

export interface RegistrationRequestDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
  clinicName: string | null;
  companyName: string | null;
  status: RegistrationStatus;
  emailVerifiedAt: string | null;
  rejectionReason: string | null;
  approvedUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationListResult {
  items: RegistrationRequestDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SystemMessages {
  registrationConfirmation: string;
  emailVerifiedPending: string;
  accountBlocked: string;
  accountSuspended: string;
}

export const DEFAULT_SYSTEM_MESSAGES: SystemMessages = {
  registrationConfirmation:
    'Registration successful. Please check your registered email address and verify your email to continue the account creation process.',
  emailVerifiedPending:
    'Thank you for verifying your email address. Your registration request is now under review. You will receive an account creation email within 8 working hours.',
  accountBlocked:
    'Your account has been temporarily blocked. Please contact your POC at Ayetis for account recovery.',
  accountSuspended:
    'Your account is suspended. You may view previous cases but cannot submit new work. Please contact your POC at Ayetis.',
};
