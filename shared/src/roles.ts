export const ROLES = {
  ADMIN: 'admin',
  CORPORATE_ADMIN: 'corporate_admin',
  FACILITY_ADMIN: 'facility_admin',
  DOCTOR: 'doctor',
  COORDINATOR: 'coordinator',
  DESIGNER: 'designer',
  QC: 'qc',
  ORTHODONTIST: 'orthodontist',
  SUPERVISOR: 'supervisor',
  ANALYTICS: 'analytics',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.CORPORATE_ADMIN]: 'Corporate Admin',
  [ROLES.FACILITY_ADMIN]: 'Facility Admin',
  [ROLES.DOCTOR]: 'Doctor',
  [ROLES.COORDINATOR]: 'Coordinator',
  [ROLES.DESIGNER]: 'Designer',
  [ROLES.QC]: 'Quality Control',
  [ROLES.ORTHODONTIST]: 'Orthodontist',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.ANALYTICS]: 'Analytics',
};

export const ALL_ROLES: Role[] = Object.values(ROLES);

/** Roles that may self-register through the public signup form. */
export const PUBLIC_REGISTER_ROLES: Role[] = [ROLES.DOCTOR];

export function isRole(value: string): value is Role {
  return ALL_ROLES.includes(value as Role);
}
