import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { useAuthStore } from '@/features/auth/store';

export function FacilityDashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Facility"
        title={`Welcome, ${user?.firstName ?? 'Facility Admin'}`}
        subtitle="Manage cases and local activity for your assigned facility."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/app/cases"
          className="rounded-xl border border-line bg-white px-5 py-4 transition hover:border-brand-300"
        >
          <p className="text-sm font-semibold text-ink">Facility cases</p>
          <p className="mt-1 text-sm text-muted">View cases scoped to your facility.</p>
        </Link>
        <Link
          to="/app/cases/new"
          className="rounded-xl border border-line bg-white px-5 py-4 transition hover:border-brand-300"
        >
          <p className="text-sm font-semibold text-ink">Create case</p>
          <p className="mt-1 text-sm text-muted">Submit a new case for a facility doctor.</p>
        </Link>
      </div>
    </div>
  );
}
