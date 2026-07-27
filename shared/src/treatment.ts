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
