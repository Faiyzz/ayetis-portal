export const ARCH_OPTIONS = {
  UPPER: 'upper',
  LOWER: 'lower',
  BOTH: 'both',
} as const;

export type ArchOption = (typeof ARCH_OPTIONS)[keyof typeof ARCH_OPTIONS];

export const ALL_ARCH_OPTIONS: ArchOption[] = Object.values(ARCH_OPTIONS);

export const ARCH_OPTION_LABELS: Record<ArchOption, string> = {
  [ARCH_OPTIONS.UPPER]: 'Upper arch',
  [ARCH_OPTIONS.LOWER]: 'Lower arch',
  [ARCH_OPTIONS.BOTH]: 'Both arches',
};

export interface TreatmentInstructions {
  arches: ArchOption | '';
  applianceType: string;
  treatmentGoal: string;
  biteDetails: string;
  retainers: string;
  specialRequirements: string;
  additionalNotes: string;
}

export const EMPTY_TREATMENT_INSTRUCTIONS: TreatmentInstructions = {
  arches: '',
  applianceType: '',
  treatmentGoal: '',
  biteDetails: '',
  retainers: '',
  specialRequirements: '',
  additionalNotes: '',
};

export function isArchOption(value: string): value is ArchOption {
  return (ALL_ARCH_OPTIONS as string[]).includes(value);
}

export const TOOTH_NUMBERING_SYSTEMS = {
  FDI: 'fdi',
  UNIVERSAL: 'universal',
  PALMER: 'palmer',
} as const;

export type ToothNumberingSystem =
  (typeof TOOTH_NUMBERING_SYSTEMS)[keyof typeof TOOTH_NUMBERING_SYSTEMS];

export const ALL_TOOTH_NUMBERING_SYSTEMS: ToothNumberingSystem[] =
  Object.values(TOOTH_NUMBERING_SYSTEMS);

export const TOOTH_NUMBERING_LABELS: Record<ToothNumberingSystem, string> = {
  [TOOTH_NUMBERING_SYSTEMS.FDI]: 'FDI Numbering System',
  [TOOTH_NUMBERING_SYSTEMS.UNIVERSAL]: 'Universal Numbering System',
  [TOOTH_NUMBERING_SYSTEMS.PALMER]: 'Palmer Notation',
};

export const IMPRESSION_METHODS = {
  DIGITAL_SCAN: 'digital_scan',
  PVS: 'pvs',
} as const;

export type ImpressionMethod = (typeof IMPRESSION_METHODS)[keyof typeof IMPRESSION_METHODS];

export const ALL_IMPRESSION_METHODS: ImpressionMethod[] = Object.values(IMPRESSION_METHODS);

export const IMPRESSION_METHOD_LABELS: Record<ImpressionMethod, string> = {
  [IMPRESSION_METHODS.DIGITAL_SCAN]: 'Digital Scan',
  [IMPRESSION_METHODS.PVS]: 'PVS',
};

export const ADDITIONAL_RECORDS = {
  CLINICAL_PHOTOGRAPHS: 'clinical_photographs',
  RADIOGRAPHS: 'radiographs',
  BITE_REGISTRATION: 'bite_registration',
} as const;

export type AdditionalRecord =
  (typeof ADDITIONAL_RECORDS)[keyof typeof ADDITIONAL_RECORDS];

export const ALL_ADDITIONAL_RECORDS: AdditionalRecord[] = Object.values(ADDITIONAL_RECORDS);

export const ADDITIONAL_RECORD_LABELS: Record<AdditionalRecord, string> = {
  [ADDITIONAL_RECORDS.CLINICAL_PHOTOGRAPHS]: 'Clinical Photographs',
  [ADDITIONAL_RECORDS.RADIOGRAPHS]: 'Radiographs',
  [ADDITIONAL_RECORDS.BITE_REGISTRATION]: 'Bite Registration',
};

export const VELOCITY_PER_STAGE = {
  TWO_TENTHS: '0.2mm',
  THREE_TENTHS: '0.3mm',
  OTHER: 'other',
} as const;

export type VelocityPerStage =
  (typeof VELOCITY_PER_STAGE)[keyof typeof VELOCITY_PER_STAGE];

export const ALL_VELOCITY_PER_STAGE: VelocityPerStage[] = Object.values(VELOCITY_PER_STAGE);

export const VELOCITY_PER_STAGE_LABELS: Record<VelocityPerStage, string> = {
  [VELOCITY_PER_STAGE.TWO_TENTHS]: '0.2 mm',
  [VELOCITY_PER_STAGE.THREE_TENTHS]: '0.3 mm',
  [VELOCITY_PER_STAGE.OTHER]: 'Other',
};

export const WEAR_SCHEDULES = {
  ONE_WEEK: '1_week',
  TWO_WEEKS: '2_weeks',
  THREE_WEEKS: '3_weeks',
} as const;

export type WearSchedule = (typeof WEAR_SCHEDULES)[keyof typeof WEAR_SCHEDULES];

export const ALL_WEAR_SCHEDULES: WearSchedule[] = Object.values(WEAR_SCHEDULES);

export const WEAR_SCHEDULE_LABELS: Record<WearSchedule, string> = {
  [WEAR_SCHEDULES.ONE_WEEK]: '1 Week',
  [WEAR_SCHEDULES.TWO_WEEKS]: '2 Weeks',
  [WEAR_SCHEDULES.THREE_WEEKS]: '3 Weeks',
};

export const TRIMLINE_HEIGHTS = {
  ONE_MM: '1mm',
  TWO_MM: '2mm',
} as const;

export type TrimlineHeight = (typeof TRIMLINE_HEIGHTS)[keyof typeof TRIMLINE_HEIGHTS];

export const ALL_TRIMLINE_HEIGHTS: TrimlineHeight[] = Object.values(TRIMLINE_HEIGHTS);

export const TRIMLINE_HEIGHT_LABELS: Record<TrimlineHeight, string> = {
  [TRIMLINE_HEIGHTS.ONE_MM]: '1 mm',
  [TRIMLINE_HEIGHTS.TWO_MM]: '2 mm',
};

export const CASE_COMPLEXITIES = {
  THREE_THREE: '3-3',
  FOUR_FOUR: '4-4',
  FIVE_FIVE: '5-5',
  SIX_SIX: '6-6',
} as const;

export type CaseComplexity = (typeof CASE_COMPLEXITIES)[keyof typeof CASE_COMPLEXITIES];

export const ALL_CASE_COMPLEXITIES: CaseComplexity[] = Object.values(CASE_COMPLEXITIES);

export const TREATMENT_APPROACHES = {
  AESTHETIC: 'aesthetic',
  COMPLEX: 'complex',
} as const;

export type TreatmentApproach =
  (typeof TREATMENT_APPROACHES)[keyof typeof TREATMENT_APPROACHES];

export const ALL_TREATMENT_APPROACHES: TreatmentApproach[] =
  Object.values(TREATMENT_APPROACHES);

export const TREATMENT_APPROACH_LABELS: Record<TreatmentApproach, string> = {
  [TREATMENT_APPROACHES.AESTHETIC]: 'Aesthetic Treatment Plan',
  [TREATMENT_APPROACHES.COMPLEX]: 'Complex Treatment Plan',
};

export const AESTHETIC_SUBCATEGORIES = ['aesthetic_3-3', 'aesthetic_4-4', 'aesthetic_5-5'] as const;
export const COMPLEX_SUBCATEGORIES = ['complex_6-6', 'complex_7-7', 'complex_8-8'] as const;

export type TreatmentSubCategory =
  | (typeof AESTHETIC_SUBCATEGORIES)[number]
  | (typeof COMPLEX_SUBCATEGORIES)[number];

export const TREATMENT_SUBCATEGORY_LABELS: Record<TreatmentSubCategory, string> = {
  'aesthetic_3-3': 'Aesthetic 3–3',
  'aesthetic_4-4': 'Aesthetic 4–4',
  'aesthetic_5-5': 'Aesthetic 5–5',
  'complex_6-6': 'Complex 6–6',
  'complex_7-7': 'Complex 7–7',
  'complex_8-8': 'Complex 8–8',
};

export const MIDLINE_OBJECTIVES = {
  MAINTAIN: 'maintain',
  IMPROVE_RIGHT: 'improve_right',
  IMPROVE_LEFT: 'improve_left',
  CENTER: 'center',
} as const;

export type MidlineObjective =
  (typeof MIDLINE_OBJECTIVES)[keyof typeof MIDLINE_OBJECTIVES];

export const ALL_MIDLINE_OBJECTIVES: MidlineObjective[] = Object.values(MIDLINE_OBJECTIVES);

export const MIDLINE_OBJECTIVE_LABELS: Record<MidlineObjective, string> = {
  [MIDLINE_OBJECTIVES.MAINTAIN]: 'Maintain',
  [MIDLINE_OBJECTIVES.IMPROVE_RIGHT]: 'Improve – Right',
  [MIDLINE_OBJECTIVES.IMPROVE_LEFT]: 'Improve – Left',
  [MIDLINE_OBJECTIVES.CENTER]: 'Center',
};

export const IMPROVE_OBJECTIVES = {
  MAINTAIN: 'maintain',
  IMPROVE: 'improve',
} as const;

export type ImproveObjective =
  (typeof IMPROVE_OBJECTIVES)[keyof typeof IMPROVE_OBJECTIVES];

export const ALL_IMPROVE_OBJECTIVES: ImproveObjective[] = Object.values(IMPROVE_OBJECTIVES);

export const IMPROVE_OBJECTIVE_LABELS: Record<ImproveObjective, string> = {
  [IMPROVE_OBJECTIVES.MAINTAIN]: 'Maintain',
  [IMPROVE_OBJECTIVES.IMPROVE]: 'Improve',
};

export const RELATIONSHIP_OBJECTIVES = {
  MAINTAIN: 'maintain',
  IMPROVE: 'improve',
  IDEAL: 'ideal',
} as const;

export type RelationshipObjective =
  (typeof RELATIONSHIP_OBJECTIVES)[keyof typeof RELATIONSHIP_OBJECTIVES];

export const ALL_RELATIONSHIP_OBJECTIVES: RelationshipObjective[] =
  Object.values(RELATIONSHIP_OBJECTIVES);

export const RELATIONSHIP_OBJECTIVE_LABELS: Record<RelationshipObjective, string> = {
  [RELATIONSHIP_OBJECTIVES.MAINTAIN]: 'Maintain',
  [RELATIONSHIP_OBJECTIVES.IMPROVE]: 'Improve',
  [RELATIONSHIP_OBJECTIVES.IDEAL]: 'Ideal',
};

export const CROSSBITE_OBJECTIVES = {
  MAINTAIN: 'maintain',
  CORRECT: 'correct',
} as const;

export type CrossbiteObjective =
  (typeof CROSSBITE_OBJECTIVES)[keyof typeof CROSSBITE_OBJECTIVES];

export const ALL_CROSSBITE_OBJECTIVES: CrossbiteObjective[] =
  Object.values(CROSSBITE_OBJECTIVES);

export const CROSSBITE_OBJECTIVE_LABELS: Record<CrossbiteObjective, string> = {
  [CROSSBITE_OBJECTIVES.MAINTAIN]: 'Maintain',
  [CROSSBITE_OBJECTIVES.CORRECT]: 'Correct',
};

export const DECIDUOUS_TEETH_OPTIONS = {
  MAINTAIN: 'maintain',
  MOVE: 'move',
  EXTRACT: 'extract',
} as const;

export type DeciduousTeethOption =
  (typeof DECIDUOUS_TEETH_OPTIONS)[keyof typeof DECIDUOUS_TEETH_OPTIONS];

export const ALL_DECIDUOUS_TEETH_OPTIONS: DeciduousTeethOption[] =
  Object.values(DECIDUOUS_TEETH_OPTIONS);

export const DECIDUOUS_TEETH_LABELS: Record<DeciduousTeethOption, string> = {
  [DECIDUOUS_TEETH_OPTIONS.MAINTAIN]: 'Maintain',
  [DECIDUOUS_TEETH_OPTIONS.MOVE]: 'Move',
  [DECIDUOUS_TEETH_OPTIONS.EXTRACT]: 'Extract',
};

export const SPACE_MANAGEMENT_OPTIONS = {
  ANTERIOR_RETRACTION: 'anterior_retraction',
  POSTERIOR_MESIALIZATION: 'posterior_mesialization',
} as const;

export type SpaceManagementOption =
  (typeof SPACE_MANAGEMENT_OPTIONS)[keyof typeof SPACE_MANAGEMENT_OPTIONS];

export const ALL_SPACE_MANAGEMENT_OPTIONS: SpaceManagementOption[] = Object.values(
  SPACE_MANAGEMENT_OPTIONS,
);

export const SPACE_MANAGEMENT_LABELS: Record<SpaceManagementOption, string> = {
  [SPACE_MANAGEMENT_OPTIONS.ANTERIOR_RETRACTION]: 'Anterior Retraction',
  [SPACE_MANAGEMENT_OPTIONS.POSTERIOR_MESIALIZATION]: 'Posterior Mesialization',
};

/** Canonical FDI adult tooth IDs (persist these in clinical preference arrays). */
export const FDI_UPPER_TEETH = [
  '18',
  '17',
  '16',
  '15',
  '14',
  '13',
  '12',
  '11',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
] as const;

export const FDI_LOWER_TEETH = [
  '48',
  '47',
  '46',
  '45',
  '44',
  '43',
  '42',
  '41',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
] as const;

export const ALL_FDI_TEETH: string[] = [...FDI_UPPER_TEETH, ...FDI_LOWER_TEETH];

/** Universal numbering counterpart for each FDI id. */
const FDI_TO_UNIVERSAL: Record<string, string> = {
  '18': '1',
  '17': '2',
  '16': '3',
  '15': '4',
  '14': '5',
  '13': '6',
  '12': '7',
  '11': '8',
  '21': '9',
  '22': '10',
  '23': '11',
  '24': '12',
  '25': '13',
  '26': '14',
  '27': '15',
  '28': '16',
  '38': '17',
  '37': '18',
  '36': '19',
  '35': '20',
  '34': '21',
  '33': '22',
  '32': '23',
  '31': '24',
  '41': '25',
  '42': '26',
  '43': '27',
  '44': '28',
  '45': '29',
  '46': '30',
  '47': '31',
  '48': '32',
};

/** Palmer notation labels for each FDI id. */
const FDI_TO_PALMER: Record<string, string> = {
  '18': 'UR8',
  '17': 'UR7',
  '16': 'UR6',
  '15': 'UR5',
  '14': 'UR4',
  '13': 'UR3',
  '12': 'UR2',
  '11': 'UR1',
  '21': 'UL1',
  '22': 'UL2',
  '23': 'UL3',
  '24': 'UL4',
  '25': 'UL5',
  '26': 'UL6',
  '27': 'UL7',
  '28': 'UL8',
  '48': 'LR8',
  '47': 'LR7',
  '46': 'LR6',
  '45': 'LR5',
  '44': 'LR4',
  '43': 'LR3',
  '42': 'LR2',
  '41': 'LR1',
  '31': 'LL1',
  '32': 'LL2',
  '33': 'LL3',
  '34': 'LL4',
  '35': 'LL5',
  '36': 'LL6',
  '37': 'LL7',
  '38': 'LL8',
};

export function toothDisplayLabel(
  fdiId: string,
  system: ToothNumberingSystem,
): string {
  if (system === TOOTH_NUMBERING_SYSTEMS.UNIVERSAL) {
    return FDI_TO_UNIVERSAL[fdiId] ?? fdiId;
  }
  if (system === TOOTH_NUMBERING_SYSTEMS.PALMER) {
    return FDI_TO_PALMER[fdiId] ?? fdiId;
  }
  return fdiId;
}

export function isToothNumberingSystem(value: string): value is ToothNumberingSystem {
  return (ALL_TOOTH_NUMBERING_SYSTEMS as string[]).includes(value);
}

export function isImpressionMethod(value: string): value is ImpressionMethod {
  return (ALL_IMPRESSION_METHODS as string[]).includes(value);
}

export function isWearSchedule(value: string): value is WearSchedule {
  return (ALL_WEAR_SCHEDULES as string[]).includes(value);
}

export function isTrimlineHeight(value: string): value is TrimlineHeight {
  return (ALL_TRIMLINE_HEIGHTS as string[]).includes(value);
}

export function isCaseComplexity(value: string): value is CaseComplexity {
  return (ALL_CASE_COMPLEXITIES as string[]).includes(value);
}

export function isTreatmentApproach(value: string): value is TreatmentApproach {
  return (ALL_TREATMENT_APPROACHES as string[]).includes(value);
}

export function isTreatmentSubCategory(value: string): value is TreatmentSubCategory {
  return (
    (AESTHETIC_SUBCATEGORIES as readonly string[]).includes(value) ||
    (COMPLEX_SUBCATEGORIES as readonly string[]).includes(value)
  );
}

export function isVelocityPerStage(value: string): value is VelocityPerStage {
  return (ALL_VELOCITY_PER_STAGE as string[]).includes(value);
}

export interface RecordsNumbering {
  toothNumberingSystem: ToothNumberingSystem;
  impressionMethod: ImpressionMethod | '';
  impressionsTaken: ArchOption[];
  additionalRecords: string[];
  treatArches: ArchOption | '';
  velocityPerStage: string;
  velocityCustomMm: string;
  caseComplexity: CaseComplexity | '';
  wearSchedule: WearSchedule | '';
  trimlineHeight: TrimlineHeight | '';
  retainerRequired: boolean | null;
  plannedTreatmentDuration: string;
}

export const EMPTY_RECORDS_NUMBERING: RecordsNumbering = {
  toothNumberingSystem: TOOTH_NUMBERING_SYSTEMS.FDI,
  impressionMethod: '',
  impressionsTaken: [],
  additionalRecords: [],
  treatArches: '',
  velocityPerStage: '',
  velocityCustomMm: '',
  caseComplexity: '',
  wearSchedule: '',
  trimlineHeight: '',
  retainerRequired: null,
  plannedTreatmentDuration: '',
};

export interface ClinicalPreferences {
  doNotMoveTeeth: string[];
  avoidEngagersTeeth: string[];
  extractionTeeth: string[];
  leaveSpacesOpenTeeth: string[];
}

export const EMPTY_CLINICAL_PREFERENCES: ClinicalPreferences = {
  doNotMoveTeeth: [],
  avoidEngagersTeeth: [],
  extractionTeeth: [],
  leaveSpacesOpenTeeth: [],
};

export interface OcclusionGoals {
  upperMidlineMm: number | null;
  upperMidlineObjective: string;
  lowerMidlineMm: number | null;
  lowerMidlineObjective: string;
  overjetMm: number | null;
  overjetObjective: string;
  overbitePercent: number | null;
  overbiteObjective: string;
  canineRelationship: string;
  molarRelationship: string;
  anteriorCrossbite: string;
  posteriorCrossbite: string;
  deciduousTeeth: string;
  iprAllowed: boolean | null;
  engagersAllowed: boolean | null;
  spaceManagement: string;
  clinicalInstructions: string;
}

export const EMPTY_OCCLUSION_GOALS: OcclusionGoals = {
  upperMidlineMm: null,
  upperMidlineObjective: '',
  lowerMidlineMm: null,
  lowerMidlineObjective: '',
  overjetMm: null,
  overjetObjective: '',
  overbitePercent: null,
  overbiteObjective: '',
  canineRelationship: '',
  molarRelationship: '',
  anteriorCrossbite: '',
  posteriorCrossbite: '',
  deciduousTeeth: '',
  iprAllowed: null,
  engagersAllowed: null,
  spaceManagement: '',
  clinicalInstructions: '',
};

export interface CaseCommercial {
  treatmentApproach: TreatmentApproach | '';
  treatmentSubCategory: string;
  treatmentPlanId: string | null;
  treatmentPlanName: string;
  currency: string;
  unitPrice: number | null;
  discountCode: string;
  discountAmount: number | null;
  finalPayableAmount: number | null;
}

export const EMPTY_CASE_COMMERCIAL: CaseCommercial = {
  treatmentApproach: '',
  treatmentSubCategory: '',
  treatmentPlanId: null,
  treatmentPlanName: '',
  currency: 'USD',
  unitPrice: null,
  discountCode: '',
  discountAmount: null,
  finalPayableAmount: null,
};

export const PAYMENT_STATUSES = {
  NOT_BILLED: 'not_billed',
  PENDING: 'pending',
  PARTIAL: 'partial',
  PAID: 'paid',
  WAIVED: 'waived',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

export const ALL_PAYMENT_STATUSES: PaymentStatus[] = Object.values(PAYMENT_STATUSES);

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PAYMENT_STATUSES.NOT_BILLED]: 'Not billed',
  [PAYMENT_STATUSES.PENDING]: 'Pending',
  [PAYMENT_STATUSES.PARTIAL]: 'Partially paid',
  [PAYMENT_STATUSES.PAID]: 'Paid',
  [PAYMENT_STATUSES.WAIVED]: 'Waived',
};

export interface CasePaymentOverview {
  status: PaymentStatus;
  currency: string;
  amountDue: number | null;
  amountPaid: number | null;
  invoiceNumber: string;
  notes: string;
  updatedAt: string | null;
}

export const DEFAULT_PAYMENT_OVERVIEW: Omit<CasePaymentOverview, 'updatedAt'> & {
  updatedAt: string | null;
} = {
  status: PAYMENT_STATUSES.NOT_BILLED,
  currency: 'USD',
  amountDue: null,
  amountPaid: null,
  invoiceNumber: '',
  notes: '',
  updatedAt: null,
};

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (ALL_PAYMENT_STATUSES as string[]).includes(value);
}

export type FieldErrors = Record<string, string>;

export interface DigitalAlignerPart1Input {
  patientName?: string;
  practiceName?: string | null;
  clinicName?: string | null;
  chiefComplaint?: string | null;
  patientDateOfBirth?: string | null;
  caseCategory?: string | null;
  caseType?: string | null;
  doctorId?: string | null;
  needsDoctorPicker?: boolean;
  recordsNumbering?: Partial<RecordsNumbering> | null;
}

export interface DigitalAlignerPart3Input {
  occlusionGoals?: Partial<OcclusionGoals> | null;
  commercial?: Partial<CaseCommercial> | null;
}

function practiceNameOf(input: DigitalAlignerPart1Input): string {
  return (input.practiceName || input.clinicName || '').trim();
}

/** URD Part 1 mandatory field validation. Part 2 is optional. */
export function validateDigitalAlignerPart1(input: DigitalAlignerPart1Input): FieldErrors {
  const errors: FieldErrors = {};
  const records = { ...EMPTY_RECORDS_NUMBERING, ...(input.recordsNumbering ?? {}) };

  if (!input.patientName?.trim()) errors.patientName = 'Patient name is required';
  if (!practiceNameOf(input)) errors.practiceName = 'Practice name is required';
  if (!input.chiefComplaint?.trim()) errors.chiefComplaint = 'Chief complaint is required';
  if (!input.caseCategory) errors.caseCategory = 'Select a case category';
  if (!input.caseType) errors.caseType = 'Select a case type';
  if (input.needsDoctorPicker && !input.doctorId) {
    errors.doctorId = 'Select the treating doctor';
  }

  if (input.patientDateOfBirth) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.patientDateOfBirth.trim())) {
      errors.patientDateOfBirth = 'Date of birth must be YYYY-MM-DD';
    }
  }

  if (!records.impressionMethod) {
    errors['recordsNumbering.impressionMethod'] = 'Impression method is required';
  }
  if (!records.treatArches) {
    errors['recordsNumbering.treatArches'] = 'Treat arches is required';
  }
  if (!records.velocityPerStage) {
    errors['recordsNumbering.velocityPerStage'] = 'Velocity per stage is required';
  } else if (
    records.velocityPerStage === VELOCITY_PER_STAGE.OTHER &&
    !records.velocityCustomMm.trim()
  ) {
    errors['recordsNumbering.velocityCustomMm'] = 'Enter custom velocity in mm';
  }
  if (records.retainerRequired === null || records.retainerRequired === undefined) {
    errors['recordsNumbering.retainerRequired'] = 'Retainer required is mandatory';
  }

  return errors;
}

/** Part 2 tooth prefs are optional unless admin configuration requires them. */
export function validateDigitalAlignerPart2(
  _clinical?: Partial<ClinicalPreferences> | null,
): FieldErrors {
  return {};
}

/** Part 3 commercial gate for Digital Aligner final submission. */
export function validateDigitalAlignerPart3(input: DigitalAlignerPart3Input): FieldErrors {
  const errors: FieldErrors = {};
  const commercial = { ...EMPTY_CASE_COMMERCIAL, ...(input.commercial ?? {}) };

  if (!commercial.treatmentApproach) {
    errors['commercial.treatmentApproach'] = 'Treatment approach is required';
  }
  if (!commercial.treatmentSubCategory) {
    errors['commercial.treatmentSubCategory'] = 'Treatment sub-category is required';
  }
  if (!commercial.treatmentPlanId) {
    errors['commercial.treatmentPlanId'] = 'Select a treatment plan';
  }

  return errors;
}

export function firstFieldError(errors: FieldErrors): string | null {
  const keys = Object.keys(errors);
  if (keys.length === 0) return null;
  return errors[keys[0]!] ?? null;
}

export interface UpdateCasePaymentInput {
  status?: PaymentStatus;
  currency?: string;
  amountDue?: number | null;
  amountPaid?: number | null;
  invoiceNumber?: string;
  notes?: string;
}

export interface TreatmentPlanDto {
  id: string;
  name: string;
  caseCategory: import('./caseTaxonomy').CaseCategory | null;
  description: string;
  price: number;
  currency: string;
  estimatedDeliveryHours: number | null;
  isActive: boolean;
  isDefault: boolean;
  isFreeDemo: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountCodeDto {
  id: string;
  code: string;
  description: string;
  percentOff: number | null;
  amountOff: number | null;
  currency: string;
  customerUserId: string | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  maxUses: number | null;
  usageCount: number;
  applicableCaseCategories: import('./caseTaxonomy').CaseCategory[];
  applicablePlanIds: string[];
  createdAt: string;
  updatedAt: string;
}
