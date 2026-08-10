import {
  ALL_ARCH_OPTIONS,
  ALL_CASE_PRIORITIES,
  ALL_CASE_STATUSES,
  ALL_PAYMENT_STATUSES,
  isArchOption,
  isCaseCategory,
  isCasePriority,
  isCaseStatus,
  isCaseType,
  isConsultantIndicator,
  isDoctorDecision,
  isFileCategory,
  isPaymentStatus,
  isQcErrorCode,
  type CasePriority,
  type CaseStatus,
} from '@ayetis/shared';
import { z } from 'zod';

const looseStringArray = z.array(z.string().trim().max(40)).optional();

const recordsNumberingSchema = z
  .object({
    toothNumberingSystem: z.string().optional(),
    impressionMethod: z.string().optional(),
    impressionsTaken: looseStringArray,
    additionalRecords: z.array(z.string().trim().max(120)).optional(),
    treatArches: z.string().optional(),
    velocityPerStage: z.string().optional(),
    velocityCustomMm: z.string().optional(),
    caseComplexity: z.string().optional(),
    wearSchedule: z.string().optional(),
    trimlineHeight: z.string().optional(),
    retainerRequired: z.boolean().nullable().optional(),
    plannedTreatmentDuration: z.string().optional(),
  })
  .optional();

const clinicalPreferencesSchema = z
  .object({
    doNotMoveTeeth: looseStringArray,
    avoidEngagersTeeth: looseStringArray,
    extractionTeeth: looseStringArray,
    leaveSpacesOpenTeeth: looseStringArray,
  })
  .optional();

const occlusionGoalsSchema = z
  .object({
    upperMidlineMm: z.number().nullable().optional(),
    upperMidlineObjective: z.string().optional(),
    lowerMidlineMm: z.number().nullable().optional(),
    lowerMidlineObjective: z.string().optional(),
    overjetMm: z.number().nullable().optional(),
    overjetObjective: z.string().optional(),
    overbitePercent: z.number().nullable().optional(),
    overbiteObjective: z.string().optional(),
    canineRelationship: z.string().optional(),
    molarRelationship: z.string().optional(),
    anteriorCrossbite: z.string().optional(),
    posteriorCrossbite: z.string().optional(),
    deciduousTeeth: z.string().optional(),
    iprAllowed: z.boolean().nullable().optional(),
    engagersAllowed: z.boolean().nullable().optional(),
    spaceManagement: z.string().optional(),
    clinicalInstructions: z.string().optional(),
  })
  .optional();

const commercialSchema = z
  .object({
    treatmentApproach: z.string().optional(),
    treatmentSubCategory: z.string().optional(),
    treatmentPlanId: z.string().nullable().optional(),
    treatmentPlanName: z.string().optional(),
    currency: z.string().optional(),
    unitPrice: z.number().nullable().optional(),
    discountCode: z.string().optional(),
    discountAmount: z.number().nullable().optional(),
    finalPayableAmount: z.number().nullable().optional(),
  })
  .optional();

const prioritySchema = z
  .string()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value): value is CasePriority | undefined => !value || isCasePriority(value), {
    message: `priority must be one of: ${ALL_CASE_PRIORITIES.join(', ')}`,
  });

const statusSchema = z
  .string()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value): value is CaseStatus | undefined => !value || isCaseStatus(value), {
    message: `status must be one of: ${ALL_CASE_STATUSES.join(', ')}`,
  });

const treatmentInstructionsSchema = z
  .object({
    arches: z
      .string()
      .optional()
      .refine((value) => !value || isArchOption(value), {
        message: `arches must be one of: ${ALL_ARCH_OPTIONS.join(', ')}`,
      }),
    applianceType: z.string().trim().max(120).optional(),
    treatmentGoal: z.string().trim().max(2000).optional(),
    biteDetails: z.string().trim().max(2000).optional(),
    retainers: z.string().trim().max(1000).optional(),
    specialRequirements: z.string().trim().max(2000).optional(),
    additionalNotes: z.string().trim().max(2000).optional(),
  })
  .optional();

export const listCasesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: statusSchema,
  priority: prioritySchema,
  q: z
    .string()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  includeDeleted: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => value === true || value === 'true'),
});

export const createCaseSchema = z.object({
  patientName: z.string().trim().min(1, 'Patient name is required').max(120),
  patientAge: z.number().int().min(0).max(120).nullable().optional(),
  patientGender: z.string().trim().max(40).optional(),
  patientDateOfBirth: z.string().trim().max(40).nullable().optional(),
  clinicName: z.string().trim().max(120).optional(),
  practiceName: z.string().trim().max(160).optional(),
  country: z.string().trim().max(80).optional(),
  chiefComplaint: z.string().trim().max(2000).optional(),
  caseCategory: z
    .string()
    .optional()
    .refine((value) => !value || isCaseCategory(value), { message: 'Invalid case category' }),
  caseType: z
    .string()
    .optional()
    .refine((value) => !value || isCaseType(value), { message: 'Invalid case type' }),
  treatmentSummary: z.string().trim().min(1, 'Treatment summary is required').max(2000),
  instructions: z.string().trim().max(5000).optional(),
  treatmentInstructions: treatmentInstructionsSchema,
  recordsNumbering: recordsNumberingSchema,
  clinicalPreferences: clinicalPreferencesSchema,
  occlusionGoals: occlusionGoalsSchema,
  commercial: commercialSchema,
  priority: z
    .string()
    .optional()
    .refine((value) => !value || isCasePriority(value), {
      message: 'Invalid priority',
    }),
  initialNote: z.string().trim().max(2000).optional(),
  asDraft: z.boolean().optional(),
  doctorId: z.string().trim().min(1).optional(),
});

export const updateCaseSchema = z
  .object({
    patientName: z.string().trim().min(1).max(120).optional(),
    patientAge: z.number().int().min(0).max(120).nullable().optional(),
    patientGender: z.string().trim().max(40).optional(),
    patientDateOfBirth: z.string().trim().max(40).nullable().optional(),
    clinicName: z.string().trim().max(120).optional(),
    practiceName: z.string().trim().max(160).optional(),
    country: z.string().trim().max(80).optional(),
    chiefComplaint: z.string().trim().max(2000).optional(),
    caseCategory: z
      .string()
      .optional()
      .refine((value) => !value || isCaseCategory(value), { message: 'Invalid case category' }),
    caseType: z
      .string()
      .optional()
      .refine((value) => !value || isCaseType(value), { message: 'Invalid case type' }),
    treatmentSummary: z.string().trim().min(1).max(2000).optional(),
    instructions: z.string().trim().max(5000).optional(),
    treatmentInstructions: treatmentInstructionsSchema,
    recordsNumbering: recordsNumberingSchema,
    clinicalPreferences: clinicalPreferencesSchema,
    occlusionGoals: occlusionGoalsSchema,
    commercial: commercialSchema,
    priority: z
      .string()
      .optional()
      .refine((value) => !value || isCasePriority(value), { message: 'Invalid priority' }),
    status: z
      .string()
      .optional()
      .refine((value) => !value || isCaseStatus(value), { message: 'Invalid status' }),
    submitDraft: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const treatmentInstructionsBodySchema = z.object({
  arches: z
    .string()
    .optional()
    .refine((value) => !value || isArchOption(value), {
      message: `arches must be one of: ${ALL_ARCH_OPTIONS.join(', ')}`,
    }),
  applianceType: z.string().trim().max(120).optional(),
  treatmentGoal: z.string().trim().max(2000).optional(),
  biteDetails: z.string().trim().max(2000).optional(),
  retainers: z.string().trim().max(1000).optional(),
  specialRequirements: z.string().trim().max(2000).optional(),
  additionalNotes: z.string().trim().max(2000).optional(),
});

export const updatePaymentSchema = z
  .object({
    status: z
      .string()
      .optional()
      .refine((value) => !value || isPaymentStatus(value), {
        message: `status must be one of: ${ALL_PAYMENT_STATUSES.join(', ')}`,
      }),
    currency: z.string().trim().max(8).optional(),
    amountDue: z.number().min(0).nullable().optional(),
    amountPaid: z.number().min(0).nullable().optional(),
    invoiceNumber: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one payment field is required',
  });

export const reasonSchema = z.object({
  reason: z.string().trim().min(3, 'Reason is required').max(500),
  remarks: z.string().trim().max(2000).optional(),
});

export const addNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note is required').max(2000),
});

export const setPrioritySchema = z.object({
  priority: z
    .string()
    .refine((value) => isCasePriority(value), { message: 'Invalid priority' }),
});

export const uploadFilesMetaSchema = z.object({
  category: z
    .string()
    .optional()
    .refine((value) => !value || isFileCategory(value), {
      message: 'Invalid file category',
    }),
  note: z.string().trim().max(500).optional(),
});

export const viewerLinkSchema = z.object({
  url: z.string().trim().url('Enter a valid URL').max(2000),
  label: z.string().trim().max(160).optional(),
  note: z.string().trim().max(500).optional(),
});

export const validateCaseSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  force: z.boolean().optional(),
});

export const assignCaseSchema = z
  .object({
    mode: z.enum(['designer', 'auto_queue']),
    designerId: z.string().trim().min(1).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'designer' && !value.designerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'designerId is required when mode is designer',
        path: ['designerId'],
      });
    }
  });

export const productionNotesSchema = z.object({
  notes: z.string().trim().max(5000).optional(),
});

export const qcCommentSchema = z.object({
  comments: z.string().trim().min(1, 'Comments are required').max(5000),
});

export const qcApproveSchema = z.object({
  comments: z.string().trim().max(5000).optional(),
  deliveryViewLink: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export const qcRejectSchema = z.object({
  errorCode: z
    .string()
    .refine((value) => isQcErrorCode(value), { message: 'Invalid QC error code' }),
  comments: z.string().trim().min(1, 'Comments are required').max(5000),
  requiredChanges: z.string().trim().min(1, 'Required changes are required').max(5000),
});

export const performanceQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  view: z.enum(['month', 'quarter']).optional(),
});

export const clinicalRemarkSchema = z.object({
  body: z.string().trim().min(1, 'Clinical remark is required').max(5000),
  indicator: z
    .string()
    .refine((value) => isConsultantIndicator(value), { message: 'Invalid indicator' }),
});

export const doctorDecisionSchema = z.object({
  decision: z
    .string()
    .refine((value) => isDoctorDecision(value), { message: 'Invalid doctor decision' }),
  note: z.string().trim().max(2000).optional(),
});
