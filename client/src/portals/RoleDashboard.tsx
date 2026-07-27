import {
  getDashboardConfig,
  getDashboardPath,
  ROLES,
  type Role,
  type RoleDashboardConfig,
} from '@ayetis/shared';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { CoordinatorDashboard } from '@/portals/CoordinatorDashboard';
import { DesignerDashboard } from '@/portals/DesignerDashboard';

interface RoleDashboardProps {
  role: Role;
}

export function RoleDashboard({ role }: RoleDashboardProps) {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  if (role === ROLES.COORDINATOR) {
    return <CoordinatorDashboard firstName={user.firstName} />;
  }

  if (role === ROLES.DESIGNER) {
    return <DesignerDashboard firstName={user.firstName} />;
  }

  return <DashboardView config={getDashboardConfig(role)} firstName={user.firstName} />;
}

function DashboardView({
  config,
  firstName,
}: {
  config: RoleDashboardConfig;
  firstName: string;
}) {
  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-line bg-white px-5 py-5 sm:px-6">
        <p className="text-sm font-medium text-brand-600">{config.title}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">
          Welcome, {firstName}
        </h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{config.subtitle}</p>
      </header>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Focus areas</h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {config.highlights.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-line bg-white px-4 py-4 text-[15px] text-ink"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Shortcuts</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {config.shortcuts.map((shortcut) => {
            const content = (
              <>
                <p className="font-semibold text-ink">{shortcut.label}</p>
                <p className="mt-1 text-sm text-muted">{shortcut.description}</p>
              </>
            );

            if (shortcut.to) {
              return (
                <Link
                  key={shortcut.label}
                  to={shortcut.to}
                  className="rounded-xl border border-line bg-white px-4 py-4 transition hover:border-brand-300 hover:bg-brand-50/40"
                >
                  {content}
                </Link>
              );
            }

            return (
              <div
                key={shortcut.label}
                className="rounded-xl border border-dashed border-line bg-white px-4 py-4"
              >
                {content}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
