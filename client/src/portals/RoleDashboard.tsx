import {
  getDashboardConfig,
  getDashboardPath,
  ROLES,
  type Role,
  type RoleDashboardConfig,
} from '@ayetis/shared';
import { Link, Navigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { useAuthStore } from '@/features/auth/store';
import { AdminDashboard } from '@/portals/AdminDashboard';
import { AnalyticsDashboard } from '@/portals/AnalyticsDashboard';
import { ConsultantDashboard } from '@/portals/ConsultantDashboard';
import { CoordinatorDashboard } from '@/portals/CoordinatorDashboard';
import { DesignerDashboard } from '@/portals/DesignerDashboard';
import { DoctorDashboard } from '@/portals/DoctorDashboard';
import { QcDashboard } from '@/portals/QcDashboard';
import { SupervisorDashboard } from '@/portals/SupervisorDashboard';

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

  if (role === ROLES.ADMIN) {
    return <AdminDashboard firstName={user.firstName} />;
  }

  if (role === ROLES.DOCTOR) {
    return <DoctorDashboard firstName={user.firstName} />;
  }

  if (role === ROLES.COORDINATOR) {
    return <CoordinatorDashboard firstName={user.firstName} />;
  }

  if (role === ROLES.DESIGNER) {
    return <DesignerDashboard firstName={user.firstName} />;
  }

  if (role === ROLES.QC) {
    return <QcDashboard firstName={user.firstName} />;
  }

  if (role === ROLES.ORTHODONTIST) {
    return <ConsultantDashboard firstName={user.firstName} />;
  }

  if (role === ROLES.SUPERVISOR) {
    return <SupervisorDashboard firstName={user.firstName} />;
  }

  if (role === ROLES.ANALYTICS) {
    return <AnalyticsDashboard firstName={user.firstName} />;
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
      <PageHeader
        eyebrow={config.title}
        title={`Welcome, ${firstName}`}
        subtitle={config.subtitle}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {config.highlights.map((item) => (
          <div key={item} className="rounded-xl border border-line bg-white px-4 py-3">
            <p className="text-sm text-ink">{item}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Shortcuts</h2>
        <ul className="mt-3 divide-y divide-line">
          {config.shortcuts.map((shortcut) => (
            <li key={shortcut.label} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-ink">{shortcut.label}</p>
                <p className="text-sm text-muted">{shortcut.description}</p>
              </div>
              {shortcut.to ? (
                <Link
                  to={shortcut.to}
                  className="rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-brand-300"
                >
                  Open
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
