import { z } from 'zod';
import { ACCOUNT_STATUSES } from '@ayetis/shared';

const addressSchema = z.object({
  street: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(40).optional(),
});

export const updateOrganizationSchema = z.object({
  companyName: z.string().trim().min(1).max(200).optional(),
  country: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'suspended', 'inactive']).optional(),
  address: addressSchema.optional(),
});

export const createFacilitySchema = z.object({
  name: z.string().trim().min(1).max(200),
  country: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  address: z.string().trim().max(500).optional(),
  timezone: z.string().trim().max(80).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  contactEmail: z.string().trim().email().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']).optional(),
});

export const updateFacilitySchema = createFacilitySchema.partial();

export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  mobile: z.string().trim().max(40).optional(),
  country: z.string().trim().max(100).optional(),
  facilityId: z.string().trim().min(1),
  role: z.enum(['facility_admin', 'doctor']),
  designation: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
});

export const employeeStatusSchema = z.object({
  accountStatus: z.enum([
    ACCOUNT_STATUSES.ACTIVE,
    ACCOUNT_STATUSES.SUSPENDED,
    ACCOUNT_STATUSES.BLOCKED,
  ]),
});

export const createSubAccountSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  country: z.string().trim().min(1).max(100),
  mobile: z.string().trim().max(40).optional(),
  countryCode: z.string().trim().max(10).optional(),
  practiceName: z.string().trim().max(200).optional(),
  remarks: z.string().trim().max(1000).optional(),
  facilityId: z.string().trim().optional(),
  organizationId: z.string().trim().optional(),
  activateAfterVerify: z.boolean().optional(),
});

export const verifySubAccountSchema = z.object({
  token: z.string().trim().min(10),
});
