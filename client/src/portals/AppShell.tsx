import { ROLE_LABELS, type Role } from '@ayetis/shared';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { BrandMark } from '@/features/auth/components/AuthUI';
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

export function AppShell() {
  const user = useAuthStore((s) => s.user)!;
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <BrandMark />
          <nav className="flex items-center gap-2 text-sm">
            <Link
              to="/app"
              className="rounded-lg px-3 py-2 font-medium text-muted hover:bg-brand-50 hover:text-brand-700"
            >
              Dashboard
            </Link>
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
        Signed in as {user.firstName} {user.lastName} · {ROLE_LABELS[user.role as Role]}
      </div>
    </div>
  );
}

export function DashboardHome() {
  const user = useAuthStore((s) => s.user)!;

  return (
    <div>
      <p className="text-sm font-medium text-brand-600">Workspace</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">
        Hello, {user.firstName}
      </h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
        Auth, roles, and password flows are ready. Case workflow portals will build on this
        foundation next.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Role', value: ROLE_LABELS[user.role as Role] },
          { label: 'Email', value: user.email },
          { label: 'Status', value: user.isActive ? 'Active' : 'Inactive' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{item.label}</p>
            <p className="mt-2 text-lg font-semibold text-ink">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
