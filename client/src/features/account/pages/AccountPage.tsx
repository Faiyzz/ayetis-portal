import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { useAuthStore } from '@/features/auth/store';

export function AccountPage() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  const rows: { label: string; value: string }[] = [
    { label: 'Name', value: `${user.firstName} ${user.lastName}`.trim() || '—' },
    { label: 'Email', value: user.email },
    ...(user.doctorId ? [{ label: 'Doctor ID', value: user.doctorId }] : []),
    { label: 'Role', value: user.role },
    ...(user.clinicName ? [{ label: 'Clinic', value: user.clinicName }] : []),
    ...(user.companyName ? [{ label: 'Company', value: user.companyName }] : []),
    ...(user.assignedCountry ? [{ label: 'Country', value: user.assignedCountry }] : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="My account"
        subtitle="Your portal identity. Use Password to change sign-in credentials."
      />

      <section className="max-w-lg rounded-xl border border-line bg-white p-5">
        <dl className="space-y-3">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">{row.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
        <Link
          to="/app/change-password"
          className="mt-5 inline-flex rounded-lg border border-line px-3.5 py-2 text-sm font-semibold text-ink hover:border-brand-300"
        >
          Change password
        </Link>
      </section>
    </div>
  );
}
