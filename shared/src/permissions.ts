import { ROLES, type Role } from './roles';

/**
 * Single source of truth for RBAC permission keys.
 * Role defaults live here. Runtime grant/deny overrides are applied on top.
 */
export const PERMISSIONS = {
  // Auth / account
  USER_VIEW_OWN: 'user:view_own',
  USER_UPDATE_OWN: 'user:update_own',
  USER_CHANGE_PASSWORD: 'user:change_password',

  // User management (admin)
  USER_LIST: 'user:list',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_ASSIGN_ROLE: 'user:assign_role',
  USER_ASSIGN_PERMISSIONS: 'user:assign_permissions',
  USER_RESET_PASSWORD: 'user:reset_password',

  // Registration approval (admin)
  REGISTRATION_LIST: 'registration:list',
  REGISTRATION_APPROVE: 'registration:approve',
  REGISTRATION_REJECT: 'registration:reject',

  // Role permission configuration
  ROLE_VIEW_PERMISSIONS: 'role:view_permissions',
  ROLE_ASSIGN_PERMISSIONS: 'role:assign_permissions',

  // Cases (stubs for upcoming features — keep permissions centralized early)
  CASE_CREATE: 'case:create',
  CASE_VIEW_OWN: 'case:view_own',
  CASE_VIEW_ALL: 'case:view_all',
  CASE_VIEW_ASSIGNED: 'case:view_assigned',
  CASE_UPDATE: 'case:update',
  CASE_ASSIGN: 'case:assign',
  CASE_VALIDATE: 'case:validate',
  CASE_DESIGN: 'case:design',
  CASE_QC_REVIEW: 'case:qc_review',
  CASE_CONSULT: 'case:consult',
  CASE_APPROVE: 'case:approve',
  CASE_DELETE: 'case:delete',
  CASE_SET_PRIORITY: 'case:set_priority',
  CASE_MANAGE_PAYMENT: 'case:manage_payment',

  // Clarifications
  CLARIFICATION_CREATE: 'clarification:create',
  CLARIFICATION_REPLY: 'clarification:reply',
  CLARIFICATION_RESOLVE: 'clarification:resolve',

  // Reports
  REPORT_VIEW: 'report:view',
  REPORT_VIEW_TEAM: 'report:view_team',
  REPORT_VIEW_ALL: 'report:view_all',

  // Departments / teams
  DEPARTMENT_MANAGE: 'department:manage',
  TEAM_MANAGE: 'team:manage',

  // Complaints / feedback
  COMPLAINT_CREATE: 'complaint:create',
  COMPLAINT_VIEW: 'complaint:view',
  COMPLAINT_MANAGE: 'complaint:manage',

  // Delete approval workflow
  DELETE_REQUEST_REVIEW: 'delete_request:review',

  // Cancellation & commercial
  CANCELLATION_REPORT_VIEW: 'cancellation_report:view',
  CANCELLATION_REFUND_UPDATE: 'cancellation_refund:update',
  SLA_CONFIGURE: 'sla:configure',
  TREATMENT_PLAN_MANAGE: 'treatment_plan:manage',
  DISCOUNT_CODE_MANAGE: 'discount_code:manage',

  // Corporate hierarchy
  ORG_MANAGE_SELF: 'org:manage_self',
  FACILITY_MANAGE: 'facility:manage',
  EMPLOYEE_MANAGE: 'employee:manage',
  SUBACCOUNT_MANAGE: 'subaccount:manage',
  CASE_VIEW_FACILITY: 'case:view_facility',
  CASE_VIEW_ORG: 'case:view_org',
  CORPORATE_REPORT_VIEW: 'corporate_report:view',
  CORPORATE_AUDIT_VIEW: 'corporate_audit:view',

  // Audit
  AUDIT_VIEW: 'audit:view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const PERMISSION_LABELS: Record<Permission, string> = {
  [PERMISSIONS.USER_VIEW_OWN]: 'View own profile',
  [PERMISSIONS.USER_UPDATE_OWN]: 'Update own profile',
  [PERMISSIONS.USER_CHANGE_PASSWORD]: 'Change own password',
  [PERMISSIONS.USER_LIST]: 'List users',
  [PERMISSIONS.USER_CREATE]: 'Create users',
  [PERMISSIONS.USER_UPDATE]: 'Update users',
  [PERMISSIONS.USER_DELETE]: 'Delete users',
  [PERMISSIONS.USER_ASSIGN_ROLE]: 'Assign user roles',
  [PERMISSIONS.USER_ASSIGN_PERMISSIONS]: 'Assign user permissions',
  [PERMISSIONS.USER_RESET_PASSWORD]: 'Reset user passwords',
  [PERMISSIONS.REGISTRATION_LIST]: 'List registration requests',
  [PERMISSIONS.REGISTRATION_APPROVE]: 'Approve registration requests',
  [PERMISSIONS.REGISTRATION_REJECT]: 'Reject registration requests',
  [PERMISSIONS.ROLE_VIEW_PERMISSIONS]: 'View role permissions',
  [PERMISSIONS.ROLE_ASSIGN_PERMISSIONS]: 'Assign role permissions',
  [PERMISSIONS.CASE_CREATE]: 'Create cases',
  [PERMISSIONS.CASE_VIEW_OWN]: 'View own cases',
  [PERMISSIONS.CASE_VIEW_ALL]: 'View all cases',
  [PERMISSIONS.CASE_VIEW_ASSIGNED]: 'View assigned cases',
  [PERMISSIONS.CASE_UPDATE]: 'Update cases',
  [PERMISSIONS.CASE_ASSIGN]: 'Assign cases',
  [PERMISSIONS.CASE_VALIDATE]: 'Validate cases',
  [PERMISSIONS.CASE_DESIGN]: 'Design cases',
  [PERMISSIONS.CASE_QC_REVIEW]: 'QC review cases',
  [PERMISSIONS.CASE_CONSULT]: 'Consult on cases',
  [PERMISSIONS.CASE_APPROVE]: 'Approve cases',
  [PERMISSIONS.CASE_DELETE]: 'Delete cases',
  [PERMISSIONS.CASE_SET_PRIORITY]: 'Set case priority',
  [PERMISSIONS.CASE_MANAGE_PAYMENT]: 'Manage case payments',
  [PERMISSIONS.CLARIFICATION_CREATE]: 'Create clarification requests',
  [PERMISSIONS.CLARIFICATION_REPLY]: 'Reply to clarifications',
  [PERMISSIONS.CLARIFICATION_RESOLVE]: 'Resolve clarifications',
  [PERMISSIONS.REPORT_VIEW]: 'View reports',
  [PERMISSIONS.REPORT_VIEW_TEAM]: 'View team reports',
  [PERMISSIONS.REPORT_VIEW_ALL]: 'View all reports',
  [PERMISSIONS.DEPARTMENT_MANAGE]: 'Manage departments',
  [PERMISSIONS.TEAM_MANAGE]: 'Manage team members',
  [PERMISSIONS.COMPLAINT_CREATE]: 'Log complaints',
  [PERMISSIONS.COMPLAINT_VIEW]: 'View complaints and ratings',
  [PERMISSIONS.COMPLAINT_MANAGE]: 'Manage complaints',
  [PERMISSIONS.DELETE_REQUEST_REVIEW]: 'Approve or reject delete requests',
  [PERMISSIONS.CANCELLATION_REPORT_VIEW]: 'View cancellation audit reports',
  [PERMISSIONS.CANCELLATION_REFUND_UPDATE]: 'Update cancellation refund status',
  [PERMISSIONS.SLA_CONFIGURE]: 'Configure doctor SLA hours',
  [PERMISSIONS.TREATMENT_PLAN_MANAGE]: 'Manage treatment plans',
  [PERMISSIONS.DISCOUNT_CODE_MANAGE]: 'Manage discount codes',
  [PERMISSIONS.ORG_MANAGE_SELF]: 'Manage own organization profile',
  [PERMISSIONS.FACILITY_MANAGE]: 'Manage facilities',
  [PERMISSIONS.EMPLOYEE_MANAGE]: 'Manage corporate employees',
  [PERMISSIONS.SUBACCOUNT_MANAGE]: 'Manage corporate sub-accounts',
  [PERMISSIONS.CASE_VIEW_FACILITY]: 'View facility cases',
  [PERMISSIONS.CASE_VIEW_ORG]: 'View all organization cases',
  [PERMISSIONS.CORPORATE_REPORT_VIEW]: 'View corporate reports',
  [PERMISSIONS.CORPORATE_AUDIT_VIEW]: 'View corporate activity logs',
  [PERMISSIONS.AUDIT_VIEW]: 'View activity logs',
};

export type PermissionGroup =
  | 'Account'
  | 'Users'
  | 'Registrations'
  | 'Roles'
  | 'Cases'
  | 'Clarifications'
  | 'Reports'
  | 'Departments'
  | 'Complaints'
  | 'Commercial'
  | 'Corporate'
  | 'Audit';

export const PERMISSION_GROUPS: Record<Permission, PermissionGroup> = {
  [PERMISSIONS.USER_VIEW_OWN]: 'Account',
  [PERMISSIONS.USER_UPDATE_OWN]: 'Account',
  [PERMISSIONS.USER_CHANGE_PASSWORD]: 'Account',
  [PERMISSIONS.USER_LIST]: 'Users',
  [PERMISSIONS.USER_CREATE]: 'Users',
  [PERMISSIONS.USER_UPDATE]: 'Users',
  [PERMISSIONS.USER_DELETE]: 'Users',
  [PERMISSIONS.USER_ASSIGN_ROLE]: 'Users',
  [PERMISSIONS.USER_ASSIGN_PERMISSIONS]: 'Users',
  [PERMISSIONS.USER_RESET_PASSWORD]: 'Users',
  [PERMISSIONS.REGISTRATION_LIST]: 'Registrations',
  [PERMISSIONS.REGISTRATION_APPROVE]: 'Registrations',
  [PERMISSIONS.REGISTRATION_REJECT]: 'Registrations',
  [PERMISSIONS.ROLE_VIEW_PERMISSIONS]: 'Roles',
  [PERMISSIONS.ROLE_ASSIGN_PERMISSIONS]: 'Roles',
  [PERMISSIONS.CASE_CREATE]: 'Cases',
  [PERMISSIONS.CASE_VIEW_OWN]: 'Cases',
  [PERMISSIONS.CASE_VIEW_ALL]: 'Cases',
  [PERMISSIONS.CASE_VIEW_ASSIGNED]: 'Cases',
  [PERMISSIONS.CASE_UPDATE]: 'Cases',
  [PERMISSIONS.CASE_ASSIGN]: 'Cases',
  [PERMISSIONS.CASE_VALIDATE]: 'Cases',
  [PERMISSIONS.CASE_DESIGN]: 'Cases',
  [PERMISSIONS.CASE_QC_REVIEW]: 'Cases',
  [PERMISSIONS.CASE_CONSULT]: 'Cases',
  [PERMISSIONS.CASE_APPROVE]: 'Cases',
  [PERMISSIONS.CASE_DELETE]: 'Cases',
  [PERMISSIONS.CASE_SET_PRIORITY]: 'Cases',
  [PERMISSIONS.CASE_MANAGE_PAYMENT]: 'Cases',
  [PERMISSIONS.CLARIFICATION_CREATE]: 'Clarifications',
  [PERMISSIONS.CLARIFICATION_REPLY]: 'Clarifications',
  [PERMISSIONS.CLARIFICATION_RESOLVE]: 'Clarifications',
  [PERMISSIONS.REPORT_VIEW]: 'Reports',
  [PERMISSIONS.REPORT_VIEW_TEAM]: 'Reports',
  [PERMISSIONS.REPORT_VIEW_ALL]: 'Reports',
  [PERMISSIONS.DEPARTMENT_MANAGE]: 'Departments',
  [PERMISSIONS.TEAM_MANAGE]: 'Departments',
  [PERMISSIONS.COMPLAINT_CREATE]: 'Complaints',
  [PERMISSIONS.COMPLAINT_VIEW]: 'Complaints',
  [PERMISSIONS.COMPLAINT_MANAGE]: 'Complaints',
  [PERMISSIONS.DELETE_REQUEST_REVIEW]: 'Audit',
  [PERMISSIONS.CANCELLATION_REPORT_VIEW]: 'Reports',
  [PERMISSIONS.CANCELLATION_REFUND_UPDATE]: 'Commercial',
  [PERMISSIONS.SLA_CONFIGURE]: 'Commercial',
  [PERMISSIONS.TREATMENT_PLAN_MANAGE]: 'Commercial',
  [PERMISSIONS.DISCOUNT_CODE_MANAGE]: 'Commercial',
  [PERMISSIONS.ORG_MANAGE_SELF]: 'Corporate',
  [PERMISSIONS.FACILITY_MANAGE]: 'Corporate',
  [PERMISSIONS.EMPLOYEE_MANAGE]: 'Corporate',
  [PERMISSIONS.SUBACCOUNT_MANAGE]: 'Corporate',
  [PERMISSIONS.CASE_VIEW_FACILITY]: 'Cases',
  [PERMISSIONS.CASE_VIEW_ORG]: 'Cases',
  [PERMISSIONS.CORPORATE_REPORT_VIEW]: 'Corporate',
  [PERMISSIONS.CORPORATE_AUDIT_VIEW]: 'Corporate',
  [PERMISSIONS.AUDIT_VIEW]: 'Audit',
};

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [ROLES.ADMIN]: ALL_PERMISSIONS,

  [ROLES.DOCTOR]: [
    PERMISSIONS.USER_VIEW_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.USER_CHANGE_PASSWORD,
    PERMISSIONS.CASE_CREATE,
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_VIEW_FACILITY,
    PERMISSIONS.CASE_APPROVE,
    PERMISSIONS.CLARIFICATION_REPLY,
  ],

  [ROLES.CORPORATE_ADMIN]: [
    PERMISSIONS.USER_VIEW_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.USER_CHANGE_PASSWORD,
    PERMISSIONS.ORG_MANAGE_SELF,
    PERMISSIONS.FACILITY_MANAGE,
    PERMISSIONS.EMPLOYEE_MANAGE,
    PERMISSIONS.SUBACCOUNT_MANAGE,
    PERMISSIONS.CASE_VIEW_ORG,
    PERMISSIONS.CASE_CREATE,
    PERMISSIONS.CASE_APPROVE,
    PERMISSIONS.CLARIFICATION_REPLY,
    PERMISSIONS.CORPORATE_REPORT_VIEW,
    PERMISSIONS.CORPORATE_AUDIT_VIEW,
    PERMISSIONS.USER_RESET_PASSWORD,
  ],

  [ROLES.FACILITY_ADMIN]: [
    PERMISSIONS.USER_VIEW_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.USER_CHANGE_PASSWORD,
    PERMISSIONS.CASE_VIEW_FACILITY,
    PERMISSIONS.CASE_CREATE,
    PERMISSIONS.CASE_APPROVE,
    PERMISSIONS.CLARIFICATION_REPLY,
    PERMISSIONS.EMPLOYEE_MANAGE,
  ],

  [ROLES.COORDINATOR]: [
    PERMISSIONS.USER_VIEW_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.USER_CHANGE_PASSWORD,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VALIDATE,
    PERMISSIONS.CASE_ASSIGN,
    PERMISSIONS.CASE_SET_PRIORITY,
    PERMISSIONS.CASE_UPDATE,
    PERMISSIONS.CASE_MANAGE_PAYMENT,
    PERMISSIONS.CLARIFICATION_CREATE,
    PERMISSIONS.CLARIFICATION_REPLY,
    PERMISSIONS.CLARIFICATION_RESOLVE,
    PERMISSIONS.COMPLAINT_CREATE,
  ],

  [ROLES.DESIGNER]: [
    PERMISSIONS.USER_VIEW_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.USER_CHANGE_PASSWORD,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CASE_DESIGN,
    PERMISSIONS.CASE_UPDATE,
    PERMISSIONS.CLARIFICATION_CREATE,
    PERMISSIONS.CLARIFICATION_REPLY,
    PERMISSIONS.CLARIFICATION_RESOLVE,
    PERMISSIONS.COMPLAINT_CREATE,
  ],

  [ROLES.QC]: [
    PERMISSIONS.USER_VIEW_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.USER_CHANGE_PASSWORD,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CASE_QC_REVIEW,
    PERMISSIONS.CASE_UPDATE,
    PERMISSIONS.CLARIFICATION_CREATE,
    PERMISSIONS.CLARIFICATION_REPLY,
    PERMISSIONS.CLARIFICATION_RESOLVE,
    PERMISSIONS.COMPLAINT_CREATE,
  ],

  [ROLES.ORTHODONTIST]: [
    PERMISSIONS.USER_VIEW_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.USER_CHANGE_PASSWORD,
    PERMISSIONS.CASE_VIEW_ASSIGNED,
    PERMISSIONS.CASE_CONSULT,
    PERMISSIONS.CASE_QC_REVIEW,
    PERMISSIONS.CASE_UPDATE,
    PERMISSIONS.CLARIFICATION_CREATE,
    PERMISSIONS.CLARIFICATION_REPLY,
    PERMISSIONS.CLARIFICATION_RESOLVE,
    PERMISSIONS.COMPLAINT_CREATE,
  ],

  [ROLES.SUPERVISOR]: [
    PERMISSIONS.USER_VIEW_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.USER_CHANGE_PASSWORD,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_ASSIGN,
    PERMISSIONS.CASE_SET_PRIORITY,
    PERMISSIONS.CASE_MANAGE_PAYMENT,
    PERMISSIONS.CLARIFICATION_CREATE,
    PERMISSIONS.CLARIFICATION_REPLY,
    PERMISSIONS.CLARIFICATION_RESOLVE,
    PERMISSIONS.REPORT_VIEW_TEAM,
    PERMISSIONS.USER_LIST,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.COMPLAINT_CREATE,
    PERMISSIONS.COMPLAINT_VIEW,
    PERMISSIONS.CANCELLATION_REPORT_VIEW,
  ],

  [ROLES.ANALYTICS]: [
    PERMISSIONS.USER_VIEW_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.USER_CHANGE_PASSWORD,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.COMPLAINT_VIEW,
    PERMISSIONS.CANCELLATION_REPORT_VIEW,
  ],
};

export interface PermissionOverrides {
  grants?: readonly Permission[];
  denies?: readonly Permission[];
}

export interface EffectivePermissionInput {
  role: Role;
  roleOverrides?: PermissionOverrides;
  userOverrides?: PermissionOverrides;
}

/**
 * Resolve effective permissions:
 * (role defaults ∪ role grants ∪ user grants) − role denies − user denies
 * Admin always retains the full permission set.
 */
export function resolveEffectivePermissions(input: EffectivePermissionInput): Permission[] {
  if (input.role === ROLES.ADMIN) {
    return [...ALL_PERMISSIONS];
  }

  const base = new Set<Permission>(ROLE_PERMISSIONS[input.role] ?? []);

  for (const permission of input.roleOverrides?.grants ?? []) {
    base.add(permission);
  }
  for (const permission of input.userOverrides?.grants ?? []) {
    base.add(permission);
  }

  for (const permission of input.roleOverrides?.denies ?? []) {
    base.delete(permission);
  }
  for (const permission of input.userOverrides?.denies ?? []) {
    base.delete(permission);
  }

  return ALL_PERMISSIONS.filter((permission) => base.has(permission));
}

export function getPermissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function permissionsInclude(
  permissions: readonly Permission[],
  permission: Permission,
): boolean {
  return permissions.includes(permission);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

export function getPermissionCatalog() {
  return ALL_PERMISSIONS.map((value) => ({
    value,
    label: PERMISSION_LABELS[value],
    group: PERMISSION_GROUPS[value],
  }));
}
