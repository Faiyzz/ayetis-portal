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
  canViewDoctorName,
  formatDoctorDisplay,
  ROLES,
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

  // Doctor Name Privacy & Redaction rules (Review Comment 2)
  const doctorUserId = 'user_doc_123';
  const otherUserId = 'user_coord_456';
  const docInfo = { doctorUserId, doctorName: 'Dr. John Smith', doctorId: 'DOC-10294' };

  assert(canViewDoctorName(ROLES.ADMIN, otherUserId, doctorUserId) === true, 'Admin must view doctor name');
  assert(canViewDoctorName(ROLES.DOCTOR, doctorUserId, doctorUserId) === true, 'Doctor must view own name');
  assert(canViewDoctorName(ROLES.DOCTOR, otherUserId, doctorUserId) === false, 'Doctor must not view another doctor name');
  assert(canViewDoctorName(ROLES.COORDINATOR, otherUserId, doctorUserId) === false, 'Coordinator must not view doctor name');
  assert(canViewDoctorName(ROLES.DESIGNER, otherUserId, doctorUserId) === false, 'Designer must not view doctor name');
  assert(canViewDoctorName(ROLES.QC, otherUserId, doctorUserId) === false, 'QC must not view doctor name');
  assert(canViewDoctorName(ROLES.SUPERVISOR, otherUserId, doctorUserId) === false, 'Supervisor must not view doctor name');
  assert(canViewDoctorName(ROLES.ORTHODONTIST, otherUserId, doctorUserId) === false, 'Orthodontist must not view doctor name');

  assert(
    formatDoctorDisplay(ROLES.ADMIN, otherUserId, docInfo) === 'Dr. John Smith',
    'Admin should see real doctor name',
  );
  assert(
    formatDoctorDisplay(ROLES.DOCTOR, doctorUserId, docInfo) === 'Dr. John Smith',
    'Doctor should see own real name',
  );
  assert(
    formatDoctorDisplay(ROLES.COORDINATOR, otherUserId, docInfo) === 'DOC-10294',
    'Coordinator must see doctorDisplayId',
  );
  assert(
    formatDoctorDisplay(ROLES.DESIGNER, otherUserId, docInfo) === 'DOC-10294',
    'Designer must see doctorDisplayId',
  );
  assert(
    formatDoctorDisplay(ROLES.QC, otherUserId, { doctorUserId, doctorName: 'Dr. John Smith', doctorId: undefined }) === 'Doctor',
    'Fallback for staff when display ID missing must be Doctor',
  );

  console.log('UAT assert passed');
}

run();
