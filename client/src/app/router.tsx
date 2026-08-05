import { ALL_ROLES, PERMISSIONS } from '@ayetis/shared';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { ConfirmPasswordResetPage } from '@/features/auth/pages/ConfirmPasswordResetPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { RegistrationsPage } from '@/features/auth/pages/RegistrationsPage';
import { VerifyEmailPage } from '@/features/auth/pages/VerifyEmailPage';
import { ActivityLogPage } from '@/features/audit/pages/ActivityLogPage';
import { CaseDetailPage } from '@/features/cases/pages/CaseDetailPage';
import { CasesPage } from '@/features/cases/pages/CasesPage';
import { CreateCasePage } from '@/features/cases/pages/CreateCasePage';
import { EditCasePage } from '@/features/cases/pages/EditCasePage';
import { ComplaintsPage } from '@/features/complaints/pages/ComplaintsPage';
import { NotificationCenterPage } from '@/features/notifications/pages/NotificationCenterPage';
import { CreateUserPage } from '@/features/users/pages/CreateUserPage';
import { RolePermissionsPage } from '@/features/users/pages/RolePermissionsPage';
import { UserPermissionsPage } from '@/features/users/pages/UserPermissionsPage';
import { UsersPage } from '@/features/users/pages/UsersPage';
import {
  AppShell,
  GuestOnly,
  RequireAnyPermission,
  RequireAuth,
  RequirePermission,
} from '@/portals/AppShell';
import { RoleDashboard } from '@/portals/RoleDashboard';
import { RoleHomeRedirect } from '@/portals/roleRoutes';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/confirm-password-reset" element={<ConfirmPasswordResetPage />} />
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<RoleHomeRedirect />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route path="notifications" element={<NotificationCenterPage />} />

          {ALL_ROLES.map((role) => (
            <Route key={role} path={role} element={<RoleDashboard role={role} />} />
          ))}

          <Route element={<RequirePermission permission={PERMISSIONS.CASE_CREATE} />}>
            <Route path="cases/new" element={<CreateCasePage />} />
          </Route>

          <Route
            element={
              <RequireAnyPermission
                permissions={[
                  PERMISSIONS.CASE_VIEW_OWN,
                  PERMISSIONS.CASE_VIEW_ALL,
                  PERMISSIONS.CASE_VIEW_ASSIGNED,
                  PERMISSIONS.CASE_QC_REVIEW,
                  PERMISSIONS.CASE_CONSULT,
                ]}
              />
            }
          >
            <Route path="cases" element={<CasesPage />} />
            <Route path="cases/:caseId" element={<CaseDetailPage />} />
          </Route>

          <Route element={<RequirePermission permission={PERMISSIONS.CASE_UPDATE} />}>
            <Route path="cases/:caseId/edit" element={<EditCasePage />} />
          </Route>

          <Route element={<RequirePermission permission={PERMISSIONS.USER_LIST} />}>
            <Route path="users" element={<UsersPage />} />
          </Route>

          <Route element={<RequirePermission permission={PERMISSIONS.REGISTRATION_LIST} />}>
            <Route path="registrations" element={<RegistrationsPage />} />
          </Route>

          <Route element={<RequirePermission permission={PERMISSIONS.USER_CREATE} />}>
            <Route path="users/create" element={<CreateUserPage />} />
          </Route>

          <Route element={<RequirePermission permission={PERMISSIONS.USER_ASSIGN_PERMISSIONS} />}>
            <Route path="users/:userId/permissions" element={<UserPermissionsPage />} />
          </Route>

          <Route element={<RequirePermission permission={PERMISSIONS.ROLE_VIEW_PERMISSIONS} />}>
            <Route path="roles" element={<RolePermissionsPage />} />
          </Route>

          <Route
            element={
              <RequireAnyPermission
                permissions={[
                  PERMISSIONS.COMPLAINT_CREATE,
                  PERMISSIONS.COMPLAINT_VIEW,
                  PERMISSIONS.COMPLAINT_MANAGE,
                ]}
              />
            }
          >
            <Route path="complaints" element={<ComplaintsPage />} />
          </Route>

          <Route element={<RequirePermission permission={PERMISSIONS.AUDIT_VIEW} />}>
            <Route path="activity" element={<ActivityLogPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
