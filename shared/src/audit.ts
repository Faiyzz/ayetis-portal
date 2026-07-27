export const AUDIT_ACTIONS = {
  AUTH_LOGIN_SUCCESS: 'auth.login.success',
  AUTH_LOGIN_FAILED: 'auth.login.failed',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_REGISTER: 'auth.register',
  AUTH_PASSWORD_CHANGE: 'auth.password.change',
  AUTH_PASSWORD_RESET: 'auth.password.reset',
  AUTH_PASSWORD_FORGOT: 'auth.password.forgot',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  USER_PERMISSIONS_UPDATE: 'user.permissions.update',
  ROLE_PERMISSIONS_UPDATE: 'role.permissions.update',
  CASE_CREATE: 'case.create',
  CASE_UPDATE: 'case.update',
  CASE_CANCEL: 'case.cancel',
  CASE_DELETE: 'case.delete',
  CASE_NOTE_ADD: 'case.note.add',
  CASE_PRIORITY_SET: 'case.priority.set',
  CASE_FILE_UPLOAD: 'case.file.upload',
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
  [AUDIT_ACTIONS.USER_CREATE]: 'User created',
  [AUDIT_ACTIONS.USER_UPDATE]: 'User updated',
  [AUDIT_ACTIONS.USER_DELETE]: 'User deleted',
  [AUDIT_ACTIONS.USER_PERMISSIONS_UPDATE]: 'User permissions updated',
  [AUDIT_ACTIONS.ROLE_PERMISSIONS_UPDATE]: 'Role permissions updated',
  [AUDIT_ACTIONS.CASE_CREATE]: 'Case created',
  [AUDIT_ACTIONS.CASE_UPDATE]: 'Case updated',
  [AUDIT_ACTIONS.CASE_CANCEL]: 'Case cancelled',
  [AUDIT_ACTIONS.CASE_DELETE]: 'Case deleted',
  [AUDIT_ACTIONS.CASE_NOTE_ADD]: 'Case note added',
  [AUDIT_ACTIONS.CASE_PRIORITY_SET]: 'Case priority changed',
  [AUDIT_ACTIONS.CASE_FILE_UPLOAD]: 'Case file uploaded',
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
};

export type AuditTargetType = 'user' | 'role' | 'auth' | 'system' | 'case' | 'clarification';

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
