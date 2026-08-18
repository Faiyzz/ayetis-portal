import { describe, expect, it } from 'vitest';
import {
  CASE_CATEGORIES,
  CASE_STATUSES,
  DOCTOR_DECISIONS,
  QC_ERROR_CODES,
} from '@ayetis/shared';
import {
  assignCaseSchema,
  createCaseSchema,
  doctorDecisionSchema,
  listCasesQuerySchema,
  qcRejectSchema,
  reasonSchema,
} from './cases.schemas';

describe('cases Zod contracts', () => {
  it('allows drafts without full clinical payload', () => {
    expect(createCaseSchema.safeParse({ asDraft: true }).success).toBe(true);
    expect(createCaseSchema.safeParse({ patientName: '' }).success).toBe(false);
  });

  it('requires a designer id when assigning to a designer', () => {
    expect(assignCaseSchema.safeParse({ mode: 'designer' }).success).toBe(false);
    expect(
      assignCaseSchema.safeParse({ mode: 'designer', designerId: '507f1f77bcf86cd799439014' })
        .success,
    ).toBe(true);
    expect(assignCaseSchema.safeParse({ mode: 'auto_queue' }).success).toBe(true);
    expect(assignCaseSchema.safeParse({ mode: 'cut_operator' }).success).toBe(false);
    expect(
      assignCaseSchema.safeParse({ mode: 'cut_operator', cutOperatorId: '507f1f77bcf86cd799439014' })
        .success,
    ).toBe(true);
  });

  it('requires a cancel reason and a modification note decision', () => {
    expect(reasonSchema.safeParse({ reason: 'oops' }).success).toBe(true);
    expect(reasonSchema.safeParse({ reason: '' }).success).toBe(false);
    expect(
      doctorDecisionSchema.safeParse({ decision: DOCTOR_DECISIONS.APPROVE }).success,
    ).toBe(true);
    expect(doctorDecisionSchema.safeParse({ decision: 'nope' }).success).toBe(false);
  });

  it('validates QC reject codes and list filters', () => {
    expect(
      qcRejectSchema.safeParse({
        errorCode: QC_ERROR_CODES.FIT_ISSUE,
        comments: 'open margin',
        requiredChanges: 'rescan',
      }).success,
    ).toBe(true);
    expect(
      qcRejectSchema.safeParse({
        errorCode: 'not-a-code',
        comments: 'x',
        requiredChanges: 'y',
      }).success,
    ).toBe(false);
    expect(
      listCasesQuerySchema.safeParse({
        status: CASE_STATUSES.NEW_CASE,
        caseCategory: CASE_CATEGORIES.DIGITAL_ALIGNER,
        includeDeleted: 'true',
        isDemo: 'false',
      }).success,
    ).toBe(true);
    expect(
      createCaseSchema.safeParse({
        asDraft: false,
        patientName: 'Jane',
        practiceName: 'Clinic',
        chiefComplaint: 'crowding',
        caseCategory: CASE_CATEGORIES.PROSTHODONTIC,
      }).success,
    ).toBe(false);
    expect(
      createCaseSchema.safeParse({
        asDraft: false,
        patientName: 'Jane',
        practiceName: 'Clinic',
        chiefComplaint: 'crowding',
        caseCategory: CASE_CATEGORIES.IMPLANT,
      }).success,
    ).toBe(false);
  });
});
