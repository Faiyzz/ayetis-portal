export const DEPARTMENT_TYPES = {
  DESIGN: 'design',
  QC: 'qc',
  CONSULTATION: 'consultation',
  COORDINATION: 'coordination',
  GENERAL: 'general',
} as const;

export type DepartmentType = (typeof DEPARTMENT_TYPES)[keyof typeof DEPARTMENT_TYPES];

export const ALL_DEPARTMENT_TYPES: DepartmentType[] = Object.values(DEPARTMENT_TYPES);

export const DEPARTMENT_TYPE_LABELS: Record<DepartmentType, string> = {
  [DEPARTMENT_TYPES.DESIGN]: 'Design',
  [DEPARTMENT_TYPES.QC]: 'Quality Control',
  [DEPARTMENT_TYPES.CONSULTATION]: 'Consultation',
  [DEPARTMENT_TYPES.COORDINATION]: 'Coordination',
  [DEPARTMENT_TYPES.GENERAL]: 'General',
};

export function isDepartmentType(value: string): value is DepartmentType {
  return (ALL_DEPARTMENT_TYPES as string[]).includes(value);
}

export interface DepartmentMemberDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

export interface DepartmentDto {
  id: string;
  name: string;
  code: string;
  type: DepartmentType;
  description: string;
  supervisorId: string | null;
  supervisorName: string | null;
  memberCount: number;
  members: DepartmentMemberDto[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentInput {
  name: string;
  code: string;
  type: DepartmentType;
  description?: string;
  supervisorId?: string | null;
}

export interface UpdateDepartmentInput {
  name?: string;
  code?: string;
  type?: DepartmentType;
  description?: string;
  supervisorId?: string | null;
  isActive?: boolean;
}

export interface TransferDepartmentMemberInput {
  userId: string;
  toDepartmentId: string | null;
}
