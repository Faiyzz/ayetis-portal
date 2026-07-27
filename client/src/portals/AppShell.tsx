import { getDashboardPath, PERMISSIONS, ROLE_LABELS, type Permission, type Role } from '@ayetis/shared';
import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { BrandMark } from '@/features/auth/components/AuthUI';
import { usePermissions } from '@/features/auth/permissions';
import { useAuthStore } from '@/features/auth/store';

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

interface NavItem {
  id: string;
  label: string;
  to: string;
  /** Returns whether this item should appear active for the current path. */
  isActive: (pathname: string) => boolean;
  permission?: Permission;
  anyOf?: Permission[];
}

function buildNavItems(dashboardPath: string): NavItem[] {
  return [
    {
      id: 'dashboard',
      label: 'Dashboard',
      to: dashboardPath,
      isActive: (pathname) => pathname === dashboardPath || pathname === '/app',
    },
    {
      id: 'cases',
      label: 'Cases',
      to: '/app/cases',
      anyOf: [
        PERMISSIONS.CASE_VIEW_OWN,
        PERMISSIONS.CASE_VIEW_ALL,
        PERMISSIONS.CASE_VIEW_ASSIGNED,
      ],
      isActive: (pathname) =>
        pathname === '/app/cases' ||
        (pathname.startsWith('/app/cases/') && pathname !== '/app/cases/new'),
    },
    {
      id: 'create-case',
      label: 'Create case',
      to: '/app/cases/new',
      permission: PERMISSIONS.CASE_CREATE,
      isActive: (pathname) => pathname === '/app/cases/new',
    },
    {
      id: 'users',
      label: 'Users',
      to: '/app/users',
      permission: PERMISSIONS.USER_LIST,
      isActive: (pathname) =>
        pathname === '/app/users' ||
        (pathname.startsWith('/app/users/') && !pathname.startsWith('/app/users/create')),
    },
    {
      id: 'create-user',
      label: 'Create user',
      to: '/app/users/create',
      permission: PERMISSIONS.USER_CREATE,
      isActive: (pathname) => pathname === '/app/users/create',
    },
    {
      id: 'roles',
      label: 'Roles',
      to: '/app/roles',
      permission: PERMISSIONS.ROLE_VIEW_PERMISSIONS,
      isActive: (pathname) => pathname.startsWith('/app/roles'),
    },
    {
      id: 'activity',
      label: 'Activity log',
      to: '/app/activity',
      permission: PERMISSIONS.AUDIT_VIEW,
      isActive: (pathname) => pathname.startsWith('/app/activity'),
    },
    {
      id: 'password',
      label: 'Password',
      to: '/app/change-password',
      isActive: (pathname) => pathname === '/app/change-password',
    },
  ];
}

export function AppShell() {
  const user = useAuthStore((s) => s.user)!;
  const logout = useAuthStore((s) => s.logout);
  const { can, canAny } = usePermissions();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardPath = getDashboardPath(user.role);
  const navItems = buildNavItems(dashboardPath).filter((item) => {
    if (item.anyOf) return canAny(...item.anyOf);
    if (item.permission) return can(item.permission);
    return true;
  });

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
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
          'fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-line bg-white transition-transform duration-200 lg:static lg:h-full lg:shrink-0 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="border-b border-line px-4 py-4">
          <BrandMark />
          <p className="mt-2 text-xs text-muted">{ROLE_LABELS[user.role as Role]} portal</p>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
          {navItems.map((item) => {
            const active = item.isActive(location.pathname);
            return (
              <Link
                key={item.id}
                to={item.to}
                onClick={closeMobile}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-brand-500 text-white'
                    : 'text-muted hover:bg-brand-50 hover:text-brand-700',
                ].join(' ')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

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
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink"
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
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-muted">{ROLE_LABELS[user.role as Role]}</p>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
            <Outlet context={{ user }} />
          </div>
        </main>
      </div>
    </div>
  );
}
