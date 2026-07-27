export const QC_ERROR_CODES = {
  FIT_ISSUE: 'fit_issue',
  OCCLUSION: 'occlusion',
  MARGIN: 'margin',
  ANATOMY: 'anatomy',
  FILE_QUALITY: 'file_quality',
  INSTRUCTIONS_MISMATCH: 'instructions_mismatch',
  ALIGNMENT: 'alignment',
  OTHER: 'other',
} as const;

export type QcErrorCode = (typeof QC_ERROR_CODES)[keyof typeof QC_ERROR_CODES];

export const ALL_QC_ERROR_CODES: QcErrorCode[] = Object.values(QC_ERROR_CODES);

export const QC_ERROR_CODE_LABELS: Record<QcErrorCode, string> = {
  [QC_ERROR_CODES.FIT_ISSUE]: 'Fit issue',
  [QC_ERROR_CODES.OCCLUSION]: 'Occlusion',
  [QC_ERROR_CODES.MARGIN]: 'Margin / finish line',
  [QC_ERROR_CODES.ANATOMY]: 'Anatomy / morphology',
  [QC_ERROR_CODES.FILE_QUALITY]: 'File quality',
  [QC_ERROR_CODES.INSTRUCTIONS_MISMATCH]: 'Does not match instructions',
  [QC_ERROR_CODES.ALIGNMENT]: 'Alignment / setup',
  [QC_ERROR_CODES.OTHER]: 'Other',
};

export const QC_REVIEW_OUTCOMES = {
  COMMENT: 'comment',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type QcReviewOutcome = (typeof QC_REVIEW_OUTCOMES)[keyof typeof QC_REVIEW_OUTCOMES];

export const ALL_QC_REVIEW_OUTCOMES: QcReviewOutcome[] = Object.values(QC_REVIEW_OUTCOMES);

export const QC_ESCALATION_REJECTION_THRESHOLD = 2;

export interface QcReviewDto {
  id: string;
  outcome: QcReviewOutcome;
  errorCode: QcErrorCode | null;
  comments: string;
  requiredChanges: string;
  reviewerId: string;
  reviewerName: string;
  deliveryViewLink: string | null;
  deliveryVideoName: string | null;
  createdAt: string;
}

export interface CaseDeliveryDto {
  viewLink: string;
  videoFilename: string | null;
  videoStorageKey: string | null;
  uploadedAt: string | null;
  uploadedByName: string | null;
}

export interface QcQueueCaseDto {
  id: string;
  caseId: string;
  patientName: string;
  doctorName: string;
  designerName: string | null;
  status: string;
  priority: string;
  treatmentSummary: string;
  qcRejectionCount: number;
  escalatedForOversight: boolean;
  submittedToQcAt: string | null;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QcDashboardDto {
  generatedAt: string;
  pendingCount: number;
  escalatedCount: number;
  items: QcQueueCaseDto[];
  escalatedItems: QcQueueCaseDto[];
}

export interface AddQcCommentInput {
  comments: string;
}

export interface ApproveQcInput {
  comments?: string;
  deliveryViewLink?: string;
}

export interface RejectQcInput {
  errorCode: QcErrorCode;
  comments: string;
  requiredChanges: string;
}

export interface ResubmitToQcInput {
  notes?: string;
}

export interface PerformanceMonthOption {
  key: string; // YYYY-MM
  label: string;
}

export interface DesignerPerformanceDto {
  periodKey: string;
  periodLabel: string;
  availableMonths: PerformanceMonthOption[];
  totalCases: number;
  completedCases: number;
  inProductionCases: number;
  modifications: number;
  qcRejections: number;
  resubmissions: number;
  submittedToQc: number;
}

export interface QcErrorTrendItem {
  errorCode: QcErrorCode;
  label: string;
  count: number;
}

export interface QcPerformanceDto {
  view: 'month' | 'quarter';
  periodKey: string;
  periodLabel: string;
  availableMonths: PerformanceMonthOption[];
  casesReviewed: number;
  approvedCount: number;
  revertedCount: number;
  commentsOnly: number;
  errorTrends: QcErrorTrendItem[];
}

export function isQcErrorCode(value: string): value is QcErrorCode {
  return (ALL_QC_ERROR_CODES as string[]).includes(value);
}

export function monthKeyFromDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function labelForMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Last N calendar months including current, newest first. */
export function recentMonthOptions(count = 3, now = new Date()): PerformanceMonthOption[] {
  const options: PerformanceMonthOption[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = 0; i < count; i += 1) {
    const key = monthKeyFromDate(cursor);
    options.push({ key, label: labelForMonthKey(key) });
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  return options;
}

export function monthRangeUtc(monthKey: string): { start: Date; end: Date } {
  const [y, m] = monthKey.split('-').map(Number);
  const start = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  const end = new Date(Date.UTC(y!, m ?? 1, 1));
  return { start, end };
}

export function quarterRangeUtc(monthKey: string): { start: Date; end: Date; label: string } {
  const [y, m] = monthKey.split('-').map(Number);
  const quarter = Math.floor(((m ?? 1) - 1) / 3); // 0..3
  const startMonth = quarter * 3;
  const start = new Date(Date.UTC(y!, startMonth, 1));
  const end = new Date(Date.UTC(y!, startMonth + 3, 1));
  return {
    start,
    end,
    label: `Q${quarter + 1} ${y}`,
  };
}
