import { describe, expect, it } from 'vitest';
import {
  URD_ACADEMIC_TITLES,
  URD_DIAL_CODES,
  URD_PROFESSIONS,
  URD_PROFESSION_SPECIALIZATIONS,
  regionCodeForCountry,
} from './urdMasterData';
import {
  DEFAULT_EMAIL_TEMPLATE_DEFS,
  EMAIL_TEMPLATE_KEYS,
  mergeTemplatePlaceholders,
} from './settings';
import {
  DEFAULT_SLA_WARNING_PERCENT,
  hoursForSlaSegment,
  resolveSlaAccountSegment,
  isSlaAccountSegment,
} from './sla';
import { ACCOUNT_TYPES } from './account';
import {
  COUNTRIES,
  GENDER_OPTIONS,
} from './geo';

describe('URD master data', () => {
  it('includes required professions, titles, and specializations', () => {
    expect(URD_PROFESSIONS).toEqual(expect.arrayContaining(['Orthodontist', 'Dentist']));
    expect(URD_PROFESSIONS.length).toBeGreaterThanOrEqual(8);
    expect(URD_ACADEMIC_TITLES).toContain('Dr.');
    expect(URD_PROFESSION_SPECIALIZATIONS).toContain('Prosthodontist');
  });

  it('maps countries to regions and dial codes', () => {
    expect(URD_DIAL_CODES['United States']).toBe('+1');
    expect(URD_DIAL_CODES.Germany).toBe('+49');
    expect(regionCodeForCountry('United States')).toBe('NAM');
    expect(regionCodeForCountry('Germany')).toBe('CEMEA');
    expect(regionCodeForCountry('NotACountry')).toBeNull();
    expect(COUNTRIES).toContain('United States');
    expect(GENDER_OPTIONS.map((g) => g.value)).toEqual(
      expect.arrayContaining(['Female', 'Male', 'Other']),
    );
  });
});

describe('email templates and SLA segments', () => {
  it('seeds case, clarification, and SLA template keys', () => {
    const keys = new Set(DEFAULT_EMAIL_TEMPLATE_DEFS.map((tpl) => tpl.key));
    for (const key of [
      EMAIL_TEMPLATE_KEYS.CASE_EVENT,
      EMAIL_TEMPLATE_KEYS.CASE_DELIVERED,
      EMAIL_TEMPLATE_KEYS.CASE_ASSIGNED,
      EMAIL_TEMPLATE_KEYS.CLARIFICATION_REQUIRED,
      EMAIL_TEMPLATE_KEYS.CLARIFICATION_REPLIED,
      EMAIL_TEMPLATE_KEYS.SLA_WARNING,
      EMAIL_TEMPLATE_KEYS.SLA_BREACH,
    ]) {
      expect(keys.has(key)).toBe(true);
    }
    expect(mergeTemplatePlaceholders('Hello {{ name }}', { name: 'Ada' })).toBe('Hello Ada');
    expect(mergeTemplatePlaceholders('x {{missing}}', {})).toBe('x ');
  });

  it('resolves individual vs company vs sub-account SLA hours', () => {
    expect(DEFAULT_SLA_WARNING_PERCENT).toBe(90);
    expect(resolveSlaAccountSegment({ accountType: ACCOUNT_TYPES.INDIVIDUAL })).toBe('individual');
    expect(resolveSlaAccountSegment({ accountType: ACCOUNT_TYPES.CORPORATE })).toBe('company');
    expect(
      resolveSlaAccountSegment({
        accountType: ACCOUNT_TYPES.CORPORATE,
        subAccountId: '001_C1',
      }),
    ).toBe('sub_account');
    expect(hoursForSlaSegment('individual', { individual: 24, company: 48, sub_account: 36 })).toBe(
      24,
    );
    expect(hoursForSlaSegment('company', null)).toBe(48);
    expect(isSlaAccountSegment('individual')).toBe(true);
    expect(isSlaAccountSegment('nope')).toBe(false);
  });
});
