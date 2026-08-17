import {
  ARCH_OPTION_LABELS,
  CROSSBITE_OBJECTIVE_LABELS,
  EMPTY_CLINICAL_PREFERENCES,
  EMPTY_OCCLUSION_GOALS,
  EMPTY_RECORDS_NUMBERING,
  EMPTY_TREATMENT_INSTRUCTIONS,
  FILE_CATEGORIES,
  IMPROVE_OBJECTIVE_LABELS,
  MIDLINE_OBJECTIVE_LABELS,
  RELATIONSHIP_OBJECTIVE_LABELS,
  WEAR_SCHEDULE_LABELS,
  type CaseDetailDto,
  type CaseFileDto,
  type FileCategory,
  type TimelineStep,
  type WearSchedule,
} from '@ayetis/shared';

export function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function timelineProgressPercent(steps: TimelineStep[]): number {
  if (steps.length === 0) return 0;
  if (steps.some((s) => s.state === 'cancelled')) {
    const complete = steps.filter((s) => s.state === 'complete').length;
    return Math.round((complete / steps.length) * 100);
  }
  const currentIndex = steps.findIndex((s) => s.state === 'current');
  const complete = steps.filter((s) => s.state === 'complete').length;
  if (currentIndex < 0) return complete === steps.length ? 100 : 0;
  if (steps[currentIndex]?.status === 'approved') return 100;
  return Math.round(((complete + 0.45) / steps.length) * 100);
}

export type JourneyMilestoneState = 'complete' | 'current' | 'upcoming' | 'cancelled';

export type JourneyMilestone = {
  id: string;
  label: string;
  caption: string;
  state: JourneyMilestoneState;
};

function hasImaging(files: CaseFileDto[]): boolean {
  return files.some((f) =>
    (
      [FILE_CATEGORIES.STL, FILE_CATEGORIES.SCAN, FILE_CATEGORIES.PHOTO, FILE_CATEGORIES.XRAY, FILE_CATEGORIES.DICOM] as FileCategory[]
    ).includes(f.category),
  );
}

/**
 * Clinical journey mapped onto real case workflow (not a second source of truth).
 * Imaging / aligner-set labels are derived from files + status.
 */
export function buildClinicalJourney(caseData: CaseDetailDto): JourneyMilestone[] {
  const cancelled = caseData.status === 'cancelled';
  const imagingReady = hasImaging(caseData.files);
  const planReady =
    caseData.status === 'waiting_for_approval' ||
    caseData.status === 'approved' ||
    Boolean(caseData.submittedToQcAt) ||
    Boolean(caseData.productionStartedAt);
  const set1Ready =
    caseData.status === 'waiting_for_approval' ||
    caseData.status === 'approved' ||
    Boolean(caseData.delivery);
  const set2Ready = caseData.status === 'approved' && Boolean(caseData.delivery);

  const stages: Array<{ id: string; label: string; caption: string }> = [
    {
      id: 'new',
      label: 'New Case',
      caption: caseData.status === 'saved_for_submission' ? 'Draft' : 'Submitted',
    },
    {
      id: 'imaging',
      label: 'Imaging',
      caption: imagingReady ? `${caseData.files.length} records` : 'Awaiting scans',
    },
    {
      id: 'plan',
      label: 'Treatment Plan',
      caption: planReady ? 'Plan in review' : 'Design in progress',
    },
    {
      id: 'set1',
      label: 'Aligner Set 1',
      caption: set1Ready ? 'Plan staged' : 'Not staged yet',
    },
    {
      id: 'set2',
      label: 'Aligner Set 2',
      caption: set2Ready ? 'Delivery package' : 'Upcoming',
    },
  ];

  const currentId =
    caseData.status === 'approved'
      ? 'set2'
      : caseData.status === 'waiting_for_approval'
        ? 'set1'
        : caseData.status === 'in_process'
          ? 'plan'
          : caseData.status === 'new_case' && imagingReady
            ? 'imaging'
            : 'new';

  const currentIndex = Math.max(0, stages.findIndex((s) => s.id === currentId));

  return stages.map((stage, index) => {
    let state: JourneyMilestoneState = 'upcoming';
    if (cancelled) {
      state = index === 0 ? 'complete' : 'cancelled';
    } else if (caseData.status === 'approved' || index < currentIndex) {
      state = 'complete';
    } else if (index === currentIndex) {
      state = 'current';
    }
    return { ...stage, state };
  });
}

export function journeyProgressPercent(milestones: JourneyMilestone[]): number {
  if (milestones.length === 0) return 0;
  const complete = milestones.filter((m) => m.state === 'complete').length;
  const current = milestones.some((m) => m.state === 'current') ? 0.4 : 0;
  if (milestones.every((m) => m.state === 'complete')) return 100;
  return Math.min(100, Math.round(((complete + current) / milestones.length) * 100));
}

export type GoalProgressRow = {
  id: string;
  label: string;
  goal: string;
  current: string;
  progress: number;
};

function objectiveLabel(
  value: string,
  map: Record<string, string>,
): string {
  return map[value] || value || '—';
}

function formatMm(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return `${value.toFixed(1)} mm`;
}

/**
 * Plan targets from occlusion / treatment instructions.
 * "Current" is workflow-stage progress, not intraoral tracking (that data is not in the case model).
 */
export function buildGoalProgressRows(caseData: CaseDetailDto): GoalProgressRow[] {
  const occ = { ...EMPTY_OCCLUSION_GOALS, ...caseData.occlusionGoals };
  const ti = { ...EMPTY_TREATMENT_INSTRUCTIONS, ...caseData.treatmentInstructions };
  const stage = timelineProgressPercent(caseData.timeline);
  const stageLabel =
    caseData.status === 'approved'
      ? 'Plan locked'
      : caseData.status === 'waiting_for_approval'
        ? 'Awaiting approval'
        : caseData.status === 'in_process'
          ? 'In design'
          : 'Intake';

  const rows: GoalProgressRow[] = [];

  const upperMm = formatMm(occ.upperMidlineMm);
  if (upperMm || occ.upperMidlineObjective) {
    rows.push({
      id: 'upper-midline',
      label: 'Upper midline',
      goal: [upperMm, objectiveLabel(occ.upperMidlineObjective, MIDLINE_OBJECTIVE_LABELS)]
        .filter((v) => v && v !== '—')
        .join(' · ') || '—',
      current: stageLabel,
      progress: stage,
    });
  }

  const lowerMm = formatMm(occ.lowerMidlineMm);
  if (lowerMm || occ.lowerMidlineObjective) {
    rows.push({
      id: 'lower-midline',
      label: 'Lower midline',
      goal: [lowerMm, objectiveLabel(occ.lowerMidlineObjective, MIDLINE_OBJECTIVE_LABELS)]
        .filter((v) => v && v !== '—')
        .join(' · ') || '—',
      current: stageLabel,
      progress: stage,
    });
  }

  const overjet = formatMm(occ.overjetMm);
  if (overjet || occ.overjetObjective) {
    rows.push({
      id: 'overjet',
      label: 'Overjet',
      goal: [overjet, objectiveLabel(occ.overjetObjective, IMPROVE_OBJECTIVE_LABELS)]
        .filter((v) => v && v !== '—')
        .join(' · ') || '—',
      current: stageLabel,
      progress: stage,
    });
  }

  if (occ.overbitePercent != null || occ.overbiteObjective) {
    rows.push({
      id: 'overbite',
      label: 'Overbite',
      goal: [
        occ.overbitePercent != null ? `${occ.overbitePercent}%` : null,
        objectiveLabel(occ.overbiteObjective, IMPROVE_OBJECTIVE_LABELS),
      ]
        .filter((v) => v && v !== '—')
        .join(' · ') || '—',
      current: stageLabel,
      progress: stage,
    });
  }

  if (occ.posteriorCrossbite) {
    rows.push({
      id: 'expansion',
      label: 'Maxillary expansion',
      goal: objectiveLabel(occ.posteriorCrossbite, CROSSBITE_OBJECTIVE_LABELS),
      current: stageLabel,
      progress: stage,
    });
  }

  if (occ.canineRelationship) {
    rows.push({
      id: 'canine',
      label: 'Canine relationship',
      goal: objectiveLabel(occ.canineRelationship, RELATIONSHIP_OBJECTIVE_LABELS),
      current: stageLabel,
      progress: stage,
    });
  }

  if (occ.molarRelationship) {
    rows.push({
      id: 'molar',
      label: 'Molar relationship',
      goal: objectiveLabel(occ.molarRelationship, RELATIONSHIP_OBJECTIVE_LABELS),
      current: stageLabel,
      progress: stage,
    });
  }

  if (rows.length === 0) {
    rows.push({
      id: 'treatment-goal',
      label: 'Treatment goal',
      goal: ti.treatmentGoal || caseData.treatmentSummary || 'Not specified',
      current: stageLabel,
      progress: stage,
    });
    if (ti.arches) {
      rows.push({
        id: 'arches',
        label: 'Arches',
        goal: ARCH_OPTION_LABELS[ti.arches],
        current: stageLabel,
        progress: stage,
      });
    }
  }

  return rows.slice(0, 6);
}

export const PROTOCOL_WEAR_HOURS = 22;

export function wearScheduleLabel(caseData: CaseDetailDto): string {
  const records = { ...EMPTY_RECORDS_NUMBERING, ...caseData.recordsNumbering };
  if (records.wearSchedule && records.wearSchedule in WEAR_SCHEDULE_LABELS) {
    return WEAR_SCHEDULE_LABELS[records.wearSchedule as WearSchedule];
  }
  return 'Not set';
}

export function estimateAlignerSets(caseData: CaseDetailDto): {
  total: number | null;
  remaining: number | null;
  caption: string;
} {
  const records = { ...EMPTY_RECORDS_NUMBERING, ...caseData.recordsNumbering };
  const duration = records.plannedTreatmentDuration.trim();
  const monthsMatch = duration.match(/(\d+(?:\.\d+)?)\s*(month|mo|m)\b/i);
  const weeksMatch = duration.match(/(\d+(?:\.\d+)?)\s*(week|wk|w)\b/i);
  const bare = duration.match(/^(\d+(?:\.\d+)?)$/);
  let weeks: number | null = null;
  if (monthsMatch) weeks = Number(monthsMatch[1]) * 4.3;
  else if (weeksMatch) weeks = Number(weeksMatch[1]);
  else if (bare) weeks = Number(bare[1]) * 4.3;

  const perSet =
    records.wearSchedule === '1_week' ? 1 : records.wearSchedule === '3_weeks' ? 3 : 2;

  if (weeks == null || weeks <= 0) {
    return {
      total: null,
      remaining: null,
      caption: records.caseComplexity ? `Span ${records.caseComplexity}` : 'Not staged',
    };
  }

  const total = Math.max(1, Math.round(weeks / perSet));
  const progress = timelineProgressPercent(caseData.timeline) / 100;
  const remaining = Math.max(0, Math.round(total * (1 - progress)));
  return {
    total,
    remaining,
    caption: `${total} estimated from plan`,
  };
}

export function attachmentSummary(caseData: CaseDetailDto): {
  allowed: boolean | null;
  restricted: number;
  extractions: number;
} {
  const occ = { ...EMPTY_OCCLUSION_GOALS, ...caseData.occlusionGoals };
  const prefs = { ...EMPTY_CLINICAL_PREFERENCES, ...caseData.clinicalPreferences };
  return {
    allowed: occ.engagersAllowed,
    restricted: prefs.avoidEngagersTeeth.length,
    extractions: prefs.extractionTeeth.length,
  };
}

export type HighlightMedia = {
  stl: CaseFileDto | null;
  xray: CaseFileDto | null;
  photos: CaseFileDto[];
};

export function pickHighlightMedia(files: CaseFileDto[]): HighlightMedia {
  const latestByName = new Map<string, CaseFileDto>();
  for (const file of files) {
    const key = file.originalName || file.filename;
    const existing = latestByName.get(key);
    if (!existing || file.version > existing.version) latestByName.set(key, file);
  }
  const unique = [...latestByName.values()];
  const stl =
    unique.find((f) => f.category === FILE_CATEGORIES.STL) ||
    unique.find((f) => f.category === FILE_CATEGORIES.SCAN) ||
    unique.find((f) => f.category === FILE_CATEGORIES.MODEL) ||
    null;
  const xray =
    unique.find((f) => f.category === FILE_CATEGORIES.XRAY) ||
    unique.find((f) => f.category === FILE_CATEGORIES.DICOM) ||
    null;
  const photos = unique.filter((f) => f.category === FILE_CATEGORIES.PHOTO).slice(0, 4);
  return { stl, xray, photos };
}

export function isImageFile(file: CaseFileDto): boolean {
  if (file.category === FILE_CATEGORIES.PHOTO || file.category === FILE_CATEGORIES.XRAY) {
    return true;
  }
  return /image\//.test(file.mimeType) || /\.(jpe?g|png|gif|webp|bmp|tif{1,2})$/i.test(file.originalName || file.filename);
}

export function isStlLike(file: CaseFileDto): boolean {
  return (
    file.category === FILE_CATEGORIES.STL ||
    file.category === FILE_CATEGORIES.SCAN ||
    file.category === FILE_CATEGORIES.MODEL ||
    /\.(stl|obj|ply)$/i.test(file.originalName || file.filename)
  );
}

export function isPdfFile(file: CaseFileDto): boolean {
  return file.category === FILE_CATEGORIES.PDF || /pdf/i.test(file.mimeType) || /\.pdf$/i.test(file.originalName || file.filename);
}

export type MediaFilterId = 'all' | 'scans' | 'photos' | 'reports' | 'other';

export const MEDIA_FILTERS: Array<{ id: MediaFilterId; label: string; categories: FileCategory[] }> = [
  { id: 'all', label: 'All', categories: [] },
  {
    id: 'scans',
    label: 'STL Scans',
    categories: [FILE_CATEGORIES.STL, FILE_CATEGORIES.SCAN, FILE_CATEGORIES.MODEL, FILE_CATEGORIES.DICOM],
  },
  {
    id: 'photos',
    label: 'Photos',
    categories: [FILE_CATEGORIES.PHOTO, FILE_CATEGORIES.XRAY],
  },
  {
    id: 'reports',
    label: 'Reports',
    categories: [FILE_CATEGORIES.PDF, FILE_CATEGORIES.HTML_LINK, FILE_CATEGORIES.VIDEO],
  },
  {
    id: 'other',
    label: 'Other',
    categories: [FILE_CATEGORIES.ARCHIVE, FILE_CATEGORIES.CUT, FILE_CATEGORIES.OTHER],
  },
];

export type ActivityKind = 'message' | 'note' | 'event' | 'alert';

export type ActivityFeedItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  body: string;
  actor: string;
  at: string;
};

export function buildActivityFeed(caseData: CaseDetailDto): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = [];

  for (const thread of caseData.clarifications) {
    const last = thread.messages[thread.messages.length - 1];
    items.push({
      id: `clar-${thread.id}`,
      kind: 'message',
      title: thread.subject || 'Clarification',
      body: last?.body || thread.requiredInfo || thread.clarificationTypeLabel,
      actor: last?.authorName || thread.createdByName,
      at: last?.createdAt || thread.updatedAt || thread.createdAt,
    });
  }

  for (const note of caseData.notes) {
    items.push({
      id: `note-${note.id}`,
      kind: 'note',
      title: 'Clinical note',
      body: note.body,
      actor: note.authorName,
      at: note.createdAt,
    });
  }

  for (const entry of caseData.history.slice(0, 40)) {
    items.push({
      id: `hist-${entry.id}`,
      kind: 'event',
      title: entry.summary,
      body: entry.action,
      actor: entry.actorName || 'System',
      at: entry.createdAt,
    });
  }

  if (caseData.openClarificationCount > 0) {
    items.push({
      id: 'alert-clarifications',
      kind: 'alert',
      title: `${caseData.openClarificationCount} open clarification${caseData.openClarificationCount === 1 ? '' : 's'}`,
      body: 'Production may be waiting on a reply.',
      actor: 'Workflow',
      at: caseData.updatedAt,
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items.slice(0, 24);
}

export function allergyAlerts(caseData: CaseDetailDto): string[] {
  const ti = { ...EMPTY_TREATMENT_INSTRUCTIONS, ...caseData.treatmentInstructions };
  const special = ti.specialRequirements.trim();
  if (!special) return [];
  const allergyLike = /allerg/i.test(special);
  return allergyLike ? [special] : [];
}

export function clinicalAlertLines(caseData: CaseDetailDto): string[] {
  const lines: string[] = [];
  const allergies = allergyAlerts(caseData);
  if (allergies.length) lines.push(...allergies);
  const ti = { ...EMPTY_TREATMENT_INSTRUCTIONS, ...caseData.treatmentInstructions };
  if (ti.specialRequirements.trim() && !allergies.length) {
    lines.push(ti.specialRequirements.trim());
  }
  const prefs = { ...EMPTY_CLINICAL_PREFERENCES, ...caseData.clinicalPreferences };
  if (prefs.doNotMoveTeeth.length) {
    lines.push(`Do not move: ${prefs.doNotMoveTeeth.join(', ')}`);
  }
  if (prefs.extractionTeeth.length) {
    lines.push(`Extractions: ${prefs.extractionTeeth.join(', ')}`);
  }
  return lines.slice(0, 3);
}
