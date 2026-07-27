import { PERMISSIONS, ROLE_LABELS, type Role } from '@ayetis/shared';
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
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}

export function RequirePermission({ permission }: { permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS] }) {
  const { can } = usePermissions();
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading session…
      </div>
    );
  }

  if (!can(permission)) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}

export function AppShell() {
  const user = useAuthStore((s) => s.user)!;
  const logout = useAuthStore((s) => s.logout);
  const { can } = usePermissions();

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <BrandMark />
          <nav className="flex flex-wrap items-center justify-end gap-1 text-sm sm:gap-2">
            <Link
              to="/app"
              className="rounded-lg px-3 py-2 font-medium text-muted hover:bg-brand-50 hover:text-brand-700"
            >
              Dashboard
            </Link>
            {can(PERMISSIONS.USER_LIST) ? (
              <Link
                to="/app/users"
                className="rounded-lg px-3 py-2 font-medium text-muted hover:bg-brand-50 hover:text-brand-700"
              >
                Users
              </Link>
            ) : null}
            {can(PERMISSIONS.ROLE_VIEW_PERMISSIONS) ? (
              <Link
                to="/app/roles"
                className="rounded-lg px-3 py-2 font-medium text-muted hover:bg-brand-50 hover:text-brand-700"
              >
                Roles
              </Link>
            ) : null}
            <Link
              to="/app/change-password"
              className="rounded-lg px-3 py-2 font-medium text-muted hover:bg-brand-50 hover:text-brand-700"
            >
              Password
            </Link>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-3 py-2 font-medium text-muted hover:bg-red-50 hover:text-red-600"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <Outlet context={{ user }} />
      </main>

      <div className="mx-auto max-w-6xl px-5 pb-8 text-xs text-muted sm:px-8">
        Signed in as {user.firstName} {user.lastName} · {ROLE_LABELS[user.role as Role]} ·{' '}
        {user.permissions.length} permissions
      </div>
    </div>
  );
}

export function DashboardHome() {
  const user = useAuthStore((s) => s.user)!;
  const { can } = usePermissions();

  return (
    <div>
      <p className="text-sm font-medium text-brand-600">Workspace</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">
        Hello, {user.firstName}
      </h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
        Roles stay fixed. Admins can grant or deny extra permissions on roles and individual users.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Role', value: ROLE_LABELS[user.role as Role] },
          { label: 'Email', value: user.email },
          { label: 'Effective permissions', value: String(user.permissions.length) },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{item.label}</p>
            <p className="mt-2 text-lg font-semibold text-ink">{item.value}</p>
          </div>
        ))}
      </div>

      {(can(PERMISSIONS.USER_LIST) || can(PERMISSIONS.ROLE_VIEW_PERMISSIONS)) && (
        <div className="mt-8 flex flex-wrap gap-3">
          {can(PERMISSIONS.USER_LIST) ? (
            <Link
              to="/app/users"
              className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(103,61,230,0.28)] hover:bg-brand-600"
            >
              Manage users
            </Link>
          ) : null}
          {can(PERMISSIONS.ROLE_VIEW_PERMISSIONS) ? (
            <Link
              to="/app/roles"
              className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand-300 hover:text-brand-700"
            >
              Role permissions
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
