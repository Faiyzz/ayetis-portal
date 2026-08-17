export const COUNT = 20;
export const FAKER_SEED = 42;
export const DEMO_EMAIL_DOMAIN = 'seed.ayetis.test';
export const DEMO_PASSWORD = 'Test@12345';

export const CORP_SEQ_START = 900001;
export const DOCTOR_SEQ_START = 9001;
export const EMPLOYEE_SEQ_START = 9001;
export const DOCUMENT_SEQ_START = 9001;

export const STAFF_ROLES = [
  'coordinator',
  'coordinator',
  'coordinator',
  'designer',
  'designer',
  'designer',
  'senior_designer',
  'senior_designer',
  'qc',
  'qc',
  'qc',
  'qc_self',
  'qc_self',
  'orthodontist',
  'orthodontist',
  'supervisor',
  'supervisor',
  'analytics',
  'cut_operator',
  'cut_operator',
] as const;

export const AUDIT_TARGET_TYPES = [
  'user',
  'role',
  'auth',
  'system',
  'case',
  'clarification',
  'registration',
] as const;
