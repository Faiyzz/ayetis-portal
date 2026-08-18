import { describe, expect, it } from 'vitest';
import {
  isPasswordComplex,
  isPasswordExpired,
  passwordExpiresAt,
  validatePasswordComplexity,
  PASSWORD_POLICY,
} from './password';
import {
  DEFAULT_LOGIN_LOCKOUT_MINUTES,
  DEFAULT_LOGIN_MAX_FAILED_ATTEMPTS,
  DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES,
  THEMES,
  isThemePreference,
  summarizeUserAgent,
} from './security';
import {
  notificationCatalog,
  notificationChannelForType,
  typesForNotificationChannel,
  isNotificationChannel,
  NOTIFICATION_CHANNELS,
} from './notificationChannels';
import { NOTIFICATION_TYPES, isNotificationType } from './notifications';
import {
  computeDelayLevel,
  DELAY_LEVELS,
  resolveCoordinatorQueue,
  isAssignmentMode,
  isCoordinatorQueue,
} from './coordinator';
import { CASE_STATUSES } from './cases';
import { ASSIGNMENT_MODES } from './coordinator';
import {
  QC_ESCALATION_REJECTION_THRESHOLD,
  isQcErrorCode,
  labelForMonthKey,
  monthKeyFromDate,
  monthRangeUtc,
  quarterRangeUtc,
  recentMonthOptions,
} from './qc';
import { CUT_PHASES, getCaseWorkflowLabel, isCutPhase, isCutAssignmentMode } from './cut';
import {
  defaultFileStorageState,
  FILE_STORAGE_TIERS,
  FILE_RESTORE_STATUSES,
} from './storage';
import {
  CLARIFICATION_BUTTON_STATES,
  CLARIFICATION_SENDER_ROLES,
  computeClarificationButtonState,
  isClarificationPriority,
  isClarificationSenderRole,
  isClarificationStatus,
  isValidClarificationType,
  resolveClarificationSenderRole,
  clarificationTypeLabel,
} from './clarifications';
import {
  formatInvoiceNumber,
  formatReceiptNumber,
  isBillingArrangement,
  isInvoiceScheduleArrangement,
  BILLING_ARRANGEMENTS,
} from './commercial';
import { isConsultantIndicator, isDoctorDecision } from './consultation';
import { isComplaintStatus, isComplaintType } from './complaints';
import { isDeleteRecordType } from './deletions';
import { isDepartmentType } from './departments';
import { isMasterListType } from './settings';
import { isCancellationTrendGranularity } from './cancellations';
import { isAuditAction } from './audit';
import { SUPERVISOR_QUEUE_BUCKETS } from './supervisor';

describe('password and security policy', () => {
  it('requires mixed-case, digit, and special character', () => {
    expect(isPasswordComplex('Short1!')).toBe(false);
    expect(validatePasswordComplexity('alllowercase1!').length).toBeGreaterThan(0);
    expect(isPasswordComplex('ValidPass1!')).toBe(true);
    expect(PASSWORD_POLICY.historyDepth).toBe(5);
  });

  it('computes expiry and lockout defaults', () => {
    const changed = new Date('2026-01-01T00:00:00.000Z');
    const expires = passwordExpiresAt(changed, 90);
    expect(expires?.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(isPasswordExpired(changed, 90, new Date('2026-04-02T00:00:00.000Z'))).toBe(true);
    expect(isPasswordExpired(changed, 0)).toBe(false);
    expect(passwordExpiresAt(null, 90)).toBeNull();
    expect(DEFAULT_LOGIN_MAX_FAILED_ATTEMPTS).toBe(5);
    expect(DEFAULT_LOGIN_LOCKOUT_MINUTES).toBe(15);
    expect(DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES).toBe(30);
    expect(isThemePreference(THEMES.DARK)).toBe(true);
    expect(summarizeUserAgent('Mozilla/5.0 Chrome/120 Windows')).toContain('Chrome');
    expect(summarizeUserAgent('')).toBe('unknown');
  });
});

describe('notifications and coordinator queues', () => {
  it('keeps Status Alerts separate from Clarifications', () => {
    expect(notificationChannelForType(NOTIFICATION_TYPES.SLA_BREACH)).toBe(
      NOTIFICATION_CHANNELS.STATUS_ALERTS,
    );
    expect(notificationChannelForType(NOTIFICATION_TYPES.CLARIFICATION_REQUIRED)).toBe(
      NOTIFICATION_CHANNELS.CLARIFICATIONS,
    );
    const catalog = notificationCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(15);
    expect(
      catalog.some((item) => item.type === 'sla_breach' && item.emailTemplateKey === 'sla_breach'),
    ).toBe(true);
    expect(typesForNotificationChannel('clarifications')).toContain(
      NOTIFICATION_TYPES.CLARIFICATION_REPLIED,
    );
    expect(isNotificationChannel('status_alerts')).toBe(true);
    expect(isNotificationType(NOTIFICATION_TYPES.CASE_ASSIGNED)).toBe(true);
  });

  it('resolves coordinator queues and delay bands', () => {
    expect(resolveCoordinatorQueue({ status: CASE_STATUSES.NEW_CASE })).toBe('new');
    expect(
      resolveCoordinatorQueue({
        status: CASE_STATUSES.IN_PROCESS,
        assignmentMode: ASSIGNMENT_MODES.DESIGNER,
        assignedDesignerId: 'd1',
      }),
    ).toBe('assigned');
    expect(
      resolveCoordinatorQueue({
        status: CASE_STATUSES.WAITING_FOR_APPROVAL,
      }),
    ).toBe('waiting_doctor');
    expect(
      resolveCoordinatorQueue({
        status: CASE_STATUSES.IN_PROCESS,
        openClarificationCount: 1,
      }),
    ).toBe('waiting_doctor');
    const now = new Date('2026-01-04T00:00:00.000Z');
    expect(computeDelayLevel('2026-01-03T12:00:00.000Z', now)).toBe(DELAY_LEVELS.GREEN);
    expect(computeDelayLevel('2026-01-02T12:00:00.000Z', now)).toBe(DELAY_LEVELS.YELLOW);
    expect(computeDelayLevel('2025-12-31T00:00:00.000Z', now)).toBe(DELAY_LEVELS.RED);
    expect(isAssignmentMode('designer')).toBe(true);
    expect(isCoordinatorQueue('new')).toBe(true);
  });
});

describe('QC, cut, storage, commercial helpers', () => {
  it('computes month/quarter ranges and QC threshold', () => {
    expect(QC_ESCALATION_REJECTION_THRESHOLD).toBe(2);
    expect(isQcErrorCode('fit_issue')).toBe(true);
    expect(monthKeyFromDate(new Date(Date.UTC(2026, 0, 15)))).toBe('2026-01');
    expect(labelForMonthKey('2026-01')).toContain('2026');
    const month = monthRangeUtc('2026-02');
    expect(month.start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(month.end.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    const q = quarterRangeUtc('2026-02');
    expect(q.label).toBe('Q1 2026');
    expect(recentMonthOptions(2, new Date(Date.UTC(2026, 2, 1)))[0]?.key).toBe('2026-03');
  });

  it('labels cut workflow and default hot storage', () => {
    expect(getCaseWorkflowLabel('in_process', CUT_PHASES.CUT_IN_PROGRESS)).toBe('Cut in progress');
    expect(getCaseWorkflowLabel('approved', CUT_PHASES.CUT_IN_PROGRESS)).toBe('Approved');
    expect(isCutPhase('cut_queue')).toBe(true);
    expect(isCutAssignmentMode('auto_queue')).toBe(true);
    const hot = defaultFileStorageState(new Date('2026-01-01T00:00:00.000Z'), 30);
    expect(hot.storageTier).toBe(FILE_STORAGE_TIERS.HOT);
    expect(hot.restoreStatus).toBe(FILE_RESTORE_STATUSES.NONE);
    expect(hot.hotUntil.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('formats invoices and maps clarification button color', () => {
    expect(formatInvoiceNumber(12)).toBe('INV-00000012');
    expect(formatReceiptNumber(3)).toBe('RCPT-00000003');
    expect(isBillingArrangement(BILLING_ARRANGEMENTS.MONTHLY)).toBe(true);
    expect(isInvoiceScheduleArrangement(BILLING_ARRANGEMENTS.WEEKLY)).toBe(true);
    expect(isInvoiceScheduleArrangement(BILLING_ARRANGEMENTS.ADVANCE_PAYMENT)).toBe(false);
    expect(computeClarificationButtonState([])).toBe(CLARIFICATION_BUTTON_STATES.NONE);
    expect(computeClarificationButtonState([{ status: 'awaiting_doctor' }])).toBe(
      CLARIFICATION_BUTTON_STATES.BLUE,
    );
    expect(computeClarificationButtonState([{ status: 'awaiting_team' }])).toBe(
      CLARIFICATION_BUTTON_STATES.GREEN,
    );
    expect(resolveClarificationSenderRole('coordinator')).toBe(
      CLARIFICATION_SENDER_ROLES.COORDINATOR,
    );
    expect(isValidClarificationType(CLARIFICATION_SENDER_ROLES.COORDINATOR, 'missing_records')).toBe(
      true,
    );
    expect(clarificationTypeLabel(CLARIFICATION_SENDER_ROLES.COORDINATOR, 'missing_records')).toBeTruthy();
    expect(isClarificationStatus('open')).toBe(true);
    expect(isClarificationPriority('high')).toBe(true);
    expect(isClarificationSenderRole('designer')).toBe(true);
  });
});

describe('misc type guards', () => {
  it('covers remaining domain guards', () => {
    expect(isConsultantIndicator('green')).toBe(true);
    expect(isDoctorDecision('approve')).toBe(true);
    expect(isComplaintType('quality')).toBe(true);
    expect(isComplaintStatus('open')).toBe(true);
    expect(isDeleteRecordType('case')).toBe(true);
    expect(isDepartmentType('design')).toBe(true);
    expect(isMasterListType('profession')).toBe(true);
    expect(isCancellationTrendGranularity('month')).toBe(true);
    expect(isAuditAction('auth.login.success')).toBe(true);
    expect(SUPERVISOR_QUEUE_BUCKETS.PENDING).toBe('pending');
  });
});
