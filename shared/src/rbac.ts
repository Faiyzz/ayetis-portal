/**
 * Role & Permission Matrix Engine (URD §5.8 / §5.10 / §5.12 / §5.13).
 */

import { PERMISSIONS, type Permission } from './permissions';
import { ROLES } from './roles';

export type RoleKey = string;

export const PORTAL_TEMPLATES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  CORPORATE_ADMIN: 'corporate_admin',
  FACILITY_ADMIN: 'facility_admin',
  COORDINATOR: 'coordinator',
  DESIGNER: 'designer',
  QC: 'qc',
  ORTHODONTIST: 'orthodontist',
  SUPERVISOR: 'supervisor',
  ANALYTICS: 'analytics',
  CUT: 'cut',
} as const;

export type PortalTemplate = (typeof PORTAL_TEMPLATES)[keyof typeof PORTAL_TEMPLATES];

export const ALL_PORTAL_TEMPLATES: PortalTemplate[] = Object.values(PORTAL_TEMPLATES);

export const QC_SCOPES = {
  NONE: 'none',
  OTHERS_ONLY: 'others_only',
  OWN_ONLY: 'own_only',
  ALL: 'all',
} as const;

export type QcScope = (typeof QC_SCOPES)[keyof typeof QC_SCOPES];

export const ALL_QC_SCOPES: QcScope[] = Object.values(QC_SCOPES);

export const QC_SCOPE_LABELS: Record<QcScope, string> = {
  [QC_SCOPES.NONE]: 'No QC',
  [QC_SCOPES.OTHERS_ONLY]: 'QC others only (not own cases)',
  [QC_SCOPES.OWN_ONLY]: 'Self QC (own cases only)',
  [QC_SCOPES.ALL]: 'QC all cases',
};

export const EXPERIENCE_LEVELS = {
  JUNIOR: 'junior',
  MID: 'mid',
  SENIOR: 'senior',
  LEAD: 'lead',
} as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[keyof typeof EXPERIENCE_LEVELS];

export const ALL_EXPERIENCE_LEVELS: ExperienceLevel[] = Object.values(EXPERIENCE_LEVELS);

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  [EXPERIENCE_LEVELS.JUNIOR]: 'Junior',
  [EXPERIENCE_LEVELS.MID]: 'Mid',
  [EXPERIENCE_LEVELS.SENIOR]: 'Senior',
  [EXPERIENCE_LEVELS.LEAD]: 'Lead',
};

export const ASSIGNMENT_QUEUES = {
  DESIGNER: 'designer',
  QC: 'qc',
  CUT: 'cut',
  CONSULTANT: 'consultant',
} as const;

export type AssignmentQueue =
  (typeof ASSIGNMENT_QUEUES)[keyof typeof ASSIGNMENT_QUEUES];

export const ALL_ASSIGNMENT_QUEUES: AssignmentQueue[] = Object.values(ASSIGNMENT_QUEUES);

export const ASSIGNMENT_QUEUE_LABELS: Record<AssignmentQueue, string> = {
  [ASSIGNMENT_QUEUES.DESIGNER]: 'Designer',
  [ASSIGNMENT_QUEUES.QC]: 'QC',
  [ASSIGNMENT_QUEUES.CUT]: 'Cut operator',
  [ASSIGNMENT_QUEUES.CONSULTANT]: 'Consultant',
};

/** Additional URD system role keys beyond legacy ROLES. */
export const EXTRA_SYSTEM_ROLES = {
  SENIOR_DESIGNER: 'senior_designer',
  QC_SELF: 'qc_self',
  CUT_OPERATOR: 'cut_operator',
} as const;

export const SYSTEM_ROLE_KEYS: RoleKey[] = [
  ROLES.ADMIN,
  ROLES.CORPORATE_ADMIN,
  ROLES.FACILITY_ADMIN,
  ROLES.DOCTOR,
  ROLES.COORDINATOR,
  ROLES.DESIGNER,
  EXTRA_SYSTEM_ROLES.SENIOR_DESIGNER,
  ROLES.QC,
  EXTRA_SYSTEM_ROLES.QC_SELF,
  ROLES.ORTHODONTIST,
  EXTRA_SYSTEM_ROLES.CUT_OPERATOR,
  ROLES.SUPERVISOR,
  ROLES.ANALYTICS,
];

export interface SystemRoleSeed {
  key: RoleKey;
  name: string;
  portalTemplate: PortalTemplate;
  qcScope: QcScope;
  sortOrder: number;
  /** Permission keys for seed defaults; empty means copy from portalTemplate defaults at seed time */
  useTemplateDefaults: boolean;
}

export const SYSTEM_ROLE_SEEDS: SystemRoleSeed[] = [
  {
    key: ROLES.ADMIN,
    name: 'Main Admin',
    portalTemplate: PORTAL_TEMPLATES.ADMIN,
    qcScope: QC_SCOPES.ALL,
    sortOrder: 10,
    useTemplateDefaults: true,
  },
  {
    key: ROLES.DOCTOR,
    name: 'Doctor',
    portalTemplate: PORTAL_TEMPLATES.DOCTOR,
    qcScope: QC_SCOPES.NONE,
    sortOrder: 20,
    useTemplateDefaults: true,
  },
  {
    key: ROLES.CORPORATE_ADMIN,
    name: 'Corporate Administrator',
    portalTemplate: PORTAL_TEMPLATES.CORPORATE_ADMIN,
    qcScope: QC_SCOPES.NONE,
    sortOrder: 30,
    useTemplateDefaults: true,
  },
  {
    key: ROLES.FACILITY_ADMIN,
    name: 'Facility Admin',
    portalTemplate: PORTAL_TEMPLATES.FACILITY_ADMIN,
    qcScope: QC_SCOPES.NONE,
    sortOrder: 40,
    useTemplateDefaults: true,
  },
  {
    key: ROLES.COORDINATOR,
    name: 'Coordinator',
    portalTemplate: PORTAL_TEMPLATES.COORDINATOR,
    qcScope: QC_SCOPES.NONE,
    sortOrder: 50,
    useTemplateDefaults: true,
  },
  {
    key: ROLES.SUPERVISOR,
    name: 'Supervisor',
    portalTemplate: PORTAL_TEMPLATES.SUPERVISOR,
    qcScope: QC_SCOPES.NONE,
    sortOrder: 60,
    useTemplateDefaults: true,
  },
  {
    key: ROLES.ORTHODONTIST,
    name: 'Consultant',
    portalTemplate: PORTAL_TEMPLATES.ORTHODONTIST,
    qcScope: QC_SCOPES.OTHERS_ONLY,
    sortOrder: 70,
    useTemplateDefaults: true,
  },
  {
    key: ROLES.DESIGNER,
    name: 'Designer',
    portalTemplate: PORTAL_TEMPLATES.DESIGNER,
    qcScope: QC_SCOPES.NONE,
    sortOrder: 80,
    useTemplateDefaults: true,
  },
  {
    key: EXTRA_SYSTEM_ROLES.SENIOR_DESIGNER,
    name: 'Senior Designer',
    portalTemplate: PORTAL_TEMPLATES.DESIGNER,
    qcScope: QC_SCOPES.NONE,
    sortOrder: 85,
    useTemplateDefaults: true,
  },
  {
    key: EXTRA_SYSTEM_ROLES.QC_SELF,
    name: 'QC Self',
    portalTemplate: PORTAL_TEMPLATES.QC,
    qcScope: QC_SCOPES.OWN_ONLY,
    sortOrder: 90,
    useTemplateDefaults: true,
  },
  {
    key: ROLES.QC,
    name: 'QC Specialist',
    portalTemplate: PORTAL_TEMPLATES.QC,
    qcScope: QC_SCOPES.OTHERS_ONLY,
    sortOrder: 95,
    useTemplateDefaults: true,
  },
  {
    key: EXTRA_SYSTEM_ROLES.CUT_OPERATOR,
    name: 'Cut Operator',
    portalTemplate: PORTAL_TEMPLATES.CUT,
    qcScope: QC_SCOPES.NONE,
    sortOrder: 100,
    useTemplateDefaults: true,
  },
  {
    key: ROLES.ANALYTICS,
    name: 'Analytics',
    portalTemplate: PORTAL_TEMPLATES.ANALYTICS,
    qcScope: QC_SCOPES.NONE,
    sortOrder: 110,
    useTemplateDefaults: true,
  },
];

export interface RoleDefinitionDto {
  id: string;
  key: RoleKey;
  name: string;
  description: string | null;
  portalTemplate: PortalTemplate;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  isDisabled: boolean;
  qcScope: QcScope;
  permissionGrants: Permission[];
  permissionDenies: Permission[];
  defaults: Permission[];
  effective: Permission[];
  clonedFromKey: string | null;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionMatrixCellDto {
  roleKey: RoleKey;
  permission: Permission;
  state: 'default' | 'grant' | 'deny';
}

export interface PermissionMatrixDto {
  roles: RoleDefinitionDto[];
  permissions: Array<{ value: Permission; label: string; group: string }>;
}

export interface TeamDto {
  id: string;
  name: string;
  code: string | null;
  supervisorIds: string[];
  memberIds: string[];
  regionIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentRuleDto {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  targetQueue: AssignmentQueue;
  roleKeys: RoleKey[];
  teamIds: string[];
  regionIds: string[];
  countryIds: string[];
  excludedCountryIds: string[];
  experienceLevels: ExperienceLevel[];
  softwareKeys: string[];
  requireAvailable: boolean;
  maxOpenCases: number | null;
  weight: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Resolve combined QC scope for a multi-role user.
 * - both own_only and others_only → others_only for own-check (cannot QC own; can QC others)
 * - only own_only → own_only
 * - only others_only → others_only
 * - all without specialty conflict → all
 * - none → none
 */
export function resolveQcScope(scopes: readonly QcScope[]): QcScope {
  const set = new Set(scopes.filter((s) => s && s !== QC_SCOPES.NONE));
  if (set.size === 0) return QC_SCOPES.NONE;

  const hasOwn = set.has(QC_SCOPES.OWN_ONLY);
  const hasOthers = set.has(QC_SCOPES.OTHERS_ONLY);
  const hasAll = set.has(QC_SCOPES.ALL);

  if (hasOwn && hasOthers) return QC_SCOPES.OTHERS_ONLY;
  if (hasOwn && !hasOthers && !hasAll) return QC_SCOPES.OWN_ONLY;
  if (hasOthers && !hasOwn) return QC_SCOPES.OTHERS_ONLY;
  if (hasAll && !hasOwn && !hasOthers) return QC_SCOPES.ALL;
  if (hasAll && (hasOwn || hasOthers)) {
    return hasOthers || hasOwn ? (hasOthers ? QC_SCOPES.OTHERS_ONLY : QC_SCOPES.OWN_ONLY) : QC_SCOPES.ALL;
  }
  return [...set][0] ?? QC_SCOPES.NONE;
}

export function canQcCase(
  scope: QcScope,
  opts: { actorId: string; designerId: string | null },
): { allowed: boolean; reason?: string } {
  if (scope === QC_SCOPES.NONE) {
    return { allowed: false, reason: 'Your roles do not allow QC review' };
  }
  const isOwn =
    Boolean(opts.designerId) && String(opts.designerId) === String(opts.actorId);

  if (scope === QC_SCOPES.OWN_ONLY) {
    if (!isOwn) {
      return {
        allowed: false,
        reason: 'Self QC can only review your own cases',
      };
    }
    return { allowed: true };
  }

  if (scope === QC_SCOPES.OTHERS_ONLY) {
    if (isOwn) {
      return {
        allowed: false,
        reason: 'You cannot QC your own case',
      };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

export function slugifyRoleKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

/** URD matrix family labels for permission catalog. */
export type RbacMatrixGroup =
  | 'Case'
  | 'Communication'
  | 'User Management'
  | 'Administrative';

export function toRbacMatrixGroup(legacyGroup: string): RbacMatrixGroup {
  switch (legacyGroup) {
    case 'Cases':
    case 'Clarifications':
      return 'Case';
    case 'Users':
    case 'Registrations':
    case 'Account':
      return 'User Management';
    case 'Roles':
    case 'Departments':
    case 'Reports':
    case 'Complaints':
    case 'Commercial':
    case 'Settings':
    case 'Corporate':
    case 'Audit':
      return 'Administrative';
    default:
      if (legacyGroup.toLowerCase().includes('communicat') || legacyGroup === 'Clarifications') {
        return 'Communication';
      }
      return 'Administrative';
  }
}

export const DEFAULT_CUT_OPERATOR_PERMISSIONS: Permission[] = [
  PERMISSIONS.USER_VIEW_OWN,
  PERMISSIONS.USER_UPDATE_OWN,
  PERMISSIONS.USER_CHANGE_PASSWORD,
  PERMISSIONS.CASE_VIEW_ASSIGNED,
  PERMISSIONS.CASE_CUT,
  PERMISSIONS.CASE_CUT_REPORT_VIEW,
  PERMISSIONS.CASE_UPDATE,
  PERMISSIONS.CLARIFICATION_CREATE,
  PERMISSIONS.CLARIFICATION_REPLY,
  PERMISSIONS.CLARIFICATION_RESOLVE,
];
