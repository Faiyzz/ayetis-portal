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

export const WEAR_SCHEDULES = {
  ONE_WEEK: '1_week',
  TWO_WEEKS: '2_weeks',
  THREE_WEEKS: '3_weeks',
} as const;

export type WearSchedule = (typeof WEAR_SCHEDULES)[keyof typeof WEAR_SCHEDULES];

export const ALL_WEAR_SCHEDULES: WearSchedule[] = Object.values(WEAR_SCHEDULES);

export const TRIMLINE_HEIGHTS = {
  ONE_MM: '1mm',
  TWO_MM: '2mm',
} as const;

export type TrimlineHeight = (typeof TRIMLINE_HEIGHTS)[keyof typeof TRIMLINE_HEIGHTS];

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
  createdAt: string;
  updatedAt: string;
}
