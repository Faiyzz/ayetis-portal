import { getDashboardPath, PERMISSIONS, ROLE_LABELS, ROLES, type Permission, type Role } from '@ayetis/shared';
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PageHeaderProvider } from '@/components/PageHeader';
import {
  IconActivity,
  IconBell,
  IconBriefcase,
  IconChevron,
  IconKey,
  IconLayoutDashboard,
  IconList,
  IconMessageSquare,
  IconPlus,
  IconShield,
  IconUsers,
} from '@/components/NavIcons';
import { BrandMark } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import { useAuthStore } from '@/features/auth/store';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { useBranding } from '@/features/settings/useBranding';
import { ThemeToggle } from '@/features/theme/ThemeToggle';

export function RequireAuth() {
  const user = useAuthStore((s) => s.user);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading session…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const mustUpdatePassword = Boolean(user.mustChangePassword || user.passwordExpired);
  if (mustUpdatePassword && location.pathname !== '/app/change-password') {
    return <Navigate to="/app/change-password" replace />;
  }

  return <Outlet />;
}

export function GuestOnly() {
  const user = useAuthStore((s) => s.user);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading session…
      </div>
    );
  }

  if (user) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return <Outlet />;
}

export function RequirePermission({
  permission,
}: {
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
}) {
  const { can } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading session…
      </div>
    );
  }

  if (!can(permission)) {
    return <Navigate to={user ? getDashboardPath(user.role) : '/login'} replace />;
  }

  return <Outlet />;
}

export function RequireAnyPermission({
  permissions,
}: {
  permissions: Array<(typeof PERMISSIONS)[keyof typeof PERMISSIONS]>;
}) {
  const { canAny } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading session…
      </div>
    );
  }

  if (!canAny(...permissions)) {
    return <Navigate to={user ? getDashboardPath(user.role) : '/login'} replace />;
  }

  return <Outlet />;
}

type NavChild = {
  id: string;
  label: string;
  to: string;
  hash?: string;
  icon?: ReactNode;
  isActive: (pathname: string, hash: string) => boolean;
};

type NavItem = {
  id: string;
  label: string;
  to: string;
  icon: ReactNode;
  isActive: (pathname: string) => boolean;
  permission?: Permission;
  anyOf?: Permission[];
  children?: NavChild[];
};

function buildNavItems(
  dashboardPath: string,
  options: {
    canCreateCase: boolean;
    canCreateUser: boolean;
    canListRegistrations: boolean;
    canManageCorporate: boolean;
  },
): NavItem[] {
  const caseChildren: NavChild[] = [
    {
      id: 'all-cases',
      label: 'All cases',
      to: '/app/cases',
      icon: <IconList className="h-3.5 w-3.5" />,
      isActive: (pathname, hash) => pathname === '/app/cases' && !hash,
    },
  ];

  if (options.canCreateCase) {
    caseChildren.push({
      id: 'create-case',
      label: 'Create case',
      to: '/app/cases/new',
      icon: <IconPlus className="h-3.5 w-3.5" />,
      isActive: (pathname) => pathname === '/app/cases/new',
    });
  }

  const userChildren: NavChild[] = [
    {
      id: 'all-users',
      label: 'Directory',
      to: '/app/users',
      icon: <IconList className="h-3.5 w-3.5" />,
      isActive: (pathname) =>
        pathname === '/app/users' ||
        (pathname.startsWith('/app/users/') && !pathname.startsWith('/app/users/create')),
    },
  ];

  if (options.canListRegistrations) {
    userChildren.push({
      id: 'registrations',
      label: 'Registrations',
      to: '/app/registrations',
      icon: <IconList className="h-3.5 w-3.5" />,
      isActive: (pathname) => pathname.startsWith('/app/registrations'),
    });
  }

  if (options.canCreateUser) {
    userChildren.push({
      id: 'create-user',
      label: 'Create user',
      to: '/app/users/create',
      icon: <IconPlus className="h-3.5 w-3.5" />,
      isActive: (pathname) => pathname === '/app/users/create',
    });
  }

  return [
    {
      id: 'dashboard',
      label: 'Dashboard',
      to: dashboardPath,
      icon: <IconLayoutDashboard />,
      isActive: (pathname) => pathname === dashboardPath || pathname === '/app',
    },
    {
      id: 'cases',
      label: 'Cases',
      to: '/app/cases',
      icon: <IconBriefcase />,
      anyOf: [
        PERMISSIONS.CASE_VIEW_OWN,
        PERMISSIONS.CASE_VIEW_ALL,
        PERMISSIONS.CASE_VIEW_ASSIGNED,
        PERMISSIONS.CASE_VIEW_ORG,
        PERMISSIONS.CASE_VIEW_FACILITY,
      ],
      isActive: (pathname) => pathname.startsWith('/app/cases'),
      children: caseChildren,
    },
    ...(options.canManageCorporate
      ? [
          {
            id: 'corporate',
            label: 'Corporate',
            to: '/app/corporate',
            icon: <IconUsers />,
            anyOf: [
              PERMISSIONS.ORG_MANAGE_SELF,
              PERMISSIONS.FACILITY_MANAGE,
              PERMISSIONS.EMPLOYEE_MANAGE,
              PERMISSIONS.SUBACCOUNT_MANAGE,
              PERMISSIONS.CASE_VIEW_ORG,
              PERMISSIONS.CORPORATE_REPORT_VIEW,
              PERMISSIONS.CORPORATE_AUDIT_VIEW,
            ],
            isActive: (pathname: string) => pathname.startsWith('/app/corporate'),
            children: [
              {
                id: 'corp-home',
                label: 'Overview',
                to: '/app/corporate',
                icon: <IconLayoutDashboard className="h-3.5 w-3.5" />,
                isActive: (pathname: string) => pathname === '/app/corporate',
              },
              {
                id: 'corp-facilities',
                label: 'Facilities',
                to: '/app/corporate/facilities',
                icon: <IconList className="h-3.5 w-3.5" />,
                isActive: (pathname: string) => pathname.startsWith('/app/corporate/facilities'),
              },
              {
                id: 'corp-employees',
                label: 'Employees',
                to: '/app/corporate/employees',
                icon: <IconUsers className="h-3.5 w-3.5" />,
                isActive: (pathname: string) => pathname.startsWith('/app/corporate/employees'),
              },
              {
                id: 'corp-subaccounts',
                label: 'Sub-accounts',
                to: '/app/corporate/subaccounts',
                icon: <IconPlus className="h-3.5 w-3.5" />,
                isActive: (pathname: string) => pathname.startsWith('/app/corporate/subaccounts'),
              },
              {
                id: 'corp-reports',
                label: 'Reports',
                to: '/app/corporate/reports',
                icon: <IconList className="h-3.5 w-3.5" />,
                isActive: (pathname: string) => pathname.startsWith('/app/corporate/reports'),
              },
              {
                id: 'corp-audit',
                label: 'Audit',
                to: '/app/corporate/audit',
                icon: <IconActivity className="h-3.5 w-3.5" />,
                isActive: (pathname: string) => pathname.startsWith('/app/corporate/audit'),
              },
            ],
          } satisfies NavItem,
        ]
      : []),
    {
      id: 'users',
      label: 'Users',
      to: '/app/users',
      icon: <IconUsers />,
      permission: PERMISSIONS.USER_LIST,
      isActive: (pathname) =>
        pathname.startsWith('/app/users') || pathname.startsWith('/app/registrations'),
      children: userChildren,
    },
    {
      id: 'roles',
      label: 'Roles',
      to: '/app/roles',
      icon: <IconShield />,
      permission: PERMISSIONS.ROLE_VIEW_PERMISSIONS,
      isActive: (pathname) => pathname.startsWith('/app/roles'),
    },
    {
      id: 'complaints',
      label: 'Complaints',
      to: '/app/complaints',
      icon: <IconMessageSquare />,
      anyOf: [
        PERMISSIONS.COMPLAINT_CREATE,
        PERMISSIONS.COMPLAINT_VIEW,
        PERMISSIONS.COMPLAINT_MANAGE,
      ],
      isActive: (pathname) => pathname.startsWith('/app/complaints'),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      to: '/app/notifications',
      icon: <IconBell />,
      isActive: (pathname) => pathname.startsWith('/app/notifications'),
    },
    {
      id: 'activity',
      label: 'Activity log',
      to: '/app/activity',
      icon: <IconActivity />,
      permission: PERMISSIONS.AUDIT_VIEW,
      isActive: (pathname) => pathname.startsWith('/app/activity'),
    },
    {
      id: 'cancellations',
      label: 'Cancellations',
      to: '/app/cancellations',
      icon: <IconList />,
      permission: PERMISSIONS.CANCELLATION_REPORT_VIEW,
      isActive: (pathname) => pathname.startsWith('/app/cancellations'),
    },
    {
      id: 'commercial',
      label: 'Commercial',
      to: '/app/commercial',
      icon: <IconBriefcase />,
      anyOf: [PERMISSIONS.TREATMENT_PLAN_MANAGE, PERMISSIONS.DISCOUNT_CODE_MANAGE],
      isActive: (pathname) => pathname.startsWith('/app/commercial'),
    },
    {
      id: 'settings',
      label: 'Settings',
      to: '/app/settings',
      icon: <IconShield />,
      anyOf: [
        PERMISSIONS.SETTINGS_MANAGE,
        PERMISSIONS.MASTER_DATA_MANAGE,
        PERMISSIONS.REGION_MANAGE,
        PERMISSIONS.BRANDING_MANAGE,
        PERMISSIONS.EMAIL_TEMPLATE_MANAGE,
        PERMISSIONS.PRIVACY_MANAGE,
      ],
      isActive: (pathname) => pathname.startsWith('/app/settings'),
    },
    {
      id: 'password',
      label: 'Password',
      to: '/app/change-password',
      icon: <IconKey />,
      isActive: (pathname) => pathname === '/app/change-password',
    },
  ];
}

function NavLinkRow({
  to,
  hash,
  active,
  onNavigate,
  children,
  depth = 0,
}: {
  to: string;
  hash?: string;
  active: boolean;
  onNavigate: () => void;
  children: ReactNode;
  depth?: number;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  function handleClick(event: MouseEvent) {
    if (!hash) {
      onNavigate();
      return;
    }

    event.preventDefault();
    const targetPath = to;
    if (location.pathname === targetPath) {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.replaceState(null, '', `#${hash}`);
      }
    } else {
      void navigate(`${targetPath}#${hash}`);
    }
    onNavigate();
  }

  return (
    <Link
      to={hash ? `${to}#${hash}` : to}
      onClick={handleClick}
      aria-current={active ? 'page' : undefined}
      className={[
        'group flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition',
        depth > 0 ? 'px-2.5 py-1.5' : 'px-3 py-2',
        active
          ? depth > 0
            ? 'bg-brand-50 text-brand-700'
            : 'bg-brand-700 text-brand-50'
          : depth > 0
            ? 'text-muted hover:bg-brand-50/70 hover:text-brand-700'
            : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}

function SidebarNav({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate: () => void;
}) {
  const location = useLocation();
  const hash = location.hash.replace(/^#/, '');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of items) {
        if (item.children && item.isActive(location.pathname) && !next[item.id]) {
          next[item.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [location.pathname, items]);

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
      {items.map((item) => {
        const parentActive = item.isActive(location.pathname);
        const isOpen = Boolean(expanded[item.id] ?? parentActive);
        const hasChildren = Boolean(item.children?.length);

        return (
          <div key={item.id}>
            <div className="flex items-center gap-0.5">
              <Link
                to={item.to}
                onClick={onNavigate}
                aria-current={parentActive && !hasChildren ? 'page' : undefined}
                className={[
                  'flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold tracking-tight transition',
                  parentActive && !hasChildren
                    ? 'bg-brand-700 text-brand-50'
                    : parentActive
                      ? 'bg-brand-50 text-brand-800'
                      : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700',
                ].join(' ')}
              >
                <span
                  className={[
                    'shrink-0 opacity-90',
                    parentActive && !hasChildren ? 'text-brand-50' : 'text-slate-500',
                    parentActive && hasChildren ? 'text-brand-600' : '',
                  ].join(' ')}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
              {hasChildren ? (
                <button
                  type="button"
                  aria-label={isOpen ? `Collapse ${item.label}` : `Expand ${item.label}`}
                  aria-expanded={isOpen}
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [item.id]: !isOpen }))
                  }
                  className={[
                    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-brand-50 hover:text-brand-700',
                    isOpen ? 'text-brand-600' : '',
                  ].join(' ')}
                >
                  <IconChevron
                    className={[
                      'h-4 w-4 transition-transform duration-200',
                      isOpen ? 'rotate-90' : '',
                    ].join(' ')}
                  />
                </button>
              ) : null}
            </div>

            {hasChildren && isOpen ? (
              <div className="relative ml-4 mt-0.5 space-y-0.5 border-l border-line pl-2.5">
                {item.children!.map((child) => {
                  const active = child.isActive(location.pathname, hash);

                  return (
                    <NavLinkRow
                      key={child.id}
                      to={child.to}
                      hash={child.hash}
                      active={active}
                      onNavigate={onNavigate}
                      depth={1}
                    >
                      {child.icon ? (
                        <span className="shrink-0 opacity-70">{child.icon}</span>
                      ) : (
                        <span className="inline-block h-1 w-1 shrink-0 rounded-full bg-current opacity-40" />
                      )}
                      <span className="truncate leading-snug">{child.label}</span>
                    </NavLinkRow>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const user = useAuthStore((s) => s.user)!;
  const logout = useAuthStore((s) => s.logout);
  const { can, canAny } = usePermissions();
  const branding = useBranding();
  const [mobileOpen, setMobileOpen] = useState(false);
  const titleSlotRef = useRef<HTMLDivElement>(null);
  const actionsSlotRef = useRef<HTMLDivElement>(null);
  const dashboardPath = getDashboardPath(user.role);
  const canCreateCase = can(PERMISSIONS.CASE_CREATE);
  const canCreateUser = can(PERMISSIONS.USER_CREATE);
  const canListRegistrations = can(PERMISSIONS.REGISTRATION_LIST);
  const canManageCorporate =
    user.role === ROLES.ADMIN ||
    canAny(
      PERMISSIONS.ORG_MANAGE_SELF,
      PERMISSIONS.FACILITY_MANAGE,
      PERMISSIONS.EMPLOYEE_MANAGE,
      PERMISSIONS.SUBACCOUNT_MANAGE,
      PERMISSIONS.CASE_VIEW_ORG,
      PERMISSIONS.CORPORATE_REPORT_VIEW,
      PERMISSIONS.CORPORATE_AUDIT_VIEW,
    );

  const navItems = useMemo(
    () =>
      buildNavItems(dashboardPath, {
        canCreateCase,
        canCreateUser,
        canListRegistrations,
        canManageCorporate,
      }).filter((item) => {
        if (item.permission) return can(item.permission);
        if (item.anyOf?.length) return canAny(...item.anyOf);
        return true;
      }),
    [dashboardPath, canCreateCase, canCreateUser, canListRegistrations, canManageCorporate, can, canAny],
  );

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <PageHeaderProvider titleRef={titleSlotRef} actionsRef={actionsSlotRef}>
      <div className="min-h-screen bg-surface lg:flex lg:h-screen lg:overflow-hidden">
        {mobileOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
            onClick={closeMobile}
          />
        ) : null}

        <aside
          className={[
            'fixed inset-y-0 left-0 z-40 flex w-65 flex-col border-r border-line bg-panel transition-transform duration-200 lg:static lg:h-full lg:shrink-0 lg:translate-x-0',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <div className="border-b border-line px-4 py-4">
            <BrandMark
              tone="dark"
              companyName={branding?.companyName?.replace(/\s*Portal$/i, '') || 'Ayetis'}
              logoUrl={branding?.headerLogoUrl || branding?.loginLogoUrl}
            />
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              {ROLE_LABELS[user.role as Role]} portal
            </p>
          </div>

          <SidebarNav items={navItems} onNavigate={closeMobile} />

          <div className="border-t border-line p-3">
            <div className="rounded-lg bg-surface px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-ink">
                {user.firstName} {user.lastName}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void logout();
              }}
              className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-muted transition hover:bg-red-50 hover:text-red-600"
            >
              Log out
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:h-full lg:min-h-0">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-panel px-4 py-2.5 lg:px-8">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink lg:hidden"
            >
              <span className="sr-only">Menu</span>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path
                  d="M3 4.5h12M3 9h12M3 13.5h12"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <div ref={titleSlotRef} className="min-w-0 flex-1" />

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div ref={actionsSlotRef} className="flex items-center gap-2" />
              <ThemeToggle />
              <NotificationBell />
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
              <Outlet context={{ user }} />
            </div>
          </main>
        </div>
      </div>
    </PageHeaderProvider>
  );
}
