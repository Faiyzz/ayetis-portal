import type {
  CorporateDashboardDto,
  CreateEmployeeInput,
  CreateFacilityInput,
  CreateSubAccountInput,
  FacilityDto,
  OrganizationDto,
  PublicUser,
  UpdateFacilityInput,
  UpdateOrganizationInput,
} from '@ayetis/shared';
import api from '@/lib/api';

export async function fetchCorporateDashboard(organizationId?: string) {
  const { data } = await api.get('/corporate/dashboard', {
    params: organizationId ? { organizationId } : undefined,
  });
  return data.data as CorporateDashboardDto;
}

export async function fetchOrganization(organizationId?: string) {
  const { data } = await api.get('/corporate/organization', {
    params: organizationId ? { organizationId } : undefined,
  });
  return data.data as OrganizationDto;
}

export async function updateOrganization(
  input: UpdateOrganizationInput,
  organizationId?: string,
) {
  const { data } = await api.patch('/corporate/organization', input, {
    params: organizationId ? { organizationId } : undefined,
  });
  return data.data as OrganizationDto;
}

export async function fetchOrganizations() {
  const { data } = await api.get('/corporate/organizations');
  return data.data as OrganizationDto[];
}

export async function fetchFacilities(organizationId?: string) {
  const { data } = await api.get('/corporate/facilities', {
    params: organizationId ? { organizationId } : undefined,
  });
  return data.data as FacilityDto[];
}

export async function createFacility(input: CreateFacilityInput, organizationId?: string) {
  const { data } = await api.post('/corporate/facilities', input, {
    params: organizationId ? { organizationId } : undefined,
  });
  return data.data as FacilityDto;
}

export async function updateFacility(facilityId: string, input: UpdateFacilityInput) {
  const { data } = await api.patch(`/corporate/facilities/${facilityId}`, input);
  return data.data as FacilityDto;
}

export async function fetchEmployees(organizationId?: string) {
  const { data } = await api.get('/corporate/employees', {
    params: organizationId ? { organizationId } : undefined,
  });
  return data.data as PublicUser[];
}

export async function createEmployee(input: CreateEmployeeInput, organizationId?: string) {
  const { data } = await api.post('/corporate/employees', input, {
    params: organizationId ? { organizationId } : undefined,
  });
  return data.data as { user: PublicUser; temporaryPassword?: string };
}

export async function setEmployeeStatus(
  userId: string,
  accountStatus: 'active' | 'suspended' | 'blocked',
) {
  const { data } = await api.patch(`/corporate/employees/${userId}/status`, { accountStatus });
  return data.data as PublicUser;
}

export async function fetchSubAccounts(organizationId?: string) {
  const { data } = await api.get('/corporate/subaccounts', {
    params: organizationId ? { organizationId } : undefined,
  });
  return data.data as PublicUser[];
}

export async function createSubAccount(input: CreateSubAccountInput) {
  const { data } = await api.post('/corporate/subaccounts', input);
  return data.data as { user: PublicUser; verifyUrl?: string };
}

export async function verifySubAccount(token: string) {
  const { data } = await api.post('/corporate/subaccounts/verify', { token });
  return data.data as {
    message: string;
    subAccountId: string;
    temporaryPassword?: string;
  };
}
