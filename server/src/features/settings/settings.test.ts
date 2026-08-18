import { describe, expect, it, vi } from 'vitest';
import { hoursForSlaSegment } from '@ayetis/shared';

const { BusinessConfig, Region, Country, MasterListItem, EmailTemplate, PrivacyPolicy } =
  vi.hoisted(() => ({
    BusinessConfig: {
      findOneAndUpdate: vi.fn(),
    },
    Region: {
      findOneAndUpdate: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
    },
    Country: {
      findById: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      findOneAndUpdate: vi.fn(),
      countDocuments: vi.fn(async () => 0),
    },
    MasterListItem: { findOneAndUpdate: vi.fn(), find: vi.fn() },
    EmailTemplate: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn() },
    PrivacyPolicy: { findOne: vi.fn(), create: vi.fn() },
  }));

vi.mock('../../models/Settings', () => ({
  BusinessConfig,
  Country,
  CountryRequest: {},
  EmailTemplate,
  MasterListItem,
  PrivacyPolicy,
  Region,
}));
vi.mock('../../models/SystemConfig', () => ({
  getSystemMessages: vi.fn(async () => ({})),
  updateSystemMessages: vi.fn(),
}));
vi.mock('../../models/Organization', () => ({ Organization: { findById: vi.fn() } }));
vi.mock('../../models/User', () => ({ User: { findById: vi.fn(), updateMany: vi.fn() } }));
vi.mock('../audit/audit.service', () => ({ recordActivity: vi.fn() }));
vi.mock('../../services/storage.service', () => ({
  persistUploadedFile: vi.fn(),
  openStoredReadStream: vi.fn(),
  createSignedFileAccess: vi.fn(),
}));

import { getSlaConfig, resolveSlaHoursForUser, seedSettingsData } from './settings.service';
import { resolveCountryGeo, userGeoFromResolved } from './geoResolve';

describe('SLA settings', () => {
  it('uses per-user override then account-type defaults', async () => {
    BusinessConfig.findOneAndUpdate.mockResolvedValue({
      sla: { hoursBySegment: { individual: 24, company: 48, sub_account: 36 }, warningPercent: 90 },
      updatedAt: new Date(),
    });
    await expect(resolveSlaHoursForUser({ slaBusinessHours: 12 })).resolves.toBe(12);
    await expect(
      resolveSlaHoursForUser({ accountType: 'individual' }),
    ).resolves.toBe(hoursForSlaSegment('individual', { individual: 24, company: 48, sub_account: 36 }));
    const cfg = await getSlaConfig();
    expect(cfg.warningPercent).toBe(90);
  });

  it('seeds URD regions, countries, professions, and email templates', async () => {
    const region = { _id: 'r1', code: 'NAM' };
    Region.findOne.mockResolvedValue(region);
    PrivacyPolicy.findOne.mockResolvedValue({ version: '1.0' });
    await seedSettingsData();
    expect(Region.findOneAndUpdate).toHaveBeenCalled();
    expect(Country.findOneAndUpdate).toHaveBeenCalled();
    expect(MasterListItem.findOneAndUpdate).toHaveBeenCalled();
    expect(EmailTemplate.findOneAndUpdate).toHaveBeenCalled();
  });
});

describe('geo resolve', () => {
  it('falls back to the supplied country name', async () => {
    vi.mocked(Country.findById).mockResolvedValue(null);
    vi.mocked(Country.findOne).mockResolvedValue(null);
    const geo = await resolveCountryGeo({ countryName: 'Pakistan' });
    expect(geo.country).toBe('Pakistan');
    expect(userGeoFromResolved(geo).assignedCountry).toBe('Pakistan');
  });
});
