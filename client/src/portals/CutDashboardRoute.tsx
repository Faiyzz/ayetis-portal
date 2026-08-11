import { useAuthStore } from '@/features/auth/store';
import { CutOperatorDashboard } from '@/portals/CutOperatorDashboard';

export function CutDashboardRoute() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return <CutOperatorDashboard firstName={user.firstName} />;
}
