/**
 * Built-in role keys. Dynamic/custom roles are DB RoleDefinition keys (any string).
 * `Role` is a string key so custom roles work without code changes.
 */
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

/** @deprecated Prefer RoleKey from rbac; kept as string for custom roles. */
export type Role = string;

export const ROLE_LABELS: Record<string, string> = {
  [ROLES.ADMIN]: 'Main Admin',
  [ROLES.CORPORATE_ADMIN]: 'Corporate Admin',
  [ROLES.FACILITY_ADMIN]: 'Facility Admin',
  [ROLES.DOCTOR]: 'Doctor',
  [ROLES.COORDINATOR]: 'Coordinator',
  [ROLES.DESIGNER]: 'Designer',
  [ROLES.QC]: 'QC Specialist',
  [ROLES.ORTHODONTIST]: 'Consultant',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.ANALYTICS]: 'Analytics',
  senior_designer: 'Senior Designer',
  qc_self: 'QC Self',
  cut_operator: 'Cut Operator',
};

/** Built-in keys only (not custom DB roles). */
export const ALL_ROLES: Role[] = Object.values(ROLES);

/** Roles that may self-register through the public signup form. */
export const PUBLIC_REGISTER_ROLES: Role[] = [ROLES.DOCTOR];

export function isRole(value: string): value is Role {
  return typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 64;
}

export function isBuiltInRole(value: string): boolean {
  return (ALL_ROLES as string[]).includes(value);
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
