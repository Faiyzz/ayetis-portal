/**
 * Phase 6 UAT invariants — no DB required.
 * Run: npm run uat:assert -w server
 */
import {
  ALL_CASE_STATUSES,
  CASE_CANCEL_WINDOW_MINUTES,
  CASE_STATUSES,
  DEFAULT_EMAIL_TEMPLATE_DEFS,
  EMAIL_TEMPLATE_KEYS,
  PERMISSIONS,
  URD_ACADEMIC_TITLES,
  URD_DIAL_CODES,
  URD_PROFESSIONS,
  URD_PROFESSION_SPECIALIZATIONS,
  notificationCatalog,
  regionCodeForCountry,
} from '@ayetis/shared';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  assert(CASE_CANCEL_WINDOW_MINUTES === 15, 'Cancel window must be 15 minutes');
  assert(ALL_CASE_STATUSES.length === 6, 'Expected six URD case statuses');
  assert(
    [
      CASE_STATUSES.NEW_CASE,
      CASE_STATUSES.IN_PROCESS,
      CASE_STATUSES.WAITING_FOR_APPROVAL,
      CASE_STATUSES.APPROVED,
      CASE_STATUSES.CANCELLED,
      CASE_STATUSES.SAVED_FOR_SUBMISSION,
    ].every((status) => ALL_CASE_STATUSES.includes(status)),
    'Missing a required case status',
  );

  assert(URD_PROFESSIONS.includes('Orthodontist'), 'URD professions missing Orthodontist');
  assert(URD_PROFESSIONS.includes('Dentist'), 'URD professions missing Dentist');
  assert(URD_PROFESSIONS.length >= 8, 'URD professions list is incomplete');
  assert(URD_ACADEMIC_TITLES.includes('Dr.'), 'URD titles missing Dr.');
  assert(
    URD_PROFESSION_SPECIALIZATIONS.includes('Prosthodontist'),
    'URD specializations missing Prosthodontist',
  );
  assert(URD_DIAL_CODES['United States'] === '+1', 'US dial code must be +1');
  assert(regionCodeForCountry('United States') === 'NAM', 'US region must be NAM');
  assert(regionCodeForCountry('Germany') === 'CEMEA', 'Germany region must be CEMEA');

  const templateKeys = new Set(DEFAULT_EMAIL_TEMPLATE_DEFS.map((tpl) => tpl.key));
  for (const key of [
    EMAIL_TEMPLATE_KEYS.CASE_EVENT,
    EMAIL_TEMPLATE_KEYS.CASE_DELIVERED,
    EMAIL_TEMPLATE_KEYS.CASE_ASSIGNED,
    EMAIL_TEMPLATE_KEYS.CLARIFICATION_REQUIRED,
    EMAIL_TEMPLATE_KEYS.CLARIFICATION_REPLIED,
    EMAIL_TEMPLATE_KEYS.SLA_WARNING,
    EMAIL_TEMPLATE_KEYS.SLA_BREACH,
  ]) {
    assert(templateKeys.has(key), `Missing email template seed: ${key}`);
  }

  assert(PERMISSIONS.CORPORATE_REPORT_VIEW, 'CORPORATE_REPORT_VIEW missing');
  assert(PERMISSIONS.CORPORATE_AUDIT_VIEW, 'CORPORATE_AUDIT_VIEW missing');

  const catalog = notificationCatalog();
  assert(catalog.length >= 15, 'Notification catalog is too small');
  assert(
    catalog.some((item) => item.type === 'sla_breach' && item.emailTemplateKey === 'sla_breach'),
    'SLA breach catalog mapping missing',
  );

  console.log('UAT assert passed');
}

run();
