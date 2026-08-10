import { ROLES, ROLE_LABELS, type Role } from './roles';

export interface DashboardShortcut {
  label: string;
  description: string;
  /** App-relative path, e.g. `/app/users` */
  to?: string;
}

export interface RoleDashboardConfig {
  role: Role;
  title: string;
  subtitle: string;
  /** Absolute app path for this role's home dashboard */
  path: string;
  highlights: string[];
  shortcuts: DashboardShortcut[];
}

/**
 * Thin portal metadata — dashboards compose shared features; they do not own domain logic.
 */
export const ROLE_DASHBOARDS: Record<Role, RoleDashboardConfig> = {
  [ROLES.ADMIN]: {
    role: ROLES.ADMIN,
    title: 'Admin portal',
    subtitle: 'Manage users, permissions, departments, and overall workflow health.',
    path: '/app/admin',
    highlights: [
      'User & permission management',
      'Workflow and productivity oversight',
      'Reports, priorities, and audit controls',
    ],
    shortcuts: [
      {
        label: 'Cases',
        description: 'Browse, reassign, and set urgent priority',
        to: '/app/cases',
      },
      {
        label: 'Users',
        description: 'View and manage team accounts',
        to: '/app/users',
      },
      {
        label: 'Registrations',
        description: 'Approve verified signup requests',
        to: '/app/registrations',
      },
      {
        label: 'Create user',
        description: 'Register a user for a system role',
        to: '/app/users/create',
      },
      {
        label: 'Role permissions',
        description: 'Grant or deny extras per role',
        to: '/app/roles',
      },
      {
        label: 'Admin console',
        description: 'Departments, complaints, delete approvals',
        to: '/app/admin',
      },
      {
        label: 'Complaint reports',
        description: 'Trends, ratings, and per-doctor decision rates',
        to: '/app/complaints',
      },
      {
        label: 'Activity log',
        description: 'Audit logins and system activity',
        to: '/app/activity',
      },
    ],
  },
  [ROLES.DOCTOR]: {
    role: ROLES.DOCTOR,
    title: 'Doctor portal',
    subtitle: 'Submit cases, track progress, review deliveries, and respond to clarifications.',
    path: '/app/doctor',
    highlights: [
      'Submit new cases and treatment instructions',
      'Track status from validation to delivery',
      'Approve cases or request modifications',
    ],
    shortcuts: [
      {
        label: 'My cases',
        description: 'View submitted and in-progress cases',
        to: '/app/cases',
      },
      {
        label: 'Create case',
        description: 'Submit a new patient treatment request',
        to: '/app/cases/new',
      },
      {
        label: 'Deliveries',
        description: 'Review delivered cases and decide',
        to: '/app/doctor',
      },
    ],
  },
  [ROLES.COORDINATOR]: {
    role: ROLES.COORDINATOR,
    title: 'Coordinator portal',
    subtitle: 'Validate new submissions, request clarifications, and route ready cases.',
    path: '/app/coordinator',
    highlights: [
      'New and pending validation queues',
      'Clarification follow-ups with doctors',
      'Assignment and priority management',
    ],
    shortcuts: [
      {
        label: 'Coordinator dashboard',
        description: 'Queues with delay colour bars',
        to: '/app/coordinator',
      },
      {
        label: 'Case listing',
        description: 'Validate, clarify, and assign',
        to: '/app/cases',
      },
    ],
  },
  [ROLES.DESIGNER]: {
    role: ROLES.DESIGNER,
    title: 'Designer portal',
    subtitle: 'Work assigned cases, request missing data, and submit designs to QC.',
    path: '/app/designer',
    highlights: [
      'Assigned and active production cases',
      'Clarification requests to doctors',
      'Submit completed work to QC',
    ],
    shortcuts: [
      {
        label: 'My assigned cases',
        description: 'Cases routed to you',
        to: '/app/designer',
      },
      {
        label: 'Case listing',
        description: 'Filter and open assigned work',
        to: '/app/cases',
      },
      {
        label: 'My performance',
        description: 'Monthly cases and modifications',
        to: '/app/designer?tab=performance',
      },
    ],
  },
  [ROLES.QC]: {
    role: ROLES.QC,
    title: 'Quality Control portal',
    subtitle: 'Review completed designs, approve quality, or return with error codes.',
    path: '/app/qc',
    highlights: [
      'Pending and in-progress QC reviews',
      'Approve or reject with error codes',
      'Deliver approved work to doctors',
    ],
    shortcuts: [
      {
        label: 'QC queue',
        description: 'Cases waiting for quality review',
        to: '/app/qc',
      },
      {
        label: 'Performance',
        description: 'Case counts, reverts, and error trends',
        to: '/app/qc?tab=performance',
      },
    ],
  },
  [ROLES.ORTHODONTIST]: {
    role: ROLES.ORTHODONTIST,
    title: 'Consultant portal',
    subtitle: 'Provide clinical guidance, remarks, and consultant QC when required.',
    path: '/app/orthodontist',
    highlights: [
      'Assigned consultation cases',
      'Clinical remarks with color indicators',
      'Consultant QC review cycle',
    ],
    shortcuts: [
      {
        label: 'Consultation queue',
        description: 'Cases with colour status indicators',
        to: '/app/orthodontist',
      },
      {
        label: 'My performance',
        description: 'Reviews, consultations, and error trends',
        to: '/app/orthodontist?tab=performance',
      },
    ],
  },
  [ROLES.SUPERVISOR]: {
    role: ROLES.SUPERVISOR,
    title: 'Supervisor portal',
    subtitle: 'Monitor designer, QC, and consultant queues and team performance.',
    path: '/app/supervisor',
    highlights: [
      'Team workload across production queues',
      'Delay and productivity monitoring',
      'Month-wise team performance',
    ],
    shortcuts: [
      {
        label: 'Team queues',
        description: 'Designer, QC, and consultant overview',
        to: '/app/supervisor',
      },
      {
        label: 'Performance',
        description: 'Month-wise team and individual metrics',
        to: '/app/supervisor?tab=performance',
      },
      {
        label: 'Team members',
        description: 'Add or remove Designer, QC, Consultant',
        to: '/app/supervisor?tab=members',
      },
    ],
  },
  [ROLES.ANALYTICS]: {
    role: ROLES.ANALYTICS,
    title: 'Reporting & Analytics',
    subtitle: 'View case, department, and performance reports across the workflow.',
    path: '/app/analytics',
    highlights: [
      'Case volume and pipeline reports',
      'Department and role performance',
      'Month / quarter filters and CSV export',
    ],
    shortcuts: [
      {
        label: 'Case pipeline',
        description: 'Totals by status across the workflow',
        to: '/app/analytics',
      },
      {
        label: 'Department comparison',
        description: 'Benchmark designers, QC, consultants, supervisors',
        to: '/app/analytics',
      },
      {
        label: 'Complaints & ratings',
        description: 'Doctor complaint and decision trends',
        to: '/app/complaints',
      },
    ],
  },
  [ROLES.CORPORATE_ADMIN]: {
    role: ROLES.CORPORATE_ADMIN,
    title: 'Corporate Admin portal',
    subtitle: 'Manage facilities, employees, sub-accounts, and organization cases.',
    path: '/app/corporate',
    highlights: [
      'Organization profile and facilities worldwide',
      'Employees and sub-accounts with verified emails',
      'Cases across all facilities in your company',
    ],
    shortcuts: [
      {
        label: 'Corporate home',
        description: 'Dashboard counts and facilities',
        to: '/app/corporate',
      },
      {
        label: 'Facilities',
        description: 'Create and manage branches',
        to: '/app/corporate/facilities',
      },
      {
        label: 'Employees',
        description: 'Create facility employees',
        to: '/app/corporate/employees',
      },
      {
        label: 'Sub-accounts',
        description: 'Create doctor sub-accounts',
        to: '/app/corporate/subaccounts',
      },
      {
        label: 'Cases',
        description: 'Organization cases',
        to: '/app/cases',
      },
    ],
  },
  [ROLES.FACILITY_ADMIN]: {
    role: ROLES.FACILITY_ADMIN,
    title: 'Facility Admin portal',
    subtitle: 'Manage your facility cases and local employees.',
    path: '/app/facility',
    highlights: [
      'Facility-scoped case visibility',
      'Create cases for your facility',
      'Manage local employees',
    ],
    shortcuts: [
      {
        label: 'Facility home',
        description: 'Facility overview',
        to: '/app/facility',
      },
      {
        label: 'Cases',
        description: 'Facility cases',
        to: '/app/cases',
      },
      {
        label: 'Create case',
        description: 'Submit a new case',
        to: '/app/cases/new',
      },
    ],
  },
};

export function getDashboardPath(role: Role): string {
  return ROLE_DASHBOARDS[role].path;
}

export function getDashboardConfig(role: Role): RoleDashboardConfig {
  return ROLE_DASHBOARDS[role];
}

export function getRoleOptions(): Array<{ value: Role; label: string }> {
  return (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  }));
}
