import type {
  BrandingConfigDto,
  BrandingLogoSlot,
  BusinessConfigDto,
  CountryDto,
  CountryRequestDto,
  CountryRequestStatus,
  EmailTemplateDto,
  MasterListItemDto,
  MasterListType,
  PrivacyPolicyDto,
  RegionDto,
  SlaConfigDto,
  SystemMessages,
} from '@ayetis/shared';
import api from '@/lib/api';

const multipartConfig = {
  headers: { 'Content-Type': 'multipart/form-data' as const },
  transformRequest: [
    (body: unknown, headers: Record<string, string>) => {
      if (body instanceof FormData) {
        delete headers['Content-Type'];
      }
      return body;
    },
  ],
};

export async function fetchBranding(): Promise<BrandingConfigDto> {
  const { data } = await api.get('/settings/branding');
  return data.data;
}

export async function fetchBusinessConfig(): Promise<BusinessConfigDto> {
  const { data } = await api.get('/settings/business-config');
  return data.data;
}

export async function fetchSlaConfig(): Promise<SlaConfigDto> {
  const { data } = await api.get('/settings/sla');
  return data.data;
}

export async function patchSlaConfig(
  payload: Partial<Pick<SlaConfigDto, 'hoursBySegment' | 'warningPercent'>> & {
    hoursBySegment?: Partial<SlaConfigDto['hoursBySegment']>;
  },
): Promise<SlaConfigDto> {
  const { data } = await api.patch('/settings/sla', payload);
  return data.data;
}

export async function fetchCurrentPrivacy(): Promise<PrivacyPolicyDto | null> {
  const { data } = await api.get('/settings/privacy/current');
  return data.data;
}

export async function fetchMasterListItems(
  type: MasterListType,
  activeOnly = false,
): Promise<MasterListItemDto[]> {
  const { data } = await api.get(`/settings/lists/${type}`, {
    params: { activeOnly: activeOnly ? 'true' : 'false' },
  });
  return data.data;
}

export async function fetchCountries(activeOnly = false): Promise<CountryDto[]> {
  const { data } = await api.get('/settings/countries', {
    params: { activeOnly: activeOnly ? 'true' : 'false' },
  });
  return data.data;
}

export async function fetchRegions(): Promise<RegionDto[]> {
  const { data } = await api.get('/settings/regions');
  return data.data;
}

export async function fetchSystemMessages(): Promise<SystemMessages> {
  const { data } = await api.get('/settings/messages');
  return data.data;
}

export async function updateSystemMessages(payload: Partial<SystemMessages>): Promise<SystemMessages> {
  const { data } = await api.patch('/settings/messages', payload);
  return data.data;
}

export async function upsertMasterListItem(payload: {
  id?: string;
  type: MasterListType;
  label: string;
  code?: string | null;
  sortOrder?: number;
  parentId?: string | null;
  isActive?: boolean;
  metadata?: Record<string, string>;
}): Promise<MasterListItemDto> {
  const { data } = await api.post('/settings/lists', payload);
  return data.data;
}

export async function upsertRegion(payload: {
  id?: string;
  code: string;
  name: string;
  isActive?: boolean;
}): Promise<RegionDto> {
  const { data } = await api.post('/settings/regions', payload);
  return data.data;
}

export async function upsertCountry(payload: {
  id?: string;
  code: string;
  name: string;
  dialCode?: string | null;
  regionId?: string | null;
  isActive?: boolean;
}): Promise<CountryDto> {
  const { data } = await api.post('/settings/countries', payload);
  return data.data;
}

export async function fetchCountryRequests(
  status?: CountryRequestStatus,
): Promise<CountryRequestDto[]> {
  const { data } = await api.get('/settings/country-requests', {
    params: status ? { status } : undefined,
  });
  return data.data;
}

export async function reviewCountryRequest(
  id: string,
  payload: {
    status: 'approved' | 'rejected';
    regionId?: string | null;
    reviewNotes?: string;
    dialCode?: string | null;
  },
): Promise<CountryRequestDto> {
  const { data } = await api.post(`/settings/country-requests/${id}/review`, payload);
  return data.data;
}

export async function updateBranding(payload: {
  companyName?: string;
  notificationEmails?: string[];
}): Promise<BrandingConfigDto> {
  const { data } = await api.patch('/settings/branding', payload);
  return data.data;
}

export async function uploadBrandingLogo(
  slot: BrandingLogoSlot,
  file: File,
): Promise<BrandingConfigDto> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post(`/settings/branding/logos/${slot}`, formData, multipartConfig);
  return data.data;
}

export async function patchBusinessConfig(
  payload: Partial<BusinessConfigDto>,
): Promise<BusinessConfigDto> {
  const { data } = await api.patch('/settings/business-config', payload);
  return data.data;
}

export async function fetchEmailTemplates(): Promise<EmailTemplateDto[]> {
  const { data } = await api.get('/settings/email-templates');
  return data.data;
}

export async function upsertEmailTemplate(payload: {
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
  placeholders?: string[];
}): Promise<EmailTemplateDto> {
  const { data } = await api.post('/settings/email-templates', payload);
  return data.data;
}

export async function fetchPrivacyHistory(): Promise<PrivacyPolicyDto[]> {
  const { data } = await api.get('/settings/privacy/history');
  return data.data;
}

export async function publishPrivacyPolicy(payload: {
  version: string;
  bodyHtml: string;
}): Promise<PrivacyPolicyDto> {
  const { data } = await api.post('/settings/privacy/publish', payload);
  return data.data;
}

export async function updateCustomerScope(payload: {
  subjectType: 'user' | 'organization';
  subjectId: string;
  preferredCurrency?: string;
  regionIds?: string[];
  scopedCountryIds?: string[];
  excludedCountryIds?: string[];
}): Promise<{ success: boolean }> {
  const { data } = await api.put('/settings/customer-scope', payload);
  return data.data;
}
