import {
  AUDIT_ACTIONS,
  COUNTRIES,
  COUNTRY_REQUEST_STATUSES,
  DEFAULT_CASE_SUBMISSION_TABS,
  DEFAULT_EMAIL_TEMPLATE_DEFS,
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_REGIONS,
  DEFAULT_REPORT_VISIBILITY,
  DEFAULT_REQUIRED_FIELDS,
  DEFAULT_SLA_HOURS_BY_SEGMENT,
  DEFAULT_SLA_WARNING_PERCENT,
  GENDER_OPTIONS,
  MASTER_LIST_TYPES,
  hoursForSlaSegment,
  mergeTemplatePlaceholders,
  resolveSlaAccountSegment,
  type BrandingConfigDto,
  type BusinessConfigDto,
  type CountryDto,
  type CountryRequestDto,
  type EmailTemplateDto,
  type MasterListItemDto,
  type MasterListType,
  type PrivacyPolicyDto,
  type RegionDto,
  type SlaConfigDto,
} from '@ayetis/shared';
import { env } from '../../config/env';
import path from 'path';
import {
  BusinessConfig,
  Country,
  CountryRequest,
  EmailTemplate,
  MasterListItem,
  PrivacyPolicy,
  Region,
  type IBusinessConfig,
  type ICountry,
  type IMasterListItem,
  type IRegion,
} from '../../models/Settings';
import { Organization } from '../../models/Organization';
import { User } from '../../models/User';
import { AppError } from '../../utils/AppError';
import {
  createSignedFileAccess,
  openStoredReadStream,
  persistUploadedFile,
} from '../../services/storage.service';
import {
  recordActivity,
  type RequestAuditContext,
} from '../audit/audit.service';
import { getSystemMessages, updateSystemMessages } from '../../models/SystemConfig';

let uploadBytesCache: { value: number; at: number } | null = null;
const UPLOAD_CACHE_MS = 30_000;

function listDto(doc: IMasterListItem): MasterListItemDto {
  return {
    id: doc.id,
    type: doc.type,
    code: doc.code ?? null,
    label: doc.label,
    sortOrder: doc.sortOrder ?? 0,
    parentId: doc.parentId ? String(doc.parentId) : null,
    isActive: doc.isActive,
    metadata: (doc.metadata ?? {}) as Record<string, string>,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function regionDto(doc: IRegion): Promise<RegionDto> {
  const countryCount = await Country.countDocuments({ regionId: doc._id });
  return {
    id: doc.id,
    code: doc.code,
    name: doc.name,
    isActive: doc.isActive,
    countryCount,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function countryDto(doc: ICountry): Promise<CountryDto> {
  let regionCode: string | null = null;
  let regionName: string | null = null;
  if (doc.regionId) {
    const region = await Region.findById(doc.regionId);
    regionCode = region?.code ?? null;
    regionName = region?.name ?? null;
  }
  return {
    id: doc.id,
    code: doc.code,
    name: doc.name,
    dialCode: doc.dialCode ?? null,
    regionId: doc.regionId ? String(doc.regionId) : null,
    regionCode,
    regionName,
    isActive: doc.isActive,
    isOther: Boolean(doc.isOther),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function slugCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

export async function seedSettingsData(): Promise<void> {
  for (const region of DEFAULT_REGIONS) {
    await Region.findOneAndUpdate(
      { code: region.code },
      { $setOnInsert: { code: region.code, name: region.name, isActive: true } },
      { upsert: true },
    );
  }

  const cemEA = await Region.findOne({ code: 'CEMEA' });
  const nam = await Region.findOne({ code: 'NAM' });
  const apac = await Region.findOne({ code: 'APAC' });
  const weU = await Region.findOne({ code: 'WEU' });
  const latam = await Region.findOne({ code: 'LATAM' });

  const regionFor = (name: string) => {
    if (['United States', 'Canada', 'Mexico'].includes(name)) return nam?._id;
    if (
      [
        'Brazil',
        'Argentina',
        'Chile',
        'Colombia',
      ].includes(name)
    ) {
      return latam?._id;
    }
    if (
      [
        'China',
        'Japan',
        'India',
        'Singapore',
        'Australia',
        'New Zealand',
        'Indonesia',
        'Malaysia',
        'Thailand',
        'Vietnam',
        'Philippines',
        'South Korea',
        'Taiwan',
        'Hong Kong',
      ].includes(name)
    ) {
      return apac?._id;
    }
    if (
      [
        'United Kingdom',
        'France',
        'Germany',
        'Spain',
        'Italy',
        'Netherlands',
        'Belgium',
        'Switzerland',
        'Austria',
        'Ireland',
        'Portugal',
        'Sweden',
        'Norway',
        'Denmark',
        'Finland',
        'Luxembourg',
      ].includes(name)
    ) {
      return weU?._id;
    }
    return cemEA?._id;
  };

  for (const name of COUNTRIES) {
    const code = slugCode(name);
    await Country.findOneAndUpdate(
      { code },
      {
        $setOnInsert: {
          code,
          name,
          regionId: regionFor(name),
          isActive: true,
          isOther: false,
          dialCode: undefined,
        },
      },
      { upsert: true },
    );
  }

  await Country.findOneAndUpdate(
    { code: 'OTHER' },
    {
      $setOnInsert: {
        code: 'OTHER',
        name: 'Other',
        isOther: true,
        isActive: true,
      },
    },
    { upsert: true },
  );

  let sort = 0;
  for (const g of GENDER_OPTIONS) {
    await MasterListItem.findOneAndUpdate(
      { type: MASTER_LIST_TYPES.GENDER, label: g.label },
      {
        $setOnInsert: {
          type: MASTER_LIST_TYPES.GENDER,
          code: slugCode(g.value),
          label: g.label,
          sortOrder: sort++,
          isActive: true,
        },
      },
      { upsert: true },
    );
  }

  const languages = ['English', 'Arabic', 'French', 'Spanish', 'German', 'Portuguese', 'Chinese'];
  sort = 0;
  for (const label of languages) {
    await MasterListItem.findOneAndUpdate(
      { type: MASTER_LIST_TYPES.LANGUAGE, label },
      {
        $setOnInsert: {
          type: MASTER_LIST_TYPES.LANGUAGE,
          code: slugCode(label),
          label,
          sortOrder: sort++,
          isActive: true,
        },
      },
      { upsert: true },
    );
  }

  const professions = ['Dentist', 'Orthodontist', 'Oral Surgeon', 'Lab Technician', 'Other'];
  sort = 0;
  for (const label of professions) {
    await MasterListItem.findOneAndUpdate(
      { type: MASTER_LIST_TYPES.PROFESSION, label },
      {
        $setOnInsert: {
          type: MASTER_LIST_TYPES.PROFESSION,
          code: slugCode(label),
          label,
          sortOrder: sort++,
          isActive: true,
        },
      },
      { upsert: true },
    );
  }

  const titles = ['Dr', 'Prof', 'Mr', 'Mrs', 'Ms', 'Other'];
  sort = 0;
  for (const label of titles) {
    await MasterListItem.findOneAndUpdate(
      { type: MASTER_LIST_TYPES.ACADEMIC_TITLE, label },
      {
        $setOnInsert: {
          type: MASTER_LIST_TYPES.ACADEMIC_TITLE,
          code: slugCode(label),
          label,
          sortOrder: sort++,
          isActive: true,
        },
      },
      { upsert: true },
    );
  }

  for (const tpl of DEFAULT_EMAIL_TEMPLATE_DEFS) {
    await EmailTemplate.findOneAndUpdate(
      { key: tpl.key },
      {
        $setOnInsert: {
          key: tpl.key,
          name: tpl.name,
          subject: tpl.subject,
          htmlBody: tpl.htmlBody,
          placeholders: tpl.placeholders,
        },
      },
      { upsert: true },
    );
  }

  const currentPrivacy = await PrivacyPolicy.findOne({ isCurrent: true });
  if (!currentPrivacy) {
    await PrivacyPolicy.create({
      version: '1.0',
      bodyHtml:
        '<h1>Privacy Notice</h1><p>Ayetis processes personal and clinical data to provide digital treatment planning services. By registering you agree to our processing of account and case data in accordance with applicable law.</p>',
      publishedAt: new Date(),
      isCurrent: true,
      publishedByEmail: 'system',
    });
  }

  await BusinessConfig.findOneAndUpdate(
    { key: 'default' },
    {
      $setOnInsert: {
        key: 'default',
        companyName: 'Ayetis Portal',
        logos: {},
        notificationEmails: [],
        maxUploadBytes: DEFAULT_MAX_UPLOAD_BYTES,
        requiredFields: { ...DEFAULT_REQUIRED_FIELDS },
        caseSubmissionTabs: { ...DEFAULT_CASE_SUBMISSION_TABS },
        reportVisibility: { ...DEFAULT_REPORT_VISIBILITY },
        sla: {
          hoursBySegment: { ...DEFAULT_SLA_HOURS_BY_SEGMENT },
          warningPercent: DEFAULT_SLA_WARNING_PERCENT,
        },
      },
    },
    { upsert: true },
  );

  await getSystemMessages();
}

async function getBusinessConfigDoc(): Promise<IBusinessConfig> {
  const doc = await BusinessConfig.findOneAndUpdate(
    { key: 'default' },
    {
      $setOnInsert: {
        key: 'default',
        companyName: 'Ayetis Portal',
        maxUploadBytes: DEFAULT_MAX_UPLOAD_BYTES,
        requiredFields: { ...DEFAULT_REQUIRED_FIELDS },
        caseSubmissionTabs: { ...DEFAULT_CASE_SUBMISSION_TABS },
        reportVisibility: { ...DEFAULT_REPORT_VISIBILITY },
        sla: {
          hoursBySegment: { ...DEFAULT_SLA_HOURS_BY_SEGMENT },
          warningPercent: DEFAULT_SLA_WARNING_PERCENT,
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc;
}

async function logoUrl(storageKey?: string | null): Promise<string | null> {
  if (!storageKey) return null;
  try {
    const signed = await createSignedFileAccess({
      storageKey,
      originalName: path.basename(storageKey),
      mimeType: 'image/*',
      ttlSeconds: 3600,
    });
    return signed.url;
  } catch {
    return `/api/settings/branding/asset?key=${encodeURIComponent(storageKey)}`;
  }
}

export async function getBranding(): Promise<BrandingConfigDto> {
  const doc = await getBusinessConfigDoc();
  return {
    companyName: doc.companyName || 'Ayetis Portal',
    loginLogoUrl: await logoUrl(doc.logos?.login),
    headerLogoUrl: await logoUrl(doc.logos?.header),
    footerLogoUrl: await logoUrl(doc.logos?.footer),
    emailLogoUrl: await logoUrl(doc.logos?.email),
    notificationEmails: doc.notificationEmails ?? [],
    updatedAt: doc.updatedAt?.toISOString() ?? null,
  };
}

export async function getBusinessConfig(): Promise<BusinessConfigDto> {
  const doc = await getBusinessConfigDoc();
  return {
    maxUploadBytes: doc.maxUploadBytes || DEFAULT_MAX_UPLOAD_BYTES,
    requiredFields: { ...DEFAULT_REQUIRED_FIELDS, ...(doc.requiredFields ?? {}) },
    caseSubmissionTabs: {
      ...DEFAULT_CASE_SUBMISSION_TABS,
      ...(doc.caseSubmissionTabs ?? {}),
    },
    reportVisibility: { ...DEFAULT_REPORT_VISIBILITY, ...(doc.reportVisibility ?? {}) },
    sessionIdleTimeoutMinutes:
      doc.sessionIdleTimeoutMinutes != null && Number.isFinite(doc.sessionIdleTimeoutMinutes)
        ? Math.max(0, Math.floor(doc.sessionIdleTimeoutMinutes))
        : env.sessionIdleTimeoutMinutes,
    loginMaxFailedAttempts:
      doc.loginMaxFailedAttempts != null && Number.isFinite(doc.loginMaxFailedAttempts)
        ? Math.max(1, Math.floor(doc.loginMaxFailedAttempts))
        : env.loginMaxFailedAttempts,
    loginLockoutMinutes:
      doc.loginLockoutMinutes != null && Number.isFinite(doc.loginLockoutMinutes)
        ? Math.max(1, Math.floor(doc.loginLockoutMinutes))
        : env.loginLockoutMinutes,
    updatedAt: doc.updatedAt?.toISOString() ?? null,
  };
}

export async function resolveMaxUploadBytes(): Promise<number> {
  const now = Date.now();
  if (uploadBytesCache && now - uploadBytesCache.at < UPLOAD_CACHE_MS) {
    return uploadBytesCache.value;
  }
  try {
    const cfg = await getBusinessConfig();
    const value = cfg.maxUploadBytes || env.maxUploadBytes || DEFAULT_MAX_UPLOAD_BYTES;
    uploadBytesCache = { value, at: now };
    return value;
  } catch {
    return env.maxUploadBytes || DEFAULT_MAX_UPLOAD_BYTES;
  }
}

export function invalidateUploadBytesCache() {
  uploadBytesCache = null;
}

export async function updateBranding(
  input: {
    companyName?: string;
    notificationEmails?: string[];
  },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
): Promise<BrandingConfigDto> {
  const doc = await getBusinessConfigDoc();
  if (input.companyName !== undefined) doc.companyName = input.companyName.trim() || 'Ayetis Portal';
  if (input.notificationEmails) {
    doc.notificationEmails = input.notificationEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  }
  await doc.save();
  await recordActivity({
    action: AUDIT_ACTIONS.BRANDING_UPDATE,
    summary: `${actor.email} updated branding`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });
  return getBranding();
}

export async function updateBusinessConfig(
  input: Partial<BusinessConfigDto>,
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
): Promise<BusinessConfigDto> {
  const doc = await getBusinessConfigDoc();
  if (input.maxUploadBytes != null && input.maxUploadBytes >= 1024 * 1024) {
    doc.maxUploadBytes = input.maxUploadBytes;
  }
  if (input.requiredFields) doc.requiredFields = { ...doc.requiredFields, ...input.requiredFields };
  if (input.caseSubmissionTabs) {
    doc.caseSubmissionTabs = { ...doc.caseSubmissionTabs, ...input.caseSubmissionTabs };
  }
  if (input.reportVisibility) {
    doc.reportVisibility = { ...doc.reportVisibility, ...input.reportVisibility };
  }
  if (input.sessionIdleTimeoutMinutes != null && Number.isFinite(input.sessionIdleTimeoutMinutes)) {
    doc.sessionIdleTimeoutMinutes = Math.max(0, Math.floor(input.sessionIdleTimeoutMinutes));
  }
  if (input.loginMaxFailedAttempts != null && Number.isFinite(input.loginMaxFailedAttempts)) {
    doc.loginMaxFailedAttempts = Math.max(1, Math.floor(input.loginMaxFailedAttempts));
  }
  if (input.loginLockoutMinutes != null && Number.isFinite(input.loginLockoutMinutes)) {
    doc.loginLockoutMinutes = Math.max(1, Math.floor(input.loginLockoutMinutes));
  }
  await doc.save();
  invalidateUploadBytesCache();
  await recordActivity({
    action: AUDIT_ACTIONS.BUSINESS_CONFIG_UPDATE,
    summary: `${actor.email} updated business configuration`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });
  return getBusinessConfig();
}

export async function getSlaConfig(): Promise<SlaConfigDto> {
  const doc = await getBusinessConfigDoc();
  const hours = {
    ...DEFAULT_SLA_HOURS_BY_SEGMENT,
    ...(doc.sla?.hoursBySegment ?? {}),
  };
  return {
    hoursBySegment: {
      individual: hoursForSlaSegment('individual', hours),
      company: hoursForSlaSegment('company', hours),
      sub_account: hoursForSlaSegment('sub_account', hours),
    },
    warningPercent:
      doc.sla?.warningPercent != null && Number.isFinite(doc.sla.warningPercent)
        ? Math.min(100, Math.max(1, Math.floor(doc.sla.warningPercent)))
        : DEFAULT_SLA_WARNING_PERCENT,
    updatedAt: doc.updatedAt?.toISOString() ?? null,
  };
}

export async function updateSlaConfig(
  input: {
    hoursBySegment?: Partial<SlaConfigDto['hoursBySegment']>;
    warningPercent?: number;
  },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
): Promise<SlaConfigDto> {
  const doc = await getBusinessConfigDoc();
  const current = await getSlaConfig();
  const nextHours = { ...current.hoursBySegment };
  if (input.hoursBySegment) {
    for (const key of ['individual', 'company', 'sub_account'] as const) {
      const value = input.hoursBySegment[key];
      if (value != null && Number.isFinite(value) && value >= 1 && value <= 24 * 30) {
        nextHours[key] = Math.floor(value);
      }
    }
  }
  let warningPercent = current.warningPercent;
  if (input.warningPercent != null && Number.isFinite(input.warningPercent)) {
    warningPercent = Math.min(100, Math.max(1, Math.floor(input.warningPercent)));
  }
  doc.sla = {
    hoursBySegment: nextHours,
    warningPercent,
  };
  await doc.save();
  await recordActivity({
    action: AUDIT_ACTIONS.SLA_CONFIG_UPDATE,
    summary: `${actor.email} updated SLA defaults (I:${nextHours.individual}h C:${nextHours.company}h S:${nextHours.sub_account}h warn@${warningPercent}%)`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
    metadata: { hoursBySegment: nextHours, warningPercent },
  });
  return getSlaConfig();
}

/**
 * Resolve SLA business hours for a doctor: per-user override → account-type default → 48h.
 */
export async function resolveSlaHoursForUser(user: {
  slaBusinessHours?: number | null;
  accountType?: string | null;
  subAccountId?: string | null;
}): Promise<number> {
  if (
    user.slaBusinessHours != null &&
    Number.isFinite(user.slaBusinessHours) &&
    user.slaBusinessHours >= 1
  ) {
    return Math.floor(user.slaBusinessHours);
  }
  const cfg = await getSlaConfig();
  const segment = resolveSlaAccountSegment({
    accountType: user.accountType,
    subAccountId: user.subAccountId,
  });
  return hoursForSlaSegment(segment, cfg.hoursBySegment);
}

export async function uploadBrandingLogo(
  slot: 'login' | 'header' | 'footer' | 'email',
  file: { buffer?: Buffer; tempPath?: string; mimetype: string; originalname: string },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
): Promise<BrandingConfigDto> {
  const saved = await persistUploadedFile({
    caseId: `branding-${slot}`,
    originalName: file.originalname,
    mimeType: file.mimetype,
    buffer: file.buffer,
    tempPath: file.tempPath,
  });
  const doc = await getBusinessConfigDoc();
  doc.logos = { ...(doc.logos ?? {}), [slot]: saved.storageKey };
  await doc.save();
  await recordActivity({
    action: AUDIT_ACTIONS.BRANDING_UPDATE,
    summary: `${actor.email} uploaded ${slot} logo`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });
  return getBranding();
}

export async function streamBrandingAsset(storageKey: string) {
  return openStoredReadStream(storageKey);
}

export async function listMasterItems(type: MasterListType, activeOnly = false) {
  const filter: Record<string, unknown> = { type };
  if (activeOnly) filter.isActive = true;
  const items = await MasterListItem.find(filter).sort({ sortOrder: 1, label: 1 });
  return items.map(listDto);
}

export async function upsertMasterItem(
  input: {
    id?: string;
    type: MasterListType;
    label: string;
    code?: string | null;
    sortOrder?: number;
    parentId?: string | null;
    isActive?: boolean;
    metadata?: Record<string, string>;
  },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
) {
  let doc = input.id ? await MasterListItem.findById(input.id) : null;
  if (input.id && !doc) throw new AppError('Master list item not found', 404);
  if (!doc) {
    doc = new MasterListItem({ type: input.type, label: input.label.trim() });
  }
  doc.type = input.type;
  doc.label = input.label.trim();
  doc.code = input.code ? slugCode(input.code) : slugCode(input.label);
  if (input.sortOrder !== undefined) doc.sortOrder = input.sortOrder;
  doc.parentId = input.parentId ? (input.parentId as never) : undefined;
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  if (input.metadata) doc.metadata = input.metadata;
  await doc.save();
  await recordActivity({
    action: AUDIT_ACTIONS.MASTER_LIST_UPSERT,
    summary: `${actor.email} saved ${input.type} "${doc.label}"`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });
  return listDto(doc);
}

export async function listRegions() {
  const items = await Region.find().sort({ name: 1 });
  return Promise.all(items.map(regionDto));
}

export async function upsertRegion(
  input: { id?: string; code: string; name: string; isActive?: boolean },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
) {
  let doc = input.id ? await Region.findById(input.id) : await Region.findOne({ code: slugCode(input.code) });
  if (input.id && !doc) throw new AppError('Region not found', 404);
  if (!doc) doc = new Region({ code: slugCode(input.code), name: input.name });
  doc.code = slugCode(input.code);
  doc.name = input.name.trim();
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  await doc.save();
  await recordActivity({
    action: AUDIT_ACTIONS.REGION_UPSERT,
    summary: `${actor.email} saved region ${doc.code}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });
  return regionDto(doc);
}

export async function listCountries(activeOnly = false) {
  const filter: Record<string, unknown> = {};
  if (activeOnly) filter.isActive = true;
  const items = await Country.find(filter).sort({ name: 1 });
  return Promise.all(items.map(countryDto));
}

export async function upsertCountry(
  input: {
    id?: string;
    code: string;
    name: string;
    dialCode?: string | null;
    regionId?: string | null;
    isActive?: boolean;
  },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
) {
  let doc = input.id
    ? await Country.findById(input.id)
    : await Country.findOne({ code: slugCode(input.code) });
  if (input.id && !doc) throw new AppError('Country not found', 404);
  if (!doc) doc = new Country({ code: slugCode(input.code), name: input.name });
  doc.code = slugCode(input.code);
  doc.name = input.name.trim();
  doc.dialCode = input.dialCode ?? undefined;
  doc.regionId = input.regionId ? (input.regionId as never) : undefined;
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  await doc.save();
  await recordActivity({
    action: AUDIT_ACTIONS.COUNTRY_UPSERT,
    summary: `${actor.email} saved country ${doc.name}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });
  return countryDto(doc);
}

export async function createCountryRequest(input: {
  proposedName: string;
  registrationId?: string;
  requesterEmail?: string;
}) {
  const doc = await CountryRequest.create({
    proposedName: input.proposedName.trim(),
    status: COUNTRY_REQUEST_STATUSES.PENDING,
    registrationId: input.registrationId || undefined,
    requesterEmail: input.requesterEmail,
  });
  return {
    id: doc.id,
    proposedName: doc.proposedName,
    status: doc.status,
    registrationId: doc.registrationId ? String(doc.registrationId) : null,
    requesterEmail: doc.requesterEmail ?? null,
    regionId: null,
    createdCountryId: null,
    reviewNotes: null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  } satisfies CountryRequestDto;
}

export async function listCountryRequests(status?: string) {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  const items = await CountryRequest.find(filter).sort({ createdAt: -1 });
  return items.map(
    (doc): CountryRequestDto => ({
      id: doc.id,
      proposedName: doc.proposedName,
      status: doc.status,
      registrationId: doc.registrationId ? String(doc.registrationId) : null,
      requesterEmail: doc.requesterEmail ?? null,
      regionId: doc.regionId ? String(doc.regionId) : null,
      createdCountryId: doc.createdCountryId ? String(doc.createdCountryId) : null,
      reviewNotes: doc.reviewNotes ?? null,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    }),
  );
}

export async function reviewCountryRequest(
  id: string,
  input: {
    status: 'approved' | 'rejected';
    regionId?: string | null;
    reviewNotes?: string;
    dialCode?: string | null;
  },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
) {
  const doc = await CountryRequest.findById(id);
  if (!doc) throw new AppError('Country request not found', 404);
  if (doc.status !== COUNTRY_REQUEST_STATUSES.PENDING) {
    throw new AppError('Request already reviewed', 400);
  }

  doc.status = input.status;
  doc.reviewNotes = input.reviewNotes;
  doc.reviewedById = actor.id as never;
  doc.regionId = input.regionId ? (input.regionId as never) : undefined;

  if (input.status === COUNTRY_REQUEST_STATUSES.APPROVED) {
    const code = slugCode(doc.proposedName);
    const country = await Country.findOneAndUpdate(
      { code },
      {
        $set: {
          name: doc.proposedName,
          regionId: input.regionId || undefined,
          dialCode: input.dialCode || undefined,
          isActive: true,
          isOther: false,
        },
        $setOnInsert: { code },
      },
      { upsert: true, new: true },
    );
    doc.createdCountryId = country._id;
  }

  await doc.save();
  await recordActivity({
    action: AUDIT_ACTIONS.COUNTRY_REQUEST_REVIEW,
    summary: `${actor.email} ${input.status} country request "${doc.proposedName}"`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });
  return (await listCountryRequests()).find((r) => r.id === doc.id)!;
}

export async function listEmailTemplates(): Promise<EmailTemplateDto[]> {
  const items = await EmailTemplate.find().sort({ name: 1 });
  return items.map((doc) => ({
    id: doc.id,
    key: doc.key,
    name: doc.name,
    subject: doc.subject,
    htmlBody: doc.htmlBody,
    placeholders: doc.placeholders ?? [],
    updatedAt: doc.updatedAt.toISOString(),
    updatedByEmail: doc.updatedByEmail ?? null,
  }));
}

export async function upsertEmailTemplate(
  input: { key: string; name: string; subject: string; htmlBody: string; placeholders?: string[] },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
) {
  const key = input.key.trim().toLowerCase();
  const doc = await EmailTemplate.findOneAndUpdate(
    { key },
    {
      $set: {
        name: input.name.trim(),
        subject: input.subject,
        htmlBody: input.htmlBody,
        placeholders: input.placeholders ?? [],
        updatedById: actor.id,
        updatedByEmail: actor.email,
      },
      $setOnInsert: { key },
    },
    { upsert: true, new: true },
  );
  await recordActivity({
    action: AUDIT_ACTIONS.EMAIL_TEMPLATE_UPSERT,
    summary: `${actor.email} saved email template ${key}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });
  return (await listEmailTemplates()).find((t) => t.id === doc.id)!;
}

export async function renderEmailTemplate(
  key: string,
  vars: Record<string, string>,
): Promise<{ subject: string; html: string } | null> {
  const doc = await EmailTemplate.findOne({ key: key.toLowerCase() });
  if (!doc?.subject || !doc.htmlBody) return null;
  return {
    subject: mergeTemplatePlaceholders(doc.subject, vars),
    html: mergeTemplatePlaceholders(doc.htmlBody, vars),
  };
}

export async function getCurrentPrivacy(): Promise<PrivacyPolicyDto | null> {
  const doc = await PrivacyPolicy.findOne({ isCurrent: true }).sort({ publishedAt: -1 });
  if (!doc) return null;
  return {
    id: doc.id,
    version: doc.version,
    bodyHtml: doc.bodyHtml,
    publishedAt: doc.publishedAt.toISOString(),
    publishedByEmail: doc.publishedByEmail ?? null,
    isCurrent: true,
  };
}

export async function listPrivacyHistory(): Promise<PrivacyPolicyDto[]> {
  const items = await PrivacyPolicy.find().sort({ publishedAt: -1 });
  return items.map((doc) => ({
    id: doc.id,
    version: doc.version,
    bodyHtml: doc.bodyHtml,
    publishedAt: doc.publishedAt.toISOString(),
    publishedByEmail: doc.publishedByEmail ?? null,
    isCurrent: Boolean(doc.isCurrent),
  }));
}

export async function publishPrivacyPolicy(
  input: { version: string; bodyHtml: string },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
) {
  await PrivacyPolicy.updateMany({ isCurrent: true }, { $set: { isCurrent: false } });
  const doc = await PrivacyPolicy.create({
    version: input.version.trim(),
    bodyHtml: input.bodyHtml,
    publishedAt: new Date(),
    publishedById: actor.id,
    publishedByEmail: actor.email,
    isCurrent: true,
  });
  await recordActivity({
    action: AUDIT_ACTIONS.PRIVACY_POLICY_PUBLISH,
    summary: `${actor.email} published privacy policy ${doc.version}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: doc.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });
  return getCurrentPrivacy();
}

export async function updateCustomerScope(
  input: {
    subjectType: 'user' | 'organization';
    subjectId: string;
    preferredCurrency?: string;
    regionIds?: string[];
    scopedCountryIds?: string[];
    excludedCountryIds?: string[];
  },
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
) {
  if (input.subjectType === 'organization') {
    const org = await Organization.findById(input.subjectId);
    if (!org) throw new AppError('Organization not found', 404);
    if (input.preferredCurrency) org.preferredCurrency = input.preferredCurrency.toUpperCase();
    if (input.regionIds) org.regionIds = input.regionIds as never;
    if (input.scopedCountryIds) org.scopedCountryIds = input.scopedCountryIds as never;
    if (input.excludedCountryIds) org.excludedCountryIds = input.excludedCountryIds as never;
    await org.save();
  } else {
    const user = await User.findById(input.subjectId);
    if (!user) throw new AppError('User not found', 404);
    if (input.preferredCurrency) user.preferredCurrency = input.preferredCurrency.toUpperCase();
    if (input.regionIds) user.regionIds = input.regionIds as never;
    if (input.scopedCountryIds) user.scopedCountryIds = input.scopedCountryIds as never;
    if (input.excludedCountryIds) user.excludedCountryIds = input.excludedCountryIds as never;
    await user.save();
  }

  await recordActivity({
    action: AUDIT_ACTIONS.BUSINESS_CONFIG_UPDATE,
    summary: `${actor.email} updated customer scope for ${input.subjectType} ${input.subjectId}`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: input.subjectType === 'user' ? 'user' : 'system',
    targetId: input.subjectId,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return { success: true };
}

export async function getMessages() {
  return getSystemMessages();
}

export async function saveMessages(
  messages: Parameters<typeof updateSystemMessages>[0],
  actor: { id: string; email: string; role: string },
  audit: RequestAuditContext = {},
) {
  const data = await updateSystemMessages(messages);
  await recordActivity({
    action: AUDIT_ACTIONS.SYSTEM_MESSAGES_UPDATE,
    summary: `${actor.email} updated system messages`,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'system',
    targetId: 'default',
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });
  return data;
}

export async function getBrandingLogoStorageKey(
  slot: 'login' | 'header' | 'footer' | 'email',
): Promise<string | null> {
  const doc = await getBusinessConfigDoc();
  return doc.logos?.[slot] ?? null;
}
