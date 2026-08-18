import { describe, expect, it } from 'vitest';
import {
  ALL_CASE_STATUSES,
  CASE_STATUSES,
  buildCaseTimeline,
  classifyUploadFile,
  formatCaseIdLabel,
  formatHistoryValue,
  getFilenameExtension,
  isAllowedUploadFilename,
  isArchiveFilename,
  isCaseDeliveryLocked,
  isCaseDraft,
  isCasePriority,
  isCaseStatus,
  isFileCategory,
} from './cases';
import {
  CASE_CANCEL_WINDOW_MINUTES,
  CASE_CATEGORIES,
  CASE_TYPES,
  DEFAULT_SLA_BUSINESS_HOURS,
  SLA_PROGRESS_COLORS,
  isCaseCategory,
  isCaseType,
  isCaseTypeForCategory,
  isRefundStatus,
  isWithinCancelWindow,
  remainingCancelWindowSeconds,
  slaProgressColor,
} from './caseTaxonomy';

describe('URD case statuses', () => {
  it('exposes exactly six statuses', () => {
    expect(ALL_CASE_STATUSES).toHaveLength(6);
    expect(ALL_CASE_STATUSES).toEqual(
      expect.arrayContaining([
        CASE_STATUSES.NEW_CASE,
        CASE_STATUSES.IN_PROCESS,
        CASE_STATUSES.WAITING_FOR_APPROVAL,
        CASE_STATUSES.APPROVED,
        CASE_STATUSES.CANCELLED,
        CASE_STATUSES.SAVED_FOR_SUBMISSION,
      ]),
    );
  });

  it('labels drafts and builds the lifecycle timeline', () => {
    expect(isCaseDraft(CASE_STATUSES.SAVED_FOR_SUBMISSION)).toBe(true);
    expect(formatCaseIdLabel('AYT-1', CASE_STATUSES.SAVED_FOR_SUBMISSION)).toBe('Draft AYT-1');
    expect(formatCaseIdLabel('AYT-1', CASE_STATUSES.NEW_CASE)).toBe('AYT-1');

    const cancelled = buildCaseTimeline(CASE_STATUSES.CANCELLED);
    expect(cancelled[0]?.state).toBe('complete');
    expect(cancelled[1]?.state).toBe('cancelled');

    const draft = buildCaseTimeline(CASE_STATUSES.SAVED_FOR_SUBMISSION);
    expect(draft[0]?.state).toBe('current');
    expect(draft[1]?.state).toBe('upcoming');

    const inProcess = buildCaseTimeline(CASE_STATUSES.IN_PROCESS);
    expect(inProcess.find((s) => s.status === CASE_STATUSES.NEW_CASE)?.state).toBe('complete');
    expect(inProcess.find((s) => s.status === CASE_STATUSES.IN_PROCESS)?.state).toBe('current');
  });

  it('locks production-side edits after delivery', () => {
    expect(isCaseDeliveryLocked(CASE_STATUSES.WAITING_FOR_APPROVAL)).toBe(true);
    expect(isCaseDeliveryLocked(CASE_STATUSES.NEW_CASE)).toBe(false);
    expect(isCaseStatus('new_case')).toBe(true);
    expect(isCaseStatus('nope')).toBe(false);
    expect(isCasePriority('urgent')).toBe(true);
    expect(formatHistoryValue('status', 'new_case')).toBe('New Case');
    expect(formatHistoryValue('priority', 'urgent')).toBe('Urgent');
    expect(formatHistoryValue('patientName', '')).toBe('—');
    expect(formatHistoryValue('patientName', 'Ada')).toBe('Ada');
  });
});

describe('URD cancel window and SLA colors', () => {
  it('uses a 15-minute cancel window', () => {
    expect(CASE_CANCEL_WINDOW_MINUTES).toBe(15);
    const submittedAt = new Date('2026-01-01T12:00:00.000Z');
    expect(isWithinCancelWindow(submittedAt, new Date('2026-01-01T12:10:00.000Z'))).toBe(true);
    expect(isWithinCancelWindow(submittedAt, new Date('2026-01-01T12:16:00.000Z'))).toBe(false);
    expect(remainingCancelWindowSeconds(submittedAt, new Date('2026-01-01T12:14:00.000Z'))).toBe(60);
    expect(remainingCancelWindowSeconds(null)).toBe(0);
  });

  it('maps SLA utilization to URD bar colors', () => {
    expect(DEFAULT_SLA_BUSINESS_HOURS).toBe(48);
    expect(slaProgressColor(0)).toBe(SLA_PROGRESS_COLORS.GREEN);
    expect(slaProgressColor(25)).toBe(SLA_PROGRESS_COLORS.GREEN);
    expect(slaProgressColor(26)).toBe(SLA_PROGRESS_COLORS.YELLOW);
    expect(slaProgressColor(50)).toBe(SLA_PROGRESS_COLORS.YELLOW);
    expect(slaProgressColor(51)).toBe(SLA_PROGRESS_COLORS.BLUE);
    expect(slaProgressColor(75)).toBe(SLA_PROGRESS_COLORS.BLUE);
    expect(slaProgressColor(76)).toBe(SLA_PROGRESS_COLORS.ORANGE);
    expect(slaProgressColor(90)).toBe(SLA_PROGRESS_COLORS.ORANGE);
    expect(slaProgressColor(91)).toBe(SLA_PROGRESS_COLORS.RED);
    expect(slaProgressColor(100)).toBe(SLA_PROGRESS_COLORS.RED);
  });
});

describe('file classification', () => {
  it('allows clinical uploads and blocks executables', () => {
    expect(isAllowedUploadFilename('scan.stl')).toBe(true);
    expect(isAllowedUploadFilename('notes.exe')).toBe(false);
    expect(isArchiveFilename('bundle.zip')).toBe(true);
    expect(getFilenameExtension('Photo.JPEG')).toBe('.jpeg');
    expect(getFilenameExtension('noext')).toBe('');
  });

  it('classifies STL from archives as scans', () => {
    expect(classifyUploadFile('model.stl')).toBe('stl');
    expect(classifyUploadFile('model.stl', '', { fromArchive: true })).toBe('scan');
    expect(classifyUploadFile('cbct.dcm')).toBe('dicom');
    expect(classifyUploadFile('mesh.obj')).toBe('model');
    expect(classifyUploadFile('report.pdf')).toBe('pdf');
    expect(classifyUploadFile('clip.mp4')).toBe('video');
    expect(classifyUploadFile('records.zip')).toBe('archive');
    expect(classifyUploadFile('smile.jpg')).toBe('photo');
    expect(classifyUploadFile('opg-xray.png')).toBe('xray');
    expect(classifyUploadFile('viewer.html')).toBe('html_link');
    expect(classifyUploadFile('notes.txt')).toBe('other');
    expect(classifyUploadFile('any.bin', '', { explicit: 'cut' })).toBe('cut');
    expect(isFileCategory('stl')).toBe(true);
    expect(isFileCategory('nope')).toBe(false);
  });
});

describe('taxonomy guards', () => {
  it('validates categories and types', () => {
    expect(isCaseCategory(CASE_CATEGORIES.DIGITAL_ALIGNER)).toBe(true);
    expect(isCaseType(CASE_TYPES.NEW)).toBe(true);
    expect(isCaseTypeForCategory(CASE_CATEGORIES.DIGITAL_ALIGNER, CASE_TYPES.NEW)).toBe(true);
    expect(isCaseTypeForCategory(CASE_CATEGORIES.IMPLANT, CASE_TYPES.NEW)).toBe(false);
    expect(isRefundStatus('pending')).toBe(true);
    expect(isRefundStatus('nope')).toBe(false);
  });
});
