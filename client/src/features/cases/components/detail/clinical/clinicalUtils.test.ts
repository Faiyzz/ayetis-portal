import { describe, expect, it } from 'vitest';
import { CASE_STATUSES, FILE_CATEGORIES, buildCaseTimeline } from '@ayetis/shared';
import {
  allergyAlerts,
  attachmentSummary,
  buildActivityFeed,
  buildClinicalJourney,
  buildGoalProgressRows,
  clinicalAlertLines,
  estimateAlignerSets,
  isImageFile,
  isPdfFile,
  isStlLike,
  journeyProgressPercent,
  pickHighlightMedia,
  personInitials,
  relativeTime,
  timelineProgressPercent,
  wearScheduleLabel,
} from './clinicalUtils';
import type { CaseDetailDto, CaseFileDto } from '@ayetis/shared';

function file(partial: Partial<CaseFileDto>): CaseFileDto {
  return {
    id: 'f1',
    filename: 'a.jpg',
    originalName: 'a.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 10,
    category: FILE_CATEGORIES.PHOTO,
    storageKey: 'k',
    viewUrl: null,
    extractedFrom: null,
    uploadedById: null,
    uploadedByName: 'Ada',
    version: 1,
    createdAt: new Date().toISOString(),
    storageTier: 'hot',
    restoreStatus: 'none',
    hotUntil: null,
    coldSince: null,
    restoreRequestedAt: null,
    restoreError: null,
    ...partial,
  };
}

describe('clinical utils', () => {
  it('builds initials and relative times', () => {
    expect(personInitials('')).toBe('?');
    expect(personInitials('Ada')).toBe('AD');
    expect(personInitials('Ada Lovelace')).toBe('AL');
    expect(relativeTime(new Date().toISOString())).toBe('Just now');
  });

  it('computes timeline progress', () => {
    const cancelled = buildCaseTimeline(CASE_STATUSES.CANCELLED);
    expect(timelineProgressPercent(cancelled)).toBeGreaterThanOrEqual(0);
    const approved = buildCaseTimeline(CASE_STATUSES.APPROVED);
    expect(timelineProgressPercent(approved)).toBe(100);
    expect(timelineProgressPercent([])).toBe(0);
  });

  it('classifies media files', () => {
    expect(isImageFile(file({ mimeType: 'image/png', originalName: 'x.png' }))).toBe(true);
    expect(isPdfFile(file({ mimeType: 'application/pdf', originalName: 'a.pdf' }))).toBe(true);
    expect(isStlLike(file({ category: FILE_CATEGORIES.STL, originalName: 'a.stl' }))).toBe(true);
    expect(isStlLike(file({ category: FILE_CATEGORIES.PHOTO, originalName: 'mesh.obj' }))).toBe(true);
    expect(isImageFile(file({ category: FILE_CATEGORIES.XRAY, mimeType: 'application/octet-stream' }))).toBe(
      true,
    );
    expect(isPdfFile(file({ category: FILE_CATEGORIES.PDF, mimeType: 'text/plain', originalName: 'a.txt' }))).toBe(
      true,
    );
  });

  it('builds journey, goals, media, and alerts from a case', () => {
    const hourAgo = new Date(Date.now() - 90 * 60_000).toISOString();
    const caseData = {
      status: CASE_STATUSES.IN_PROCESS,
      files: [
        file({ category: FILE_CATEGORIES.STL, originalName: 'upper.stl', filename: 'upper.stl' }),
        file({ category: FILE_CATEGORIES.XRAY, originalName: 'opg.png', filename: 'opg.png' }),
        file({ category: FILE_CATEGORIES.PHOTO, originalName: 'smile.jpg' }),
      ],
      submittedToQcAt: hourAgo,
      productionStartedAt: hourAgo,
      delivery: null,
      timeline: buildCaseTimeline(CASE_STATUSES.IN_PROCESS),
      occlusionGoals: { upperMidlineObjective: 'maintain', overjetMm: 2 },
      treatmentInstructions: {
        specialRequirements: 'Latex allergy',
        arches: 'both',
        treatmentGoal: 'Class I',
      },
      recordsNumbering: { wearSchedule: '1_week', plannedTreatmentDuration: '6 months' },
      clinicalPreferences: { avoidEngagersTeeth: ['11'], extractionTeeth: [] },
      clarifications: [
        {
          id: 'c1',
          subject: 'Bite',
          requiredInfo: 'Need bite',
          clarificationTypeLabel: 'records',
          createdByName: 'Cora',
          createdAt: hourAgo,
          updatedAt: hourAgo,
          messages: [{ body: 'Please recapture', authorName: 'Cora', createdAt: hourAgo }],
        },
      ],
      notes: [{ id: 'n1', body: 'Watch midline', authorName: 'Ada', createdAt: hourAgo }],
      history: [{ id: 'h1', summary: 'Submitted', action: 'created', actorName: 'Ada', createdAt: hourAgo }],
      openClarificationCount: 1,
      updatedAt: hourAgo,
      treatmentSummary: 'aligners',
    } as unknown as CaseDetailDto;

    const journey = buildClinicalJourney(caseData);
    expect(journey.find((m) => m.state === 'current')?.id).toBe('plan');
    expect(journeyProgressPercent(journey)).toBeGreaterThan(0);

    const goals = buildGoalProgressRows(caseData);
    expect(goals.some((row) => row.id === 'upper-midline')).toBe(true);

    expect(wearScheduleLabel(caseData)).not.toBe('Not set');
    expect(estimateAlignerSets(caseData).caption).toBeTruthy();
    expect(attachmentSummary(caseData).restricted).toBe(1);

    const media = pickHighlightMedia(caseData.files);
    expect(media.stl?.originalName).toBe('upper.stl');
    expect(media.xray).toBeTruthy();
    expect(media.photos).toHaveLength(1);

    expect(allergyAlerts(caseData)[0]).toMatch(/allerg/i);
    expect(buildActivityFeed(caseData).length).toBeGreaterThan(0);

    const cancelled = buildClinicalJourney({ ...caseData, status: CASE_STATUSES.CANCELLED });
    expect(cancelled.some((m) => m.state === 'cancelled')).toBe(true);

    const alerts = clinicalAlertLines({
      ...caseData,
      treatmentInstructions: { specialRequirements: 'Watch torque' },
      clinicalPreferences: {
        doNotMoveTeeth: ['11'],
        avoidEngagersTeeth: ['12'],
        extractionTeeth: ['18'],
        leaveSpacesOpenTeeth: ['14'],
      },
    } as unknown as CaseDetailDto);
    expect(alerts.join(' ')).toMatch(/Do not move|Avoid engagers|Extractions|Leave spaces/);

    expect(relativeTime(hourAgo)).toMatch(/h ago|m ago/);
    expect(
      timelineProgressPercent([
        { status: CASE_STATUSES.NEW_CASE, state: 'complete' },
        { status: CASE_STATUSES.IN_PROCESS, state: 'current' },
      ] as never),
    ).toBeGreaterThan(0);

    const approved = buildClinicalJourney({
      ...caseData,
      status: CASE_STATUSES.APPROVED,
      delivery: { viewLink: 'https://x' },
    } as unknown as CaseDetailDto);
    expect(journeyProgressPercent(approved)).toBe(100);

    const fallbackGoals = buildGoalProgressRows({
      ...caseData,
      occlusionGoals: {},
      treatmentInstructions: { treatmentGoal: 'Align', arches: 'both' },
      status: CASE_STATUSES.APPROVED,
    } as unknown as CaseDetailDto);
    expect(fallbackGoals[0]?.id).toBe('treatment-goal');

    expect(
      pickHighlightMedia([
        file({ category: FILE_CATEGORIES.SCAN, originalName: 'a.ply', filename: 'a.ply' }),
        file({ category: FILE_CATEGORIES.DICOM, originalName: 'cbct.dcm' }),
        file({ category: FILE_CATEGORIES.STL, originalName: 'a.stl', version: 2 }),
        file({ category: FILE_CATEGORIES.STL, originalName: 'a.stl', version: 1 }),
      ]).stl?.version,
    ).toBe(2);

    expect(wearScheduleLabel({ recordsNumbering: {} } as never)).toBe('Not set');
    expect(
      estimateAlignerSets({
        ...caseData,
        recordsNumbering: { plannedTreatmentDuration: '8 weeks', wearSchedule: '3_weeks' },
      } as never).caption,
    ).toMatch(/estimated|Not staged|Span/);
    expect(
      estimateAlignerSets({
        ...caseData,
        recordsNumbering: { plannedTreatmentDuration: '4', wearSchedule: '2_weeks' },
      } as never).caption,
    ).toBeTruthy();
  });
});
