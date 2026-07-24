import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { AppShell, DashboardHome, GuestOnly, RequireAuth } from '@/portals/AppShell';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardHome />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
