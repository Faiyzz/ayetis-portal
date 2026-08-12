import {
  ALL_ADDITIONAL_RECORDS,
  ALL_ARCH_OPTIONS,
  ALL_CASE_COMPLEXITIES,
  ALL_CASE_PRIORITIES,
  ALL_CASE_STATUSES,
  ALL_CROSSBITE_OBJECTIVES,
  ALL_DECIDUOUS_TEETH_OPTIONS,
  ALL_IMPRESSION_METHODS,
  ALL_IMPROVE_OBJECTIVES,
  ALL_MIDLINE_OBJECTIVES,
  ALL_PAYMENT_STATUSES,
  ALL_RELATIONSHIP_OBJECTIVES,
  ALL_SPACE_MANAGEMENT_OPTIONS,
  ALL_TOOTH_NUMBERING_SYSTEMS,
  ALL_TREATMENT_APPROACHES,
  ALL_TRIMLINE_HEIGHTS,
  ALL_VELOCITY_PER_STAGE,
  ALL_WEAR_SCHEDULES,
  AESTHETIC_SUBCATEGORIES,
  ALL_IMPLANT_PLANNING_MODES,
  ALL_PROSTHO_MATERIALS,
  CASE_CATEGORIES,
  COMPLEX_SUBCATEGORIES,
  firstFieldError,
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
  validateDigitalAlignerPart1,
  validateDigitalAlignerPart3,
  validateImplantSubmit,
  validateProsthodonticSubmit,
  type CasePriority,
  type CaseStatus,
  type CaseCommercial,
  type DigitalAlignerPart1Input,
  type DigitalAlignerPart3Input,
  type ImplantDetails,
  type ProsthoDetails,
} from '@ayetis/shared';
import { z } from 'zod';

const looseStringArray = z.array(z.string().trim().max(40)).optional();

const enumOrEmpty = (values: readonly string[]) =>
  z
    .string()
    .optional()
    .refine((value) => !value || values.includes(value), {
      message: `Must be one of: ${values.join(', ')}`,
    });

const recordsNumberingSchema = z
  .object({
    toothNumberingSystem: enumOrEmpty(ALL_TOOTH_NUMBERING_SYSTEMS),
    impressionMethod: enumOrEmpty(ALL_IMPRESSION_METHODS),
    impressionsTaken: z
      .array(z.string().trim())
      .optional()
      .refine(
        (arr) => !arr || arr.every((v) => (ALL_ARCH_OPTIONS as string[]).includes(v)),
        { message: 'Invalid impressionsTaken arch' },
      ),
    additionalRecords: z
      .array(z.string().trim().max(120))
      .optional()
      .refine(
        (arr) =>
          !arr ||
          arr.every(
            (v) =>
              (ALL_ADDITIONAL_RECORDS as string[]).includes(v) || v.length > 0,
          ),
        { message: 'Invalid additional record' },
      ),
    treatArches: enumOrEmpty(ALL_ARCH_OPTIONS),
    velocityPerStage: enumOrEmpty(ALL_VELOCITY_PER_STAGE),
    velocityCustomMm: z.string().trim().max(40).optional(),
    caseComplexity: enumOrEmpty(ALL_CASE_COMPLEXITIES),
    wearSchedule: enumOrEmpty(ALL_WEAR_SCHEDULES),
    trimlineHeight: enumOrEmpty(ALL_TRIMLINE_HEIGHTS),
    retainerRequired: z.boolean().nullable().optional(),
    plannedTreatmentDuration: z.string().trim().max(200).optional(),
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
    upperMidlineObjective: enumOrEmpty(ALL_MIDLINE_OBJECTIVES),
    lowerMidlineMm: z.number().nullable().optional(),
    lowerMidlineObjective: enumOrEmpty(ALL_MIDLINE_OBJECTIVES),
    overjetMm: z.number().nullable().optional(),
    overjetObjective: enumOrEmpty(ALL_IMPROVE_OBJECTIVES),
    overbitePercent: z.number().nullable().optional(),
    overbiteObjective: enumOrEmpty(ALL_IMPROVE_OBJECTIVES),
    canineRelationship: enumOrEmpty(ALL_RELATIONSHIP_OBJECTIVES),
    molarRelationship: enumOrEmpty(ALL_RELATIONSHIP_OBJECTIVES),
    anteriorCrossbite: enumOrEmpty(ALL_CROSSBITE_OBJECTIVES),
    posteriorCrossbite: enumOrEmpty(ALL_CROSSBITE_OBJECTIVES),
    deciduousTeeth: enumOrEmpty(ALL_DECIDUOUS_TEETH_OPTIONS),
    iprAllowed: z.boolean().nullable().optional(),
    engagersAllowed: z.boolean().nullable().optional(),
    spaceManagement: enumOrEmpty(ALL_SPACE_MANAGEMENT_OPTIONS),
    clinicalInstructions: z.string().trim().max(5000).optional(),
  })
  .optional();

const ALL_SUBCATEGORIES = [
  ...AESTHETIC_SUBCATEGORIES,
  ...COMPLEX_SUBCATEGORIES,
] as const;

const prosthoDetailsSchema = z
  .object({
    restorationTeeth: looseStringArray,
    abutmentTeeth: looseStringArray,
    ponticTeeth: looseStringArray,
    material: enumOrEmpty(ALL_PROSTHO_MATERIALS),
    materialOther: z.string().trim().max(120).optional(),
    shade: z.string().trim().max(40).optional(),
    units: z.number().int().min(1).max(32).nullable().optional(),
    antagonistNotes: z.string().trim().max(2000).optional(),
    clinicalNotes: z.string().trim().max(5000).optional(),
  })
  .optional();

const implantDetailsSchema = z
  .object({
    implantSites: looseStringArray,
    implantCount: z.number().int().min(1).max(32).nullable().optional(),
    planningMode: enumOrEmpty(ALL_IMPLANT_PLANNING_MODES),
    cbctAvailable: z.boolean().nullable().optional(),
    boneGraftRequired: z.boolean().nullable().optional(),
    restorationPlanned: z.string().trim().max(200).optional(),
    surgicalGuideRequired: z.boolean().nullable().optional(),
    clinicalNotes: z.string().trim().max(5000).optional(),
  })
  .optional();

const commercialSchema = z
  .object({
    treatmentApproach: enumOrEmpty(ALL_TREATMENT_APPROACHES),
    treatmentSubCategory: enumOrEmpty(ALL_SUBCATEGORIES),
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
  caseCategory: z
    .string()
    .optional()
    .refine((value) => !value || isCaseCategory(value), { message: 'Invalid case category' }),
  caseType: z
    .string()
    .optional()
    .refine((value) => !value || isCaseType(value), { message: 'Invalid case type' }),
  caseId: z.string().trim().max(80).optional(),
  patient: z.string().trim().max(120).optional(),
  sortBy: z
    .enum([
      'createdAt',
      'updatedAt',
      'caseId',
      'patientName',
      'status',
      'caseCategory',
      'caseType',
    ])
    .optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  q: z
    .string()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  includeDeleted: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => value === true || value === 'true'),
  isDemo: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === true || value === 'true',
    ),
});

export const createCaseSchema = z
  .object({
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
    prosthoDetails: prosthoDetailsSchema,
    implantDetails: implantDetailsSchema,
    commercial: commercialSchema,
    priority: z
      .string()
      .optional()
      .refine((value) => !value || isCasePriority(value), {
        message: 'Invalid priority',
      }),
    initialNote: z.string().trim().max(2000).optional(),
    asDraft: z.boolean().optional(),
    isDemo: z.boolean().optional(),
    paymentSessionId: z.string().trim().min(1).optional(),
    doctorId: z.string().trim().min(1).optional(),
    facilityId: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.asDraft) return;
    const patient = {
      patientName: value.patientName,
      practiceName: value.practiceName,
      clinicName: value.clinicName,
      chiefComplaint: value.chiefComplaint,
      patientDateOfBirth: value.patientDateOfBirth,
      caseCategory: value.caseCategory,
      caseType: value.caseType,
      recordsNumbering: value.recordsNumbering as DigitalAlignerPart1Input['recordsNumbering'],
    };
    let combined: Record<string, string> = {};
    if (value.caseCategory === CASE_CATEGORIES.DIGITAL_ALIGNER || !value.caseCategory) {
      combined = {
        ...validateDigitalAlignerPart1(patient),
        ...validateDigitalAlignerPart3({
          commercial: value.commercial as DigitalAlignerPart3Input['commercial'],
        }),
      };
    } else if (value.caseCategory === CASE_CATEGORIES.PROSTHODONTIC) {
      combined = validateProsthodonticSubmit({
        patient,
        prosthoDetails: value.prosthoDetails as Partial<ProsthoDetails> | undefined,
        commercial: value.commercial as Partial<CaseCommercial> | undefined,
      });
    } else if (value.caseCategory === CASE_CATEGORIES.IMPLANT) {
      combined = validateImplantSubmit({
        patient,
        implantDetails: value.implantDetails as Partial<ImplantDetails> | undefined,
        commercial: value.commercial as Partial<CaseCommercial> | undefined,
      });
    }
    const message = firstFieldError(combined);
    if (message) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: [Object.keys(combined)[0]!.split('.')[0]!],
      });
    }
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
    prosthoDetails: prosthoDetailsSchema,
    implantDetails: implantDetailsSchema,
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
    mode: z.enum(['designer', 'auto_queue', 'cut_operator', 'cut_auto_queue']),
    designerId: z.string().trim().min(1).optional(),
    cutOperatorId: z.string().trim().min(1).optional(),
    cutRequired: z.boolean().optional(),
    designerAutoQueueAfterCut: z.boolean().optional(),
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
    if (value.mode === 'cut_operator' && !value.cutOperatorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cutOperatorId is required when mode is cut_operator',
        path: ['cutOperatorId'],
      });
    }
  });

export const startCutSchema = z.object({
  notes: z.string().trim().max(5000).optional(),
});

export const saveCutProgressSchema = z.object({
  notes: z.string().trim().max(5000).optional(),
  comment: z.string().trim().max(5000).optional(),
});

export const submitCutSchema = z.object({
  notes: z.string().trim().max(5000).optional(),
  designerAutoQueue: z.boolean().optional(),
});

export const requestCutReworkSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500),
  comments: z.string().trim().min(1, 'Comments are required').max(5000),
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
