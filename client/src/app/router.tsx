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
import { CorporateAuditPage } from '@/features/corporate/pages/CorporateAuditPage';
import { CorporateDashboardPage } from '@/features/corporate/pages/CorporateDashboardPage';
import { CorporateReportsPage } from '@/features/corporate/pages/CorporateReportsPage';
import { CorporateEmployeesPage } from '@/features/corporate/pages/CorporateEmployeesPage';
import { CorporateFacilitiesPage } from '@/features/corporate/pages/CorporateFacilitiesPage';
import { CorporateProfilePage } from '@/features/corporate/pages/CorporateProfilePage';
import { CorporateSubAccountsPage } from '@/features/corporate/pages/CorporateSubAccountsPage';
import { FacilityDashboardPage } from '@/features/corporate/pages/FacilityDashboardPage';
import { VerifySubAccountPage } from '@/features/corporate/pages/VerifySubAccountPage';
import { ActivityLogPage } from '@/features/audit/pages/ActivityLogPage';
import { CaseDetailPage } from '@/features/cases/pages/CaseDetailPage';
import { CasesPage } from '@/features/cases/pages/CasesPage';
import { CreateCasePage } from '@/features/cases/pages/CreateCasePage';
import { EditCasePage } from '@/features/cases/pages/EditCasePage';
import { CancellationReportPage } from '@/features/cancellations/pages/CancellationReportPage';
import { CommercialAdminPage } from '@/features/commercial/pages/CommercialAdminPage';
import { PaySessionPage } from '@/features/commercial/pages/PaySessionPage';
import { ComplaintsPage } from '@/features/complaints/pages/ComplaintsPage';
import { NotificationCenterPage } from '@/features/notifications/pages/NotificationCenterPage';
import { SettingsAdminPage } from '@/features/settings/pages/SettingsAdminPage';
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
import { CutDashboardRoute } from '@/portals/CutDashboardRoute';
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
          <Route path="/verify-subaccount" element={<VerifySubAccountPage />} />
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

          <Route element={<RequirePermission permission={PERMISSIONS.CASE_CUT} />}>
            <Route path="cut" element={<CutDashboardRoute />} />
          </Route>

          <Route element={<RequirePermission permission={PERMISSIONS.CASE_CREATE} />}>
            <Route path="cases/new" element={<CreateCasePage />} />
            <Route path="pay/:sessionId" element={<PaySessionPage />} />
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
                  PERMISSIONS.CASE_CUT,
                  PERMISSIONS.CASE_VIEW_ORG,
                  PERMISSIONS.CASE_VIEW_FACILITY,
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

          <Route
            element={
              <RequireAnyPermission
                permissions={[
                  PERMISSIONS.ROLE_VIEW_PERMISSIONS,
                  PERMISSIONS.TEAM_MANAGE,
                  PERMISSIONS.ASSIGNMENT_RULE_MANAGE,
                ]}
              />
            }
          >
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

          <Route
            element={<RequirePermission permission={PERMISSIONS.CANCELLATION_REPORT_VIEW} />}
          >
            <Route path="cancellations" element={<CancellationReportPage />} />
          </Route>

          <Route
            element={
              <RequireAnyPermission
                permissions={[
                  PERMISSIONS.ORG_MANAGE_SELF,
                  PERMISSIONS.FACILITY_MANAGE,
                  PERMISSIONS.EMPLOYEE_MANAGE,
                  PERMISSIONS.SUBACCOUNT_MANAGE,
                  PERMISSIONS.CASE_VIEW_ORG,
                  PERMISSIONS.CASE_VIEW_ALL,
                  PERMISSIONS.CORPORATE_REPORT_VIEW,
                  PERMISSIONS.CORPORATE_AUDIT_VIEW,
                ]}
              />
            }
          >
            <Route path="corporate" element={<CorporateDashboardPage />} />
            <Route path="corporate/reports" element={<CorporateReportsPage />} />
            <Route path="corporate/audit" element={<CorporateAuditPage />} />
            <Route path="corporate/profile" element={<CorporateProfilePage />} />
            <Route path="corporate/facilities" element={<CorporateFacilitiesPage />} />
            <Route path="corporate/employees" element={<CorporateEmployeesPage />} />
            <Route path="corporate/subaccounts" element={<CorporateSubAccountsPage />} />
          </Route>

          <Route element={<RequirePermission permission={PERMISSIONS.CASE_VIEW_FACILITY} />}>
            <Route path="facility" element={<FacilityDashboardPage />} />
          </Route>

          <Route
            element={
              <RequireAnyPermission
                permissions={[
                  PERMISSIONS.TREATMENT_PLAN_MANAGE,
                  PERMISSIONS.DISCOUNT_CODE_MANAGE,
                  PERMISSIONS.CUSTOMER_PRICE_MANAGE,
                  PERMISSIONS.BILLING_ARRANGE_MANAGE,
                  PERMISSIONS.PREPAID_MANAGE,
                  PERMISSIONS.PAYMENT_PROVIDER_MANAGE,
                  PERMISSIONS.INVOICE_VIEW,
                  PERMISSIONS.INVOICE_MANAGE,
                ]}
              />
            }
          >
            <Route path="commercial" element={<CommercialAdminPage />} />
          </Route>

          <Route
            element={
              <RequireAnyPermission
                permissions={[
                  PERMISSIONS.SETTINGS_MANAGE,
                  PERMISSIONS.MASTER_DATA_MANAGE,
                  PERMISSIONS.REGION_MANAGE,
                  PERMISSIONS.BRANDING_MANAGE,
                  PERMISSIONS.EMAIL_TEMPLATE_MANAGE,
                  PERMISSIONS.PRIVACY_MANAGE,
                ]}
              />
            }
          >
            <Route path="settings" element={<SettingsAdminPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
