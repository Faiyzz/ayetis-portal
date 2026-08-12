import type { AccountStatus, AccountType } from './account';
import type { Permission } from './permissions';
import type { Role } from './roles';
import type { ThemePreference } from './security';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiFailure {
  success: false;
  message: string;
  errors?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  /** All enabled role keys (includes primary). */
  roles: Role[];
  primaryRole: Role;
  accountType: AccountType;
  accountStatus: AccountStatus;
  doctorId: string | null;
  clinicName: string | null;
  companyName: string | null;
  companyAddress: import('./corporate').CompanyAddress | null;
  organizationId: string | null;
  corporateCustomerId: string | null;
  facilityId: string | null;
  employeeId: string | null;
  subAccountId: string | null;
  assignedCountry: string | null;
  pendingEmailVerification?: boolean;
  /** Doctor SLA target in business hours (excludes weekends). */
  slaBusinessHours: number | null;
  /** Derived: accountStatus === 'active' */
  isActive: boolean;
  departmentId: string | null;
  departmentName: string | null;
  teamIds: string[];
  experienceLevel: import('./rbac').ExperienceLevel | null;
  softwareExpertise: string[];
  isAvailable: boolean;
  qcScope: import('./rbac').QcScope;
  permissionGrants: Permission[];
  permissionDenies: Permission[];
  permissions: Permission[];
  mustChangePassword: boolean;
  passwordExpired: boolean;
  passwordChangedAt: string | null;
  passwordExpiresAt: string | null;
  themePreference: ThemePreference;
  /** Temporary login lockout end (ISO). Null when not locked. */
  lockoutUntil: string | null;
  /** True when lockoutUntil is in the future. */
  isLocked: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  lastLoginUserAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: string;
}

export interface AuthPayload {
  user: PublicUser;
  tokens: AuthTokens;
}

export interface RolePermissionConfigDto {
  role: Role;
  grants: Permission[];
  denies: Permission[];
  defaults: Permission[];
  effective: Permission[];
  locked: boolean;
}

export interface ManagedUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  roles: Role[];
  primaryRole: Role;
  accountType: AccountType;
  accountStatus: AccountStatus;
  doctorId: string | null;
  clinicName: string | null;
  companyName: string | null;
  companyAddress: import('./corporate').CompanyAddress | null;
  organizationId: string | null;
  corporateCustomerId: string | null;
  facilityId: string | null;
  employeeId: string | null;
  subAccountId: string | null;
  assignedCountry: string | null;
  /** Derived: accountStatus === 'active' */
  isActive: boolean;
  departmentId: string | null;
  departmentName: string | null;
  teamIds: string[];
  experienceLevel: import('./rbac').ExperienceLevel | null;
  softwareExpertise: string[];
  isAvailable: boolean;
  qcScope: import('./rbac').QcScope;
  permissionGrants: Permission[];
  permissionDenies: Permission[];
  permissions: Permission[];
  mustChangePassword: boolean;
  passwordExpired: boolean;
  passwordChangedAt: string | null;
  passwordExpiresAt: string | null;
  themePreference: ThemePreference;
  lockoutUntil: string | null;
  isLocked: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  lastLoginUserAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  roles?: Role[];
  primaryRole?: Role;
  accountType?: AccountType;
  clinicName?: string | null;
  companyName?: string | null;
  departmentId?: string | null;
  teamIds?: string[];
  experienceLevel?: import('./rbac').ExperienceLevel | null;
  softwareExpertise?: string[];
  isAvailable?: boolean;
  permissionGrants?: Permission[];
  permissionDenies?: Permission[];
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: Role;
  roles?: Role[];
  primaryRole?: Role;
  accountStatus?: AccountStatus;
  /** @deprecated Prefer accountStatus */
  isActive?: boolean;
  clinicName?: string | null;
  companyName?: string | null;
  departmentId?: string | null;
  teamIds?: string[];
  experienceLevel?: import('./rbac').ExperienceLevel | null;
  softwareExpertise?: string[];
  isAvailable?: boolean;
}

export interface AssignPermissionsInput {
  grants: Permission[];
  denies: Permission[];
}

export interface PermissionCatalogItem {
  value: Permission;
  label: string;
  group: string;
}
