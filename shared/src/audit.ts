export const AUDIT_ACTIONS = {
  AUTH_LOGIN_SUCCESS: 'auth.login.success',
  AUTH_LOGIN_FAILED: 'auth.login.failed',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_REGISTER: 'auth.register',
  AUTH_PASSWORD_CHANGE: 'auth.password.change',
  AUTH_PASSWORD_RESET: 'auth.password.reset',
  AUTH_PASSWORD_FORGOT: 'auth.password.forgot',
  AUTH_EMAIL_VERIFY: 'auth.email.verify',
  AUTH_PASSWORD_CONFIRM_RESET: 'auth.password.confirm_reset',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  USER_PERMISSIONS_UPDATE: 'user.permissions.update',
  USER_PASSWORD_RESET_ADMIN: 'user.password.reset_admin',
  USER_STATUS_CHANGE: 'user.status.change',
  ROLE_PERMISSIONS_UPDATE: 'role.permissions.update',
  ROLE_UPSERT: 'role.upsert',
  ROLE_CLONE: 'role.clone',
  ROLE_DELETE: 'role.delete',
  ROLE_REORDER: 'role.reorder',
  TEAM_UPSERT: 'team.upsert',
  TEAM_DELETE: 'team.delete',
  ASSIGNMENT_RULE_UPSERT: 'assignment_rule.upsert',
  ASSIGNMENT_RULE_DELETE: 'assignment_rule.delete',
  REGISTRATION_APPROVE: 'registration.approve',
  REGISTRATION_REJECT: 'registration.reject',
  REGISTRATION_HOLD: 'registration.hold',
  CASE_CREATE: 'case.create',
  CASE_UPDATE: 'case.update',
  CASE_CANCEL: 'case.cancel',
  CASE_AUTO_IN_PROCESS: 'case.auto_in_process',
  CASE_SUBMIT_DRAFT: 'case.submit_draft',
  CANCELLATION_AUDIT_CREATE: 'cancellation_audit.create',
  CANCELLATION_REFUND_UPDATE: 'cancellation_audit.refund_update',
  SLA_CONFIG_UPDATE: 'sla.config.update',
  TREATMENT_PLAN_UPSERT: 'treatment_plan.upsert',
  DISCOUNT_CODE_UPSERT: 'discount_code.upsert',
  CUSTOMER_PRICE_UPSERT: 'customer_price.upsert',
  BILLING_ARRANGE_UPDATE: 'billing_arrange.update',
  PREPAID_CREDIT: 'prepaid.credit',
  PREPAID_DEBIT: 'prepaid.debit',
  PAYMENT_SESSION_CREATE: 'payment_session.create',
  PAYMENT_SESSION_PAID: 'payment_session.paid',
  PAYMENT_PROVIDER_UPSERT: 'payment_provider.upsert',
  INVOICE_ISSUE: 'invoice.issue',
  RECEIPT_ISSUE: 'receipt.issue',
  DEMO_CASE_CREATE: 'demo_case.create',
  MASTER_LIST_UPSERT: 'master_list.upsert',
  REGION_UPSERT: 'region.upsert',
  COUNTRY_UPSERT: 'country.upsert',
  COUNTRY_REQUEST_REVIEW: 'country_request.review',
  BRANDING_UPDATE: 'branding.update',
  BUSINESS_CONFIG_UPDATE: 'business_config.update',
  EMAIL_TEMPLATE_UPSERT: 'email_template.upsert',
  PRIVACY_POLICY_PUBLISH: 'privacy_policy.publish',
  SYSTEM_MESSAGES_UPDATE: 'system_messages.update',
  CASE_DELETE: 'case.delete',
  CASE_NOTE_ADD: 'case.note.add',
  CASE_PRIORITY_SET: 'case.priority.set',
  CASE_FILE_UPLOAD: 'case.file.upload',
  CASE_FILE_EXTRACT: 'case.file.extract',
  CASE_FILE_LINK: 'case.file.link',
  CASE_PAYMENT_UPDATE: 'case.payment.update',
  CASE_VALIDATE: 'case.validate',
  CASE_ASSIGN: 'case.assign',
  CASE_PRODUCTION_START: 'case.production.start',
  CASE_PRODUCTION_SUBMIT_QC: 'case.production.submit_qc',
  CASE_PRODUCTION_RESUBMIT_QC: 'case.production.resubmit_qc',
  CASE_FILES_DOWNLOAD: 'case.files.download',
  CASE_QC_COMMENT: 'case.qc.comment',
  CASE_QC_APPROVE: 'case.qc.approve',
  CASE_QC_REJECT: 'case.qc.reject',
  CASE_CLINICAL_REMARK: 'case.clinical.remark',
  CASE_DOCTOR_DECISION: 'case.doctor.decision',
  CASE_DOCTOR_VIEWED: 'case.doctor.viewed',
  CASE_DELIVERED: 'case.delivered',
  CASE_DELETE_REQUEST: 'case.delete.request',
  CASE_REASSIGN: 'case.reassign',
  DEPARTMENT_CREATE: 'department.create',
  DEPARTMENT_UPDATE: 'department.update',
  DEPARTMENT_DELETE: 'department.delete',
  COMPLAINT_CREATE: 'complaint.create',
  COMPLAINT_UPDATE: 'complaint.update',
  DELETE_REQUEST_APPROVE: 'delete_request.approve',
  DELETE_REQUEST_REJECT: 'delete_request.reject',
  CLARIFICATION_CREATE: 'clarification.create',
  CLARIFICATION_REPLY: 'clarification.reply',
  CLARIFICATION_RESOLVE: 'clarification.resolve',
  ORGANIZATION_CREATE: 'organization.create',
  ORGANIZATION_UPDATE: 'organization.update',
  FACILITY_CREATE: 'facility.create',
  FACILITY_UPDATE: 'facility.update',
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_UPDATE: 'employee.update',
  SUBACCOUNT_CREATE: 'subaccount.create',
  SUBACCOUNT_VERIFY: 'subaccount.verify',
  SUBACCOUNT_ACTIVATE: 'subaccount.activate',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const ALL_AUDIT_ACTIONS: AuditAction[] = Object.values(AUDIT_ACTIONS);

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  [AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS]: 'Login successful',
  [AUDIT_ACTIONS.AUTH_LOGIN_FAILED]: 'Login failed',
  [AUDIT_ACTIONS.AUTH_LOGOUT]: 'Logged out',
  [AUDIT_ACTIONS.AUTH_REGISTER]: 'Account registered',
  [AUDIT_ACTIONS.AUTH_PASSWORD_CHANGE]: 'Password changed',
  [AUDIT_ACTIONS.AUTH_PASSWORD_RESET]: 'Password reset',
  [AUDIT_ACTIONS.AUTH_PASSWORD_FORGOT]: 'Password reset requested',
  [AUDIT_ACTIONS.AUTH_EMAIL_VERIFY]: 'Email verified',
  [AUDIT_ACTIONS.AUTH_PASSWORD_CONFIRM_RESET]: 'Password reset confirmed',
  [AUDIT_ACTIONS.USER_CREATE]: 'User created',
  [AUDIT_ACTIONS.USER_UPDATE]: 'User updated',
  [AUDIT_ACTIONS.USER_DELETE]: 'User deleted',
  [AUDIT_ACTIONS.USER_PERMISSIONS_UPDATE]: 'User permissions updated',
  [AUDIT_ACTIONS.USER_PASSWORD_RESET_ADMIN]: 'Admin reset user password',
  [AUDIT_ACTIONS.USER_STATUS_CHANGE]: 'User status changed',
  [AUDIT_ACTIONS.ROLE_PERMISSIONS_UPDATE]: 'Role permissions updated',
  [AUDIT_ACTIONS.ROLE_UPSERT]: 'Role saved',
  [AUDIT_ACTIONS.ROLE_CLONE]: 'Role cloned',
  [AUDIT_ACTIONS.ROLE_DELETE]: 'Role deleted',
  [AUDIT_ACTIONS.ROLE_REORDER]: 'Roles reordered',
  [AUDIT_ACTIONS.TEAM_UPSERT]: 'Team saved',
  [AUDIT_ACTIONS.TEAM_DELETE]: 'Team deleted',
  [AUDIT_ACTIONS.ASSIGNMENT_RULE_UPSERT]: 'Assignment rule saved',
  [AUDIT_ACTIONS.ASSIGNMENT_RULE_DELETE]: 'Assignment rule deleted',
  [AUDIT_ACTIONS.REGISTRATION_APPROVE]: 'Registration approved',
  [AUDIT_ACTIONS.REGISTRATION_REJECT]: 'Registration rejected',
  [AUDIT_ACTIONS.REGISTRATION_HOLD]: 'Registration held',
  [AUDIT_ACTIONS.CASE_CREATE]: 'Case created',
  [AUDIT_ACTIONS.CASE_UPDATE]: 'Case updated',
  [AUDIT_ACTIONS.CASE_CANCEL]: 'Case cancelled',
  [AUDIT_ACTIONS.CASE_AUTO_IN_PROCESS]: 'Case auto moved to In Process',
  [AUDIT_ACTIONS.CASE_SUBMIT_DRAFT]: 'Draft case submitted',
  [AUDIT_ACTIONS.CANCELLATION_AUDIT_CREATE]: 'Cancellation audit recorded',
  [AUDIT_ACTIONS.CANCELLATION_REFUND_UPDATE]: 'Cancellation refund status updated',
  [AUDIT_ACTIONS.SLA_CONFIG_UPDATE]: 'SLA configuration updated',
  [AUDIT_ACTIONS.TREATMENT_PLAN_UPSERT]: 'Treatment plan saved',
  [AUDIT_ACTIONS.DISCOUNT_CODE_UPSERT]: 'Discount code saved',
  [AUDIT_ACTIONS.CUSTOMER_PRICE_UPSERT]: 'Customer price override saved',
  [AUDIT_ACTIONS.BILLING_ARRANGE_UPDATE]: 'Billing arrangement updated',
  [AUDIT_ACTIONS.PREPAID_CREDIT]: 'Prepaid balance credited',
  [AUDIT_ACTIONS.PREPAID_DEBIT]: 'Prepaid balance debited',
  [AUDIT_ACTIONS.PAYMENT_SESSION_CREATE]: 'Payment session created',
  [AUDIT_ACTIONS.PAYMENT_SESSION_PAID]: 'Payment session paid',
  [AUDIT_ACTIONS.PAYMENT_PROVIDER_UPSERT]: 'Payment provider saved',
  [AUDIT_ACTIONS.INVOICE_ISSUE]: 'Invoice issued',
  [AUDIT_ACTIONS.RECEIPT_ISSUE]: 'Payment receipt issued',
  [AUDIT_ACTIONS.DEMO_CASE_CREATE]: 'Demo case created',
  [AUDIT_ACTIONS.MASTER_LIST_UPSERT]: 'Master list item saved',
  [AUDIT_ACTIONS.REGION_UPSERT]: 'Region saved',
  [AUDIT_ACTIONS.COUNTRY_UPSERT]: 'Country saved',
  [AUDIT_ACTIONS.COUNTRY_REQUEST_REVIEW]: 'Other-country request reviewed',
  [AUDIT_ACTIONS.BRANDING_UPDATE]: 'Branding updated',
  [AUDIT_ACTIONS.BUSINESS_CONFIG_UPDATE]: 'Business configuration updated',
  [AUDIT_ACTIONS.EMAIL_TEMPLATE_UPSERT]: 'Email template saved',
  [AUDIT_ACTIONS.PRIVACY_POLICY_PUBLISH]: 'Privacy policy published',
  [AUDIT_ACTIONS.SYSTEM_MESSAGES_UPDATE]: 'System messages updated',
  [AUDIT_ACTIONS.CASE_DELETE]: 'Case deleted',
  [AUDIT_ACTIONS.CASE_NOTE_ADD]: 'Case note added',
  [AUDIT_ACTIONS.CASE_PRIORITY_SET]: 'Case priority changed',
  [AUDIT_ACTIONS.CASE_FILE_UPLOAD]: 'Case file uploaded',
  [AUDIT_ACTIONS.CASE_FILE_EXTRACT]: 'Archive extracted into case files',
  [AUDIT_ACTIONS.CASE_FILE_LINK]: 'HTML viewer link attached',
  [AUDIT_ACTIONS.CASE_PAYMENT_UPDATE]: 'Case payment updated',
  [AUDIT_ACTIONS.CASE_VALIDATE]: 'Case validated',
  [AUDIT_ACTIONS.CASE_ASSIGN]: 'Case assigned',
  [AUDIT_ACTIONS.CASE_PRODUCTION_START]: 'Production started',
  [AUDIT_ACTIONS.CASE_PRODUCTION_SUBMIT_QC]: 'Submitted to QC',
  [AUDIT_ACTIONS.CASE_PRODUCTION_RESUBMIT_QC]: 'Resubmitted to QC',
  [AUDIT_ACTIONS.CASE_FILES_DOWNLOAD]: 'Case files downloaded',
  [AUDIT_ACTIONS.CASE_QC_COMMENT]: 'QC comment added',
  [AUDIT_ACTIONS.CASE_QC_APPROVE]: 'QC approved case',
  [AUDIT_ACTIONS.CASE_QC_REJECT]: 'QC rejected case',
  [AUDIT_ACTIONS.CASE_CLINICAL_REMARK]: 'Clinical remark added',
  [AUDIT_ACTIONS.CASE_DOCTOR_DECISION]: 'Doctor decision recorded',
  [AUDIT_ACTIONS.CASE_DOCTOR_VIEWED]: 'Doctor viewed case',
  [AUDIT_ACTIONS.CASE_DELIVERED]: 'Case delivered to doctor',
  [AUDIT_ACTIONS.CASE_DELETE_REQUEST]: 'Case delete requested',
  [AUDIT_ACTIONS.CASE_REASSIGN]: 'Case reassigned',
  [AUDIT_ACTIONS.DEPARTMENT_CREATE]: 'Department created',
  [AUDIT_ACTIONS.DEPARTMENT_UPDATE]: 'Department updated',
  [AUDIT_ACTIONS.DEPARTMENT_DELETE]: 'Department deleted',
  [AUDIT_ACTIONS.COMPLAINT_CREATE]: 'Complaint filed',
  [AUDIT_ACTIONS.COMPLAINT_UPDATE]: 'Complaint updated',
  [AUDIT_ACTIONS.DELETE_REQUEST_APPROVE]: 'Delete request approved',
  [AUDIT_ACTIONS.DELETE_REQUEST_REJECT]: 'Delete request rejected',
  [AUDIT_ACTIONS.CLARIFICATION_CREATE]: 'Clarification created',
  [AUDIT_ACTIONS.CLARIFICATION_REPLY]: 'Clarification reply',
  [AUDIT_ACTIONS.CLARIFICATION_RESOLVE]: 'Clarification resolved',
  [AUDIT_ACTIONS.ORGANIZATION_CREATE]: 'Organization created',
  [AUDIT_ACTIONS.ORGANIZATION_UPDATE]: 'Organization updated',
  [AUDIT_ACTIONS.FACILITY_CREATE]: 'Facility created',
  [AUDIT_ACTIONS.FACILITY_UPDATE]: 'Facility updated',
  [AUDIT_ACTIONS.EMPLOYEE_CREATE]: 'Employee created',
  [AUDIT_ACTIONS.EMPLOYEE_UPDATE]: 'Employee updated',
  [AUDIT_ACTIONS.SUBACCOUNT_CREATE]: 'Sub-account created',
  [AUDIT_ACTIONS.SUBACCOUNT_VERIFY]: 'Sub-account email verified',
  [AUDIT_ACTIONS.SUBACCOUNT_ACTIVATE]: 'Sub-account activated',
};

export type AuditTargetType =
  | 'user'
  | 'role'
  | 'team'
  | 'assignment_rule'
  | 'auth'
  | 'system'
  | 'case'
  | 'clarification'
  | 'registration'
  | 'invoice'
  | 'payment';

export interface ActivityLogDto {
  id: string;
  action: AuditAction;
  actionLabel: string;
  actorId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string | null;
  targetType: AuditTargetType;
  targetId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ActivityLogListResult {
  items: ActivityLogDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActivityLogQuery {
  page?: number;
  pageSize?: number;
  action?: AuditAction;
  actorEmail?: string;
  q?: string;
}

export function isAuditAction(value: string): value is AuditAction {
  return (ALL_AUDIT_ACTIONS as string[]).includes(value);
}
