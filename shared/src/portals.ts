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
        description: 'Browse and manage all cases',
        to: '/app/cases',
      },
      {
        label: 'Users',
        description: 'View and manage team accounts',
        to: '/app/users',
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
        label: 'Case listing',
        description: 'Validate and update case details',
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
        label: 'My queue',
        description: 'Assigned production cases will appear here',
      },
      {
        label: 'Performance',
        description: 'Monthly designer metrics coming soon',
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
      },
      {
        label: 'Error trends',
        description: 'QC performance reporting coming soon',
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
        description: 'Cases needing clinical guidance',
      },
      {
        label: 'Consultant QC',
        description: 'Escalated QC reviews will land here',
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
      },
      {
        label: 'Performance',
        description: 'Team and member reports coming soon',
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
      'Doctor satisfaction and complaint trends',
    ],
    shortcuts: [
      {
        label: 'Case reports',
        description: 'Pipeline totals and status breakdowns',
      },
      {
        label: 'Department reports',
        description: 'Designer, QC, and consultant analytics',
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
