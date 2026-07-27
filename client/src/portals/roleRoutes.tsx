import { getDashboardPath } from '@ayetis/shared';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';

/** Sends an authenticated user to their role home. */
export function RoleHomeRedirect() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getDashboardPath(user.role)} replace />;
}
