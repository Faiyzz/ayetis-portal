/**
 * Corporate hierarchy (Organization → Facilities → Employees / Sub-Accounts).
 */

export const FACILITY_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type FacilityStatus = (typeof FACILITY_STATUSES)[keyof typeof FACILITY_STATUSES];

export const ALL_FACILITY_STATUSES: FacilityStatus[] = Object.values(FACILITY_STATUSES);

export const FACILITY_STATUS_LABELS: Record<FacilityStatus, string> = {
  [FACILITY_STATUSES.ACTIVE]: 'Active',
  [FACILITY_STATUSES.INACTIVE]: 'Inactive',
};

export function isFacilityStatus(value: string): value is FacilityStatus {
  return (ALL_FACILITY_STATUSES as string[]).includes(value);
}

export const ORGANIZATION_STATUSES = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  INACTIVE: 'inactive',
} as const;

export type OrganizationStatus =
  (typeof ORGANIZATION_STATUSES)[keyof typeof ORGANIZATION_STATUSES];

export const ALL_ORGANIZATION_STATUSES: OrganizationStatus[] =
  Object.values(ORGANIZATION_STATUSES);

export interface CompanyAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export const EMPTY_COMPANY_ADDRESS: CompanyAddress = {
  street: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
};

export interface OrganizationDto {
  id: string;
  corporateCustomerId: string;
  companyName: string;
  address: CompanyAddress;
  country: string;
  status: OrganizationStatus;
  ownerUserId: string | null;
  subAccountSeq: number;
  employeeSeq: number;
  createdAt: string;
  updatedAt: string;
}

export interface FacilityDto {
  id: string;
  organizationId: string;
  corporateCustomerId: string;
  name: string;
  country: string;
  state: string;
  city: string;
  address: string;
  timezone: string;
  contactPhone: string;
  contactEmail: string;
  status: FacilityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFacilityInput {
  name: string;
  country: string;
  state?: string;
  city?: string;
  address?: string;
  timezone?: string;
  contactPhone?: string;
  contactEmail?: string;
  status?: FacilityStatus;
}

export interface UpdateFacilityInput extends Partial<CreateFacilityInput> {}

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  mobile?: string;
  country?: string;
  facilityId: string;
  /** facility_admin | doctor */
  role: 'facility_admin' | 'doctor';
  designation?: string;
  department?: string;
}

export interface CreateSubAccountInput {
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  mobile?: string;
  countryCode?: string;
  practiceName?: string;
  remarks?: string;
  facilityId?: string;
  /** Required when Main Admin creates on behalf of a company. */
  organizationId?: string;
  /** Active after verify; inactive until then unless set inactive explicitly. */
  activateAfterVerify?: boolean;
}

export interface CorporateDashboardDto {
  organization: OrganizationDto;
  facilityCount: number;
  employeeCount: number;
  subAccountCount: number;
  openCaseCount: number;
  facilities: FacilityDto[];
}

export interface UpdateOrganizationInput {
  companyName?: string;
  address?: Partial<CompanyAddress>;
  country?: string;
  status?: OrganizationStatus;
}

/** Format corporate customer id: C134789 */
export function formatCorporateCustomerId(seq: number): string {
  return `C${seq}`;
}

/** Format sub-account id: 001_C134789 (seq never reused). */
export function formatSubAccountId(seq: number, corporateCustomerId: string): string {
  return `${String(seq).padStart(3, '0')}_${corporateCustomerId}`;
}

/** Format employee id: EMP-00000001 */
export function formatEmployeeId(seq: number): string {
  return `EMP-${String(seq).padStart(8, '0')}`;
}
