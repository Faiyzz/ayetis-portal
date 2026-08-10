import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  ALL_ACCOUNT_STATUSES,
  ALL_ACCOUNT_TYPES,
  ALL_PERMISSIONS,
  ALL_ROLES,
  type AccountStatus,
  type AccountType,
  type Permission,
  type Role,
  resolveEffectivePermissions,
} from '@ayetis/shared';
import bcrypt from 'bcryptjs';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  accountType: AccountType;
  accountStatus: AccountStatus;
  doctorId?: string;
  clinicName?: string;
  companyName?: string;
  companyAddress?: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  organizationId?: Types.ObjectId;
  corporateCustomerId?: string;
  facilityId?: Types.ObjectId;
  employeeId?: string;
  subAccountId?: string;
  assignedCountry?: string;
  mobile?: string;
  emailVerifiedAt?: Date;
  subAccountVerificationTokenHash?: string;
  subAccountVerificationExpires?: Date;
  /** Pending email verification for sub-accounts */
  pendingEmailVerification?: boolean;
  /** @deprecated Prefer accountStatus — kept in sync for compatibility */
  isActive: boolean;
  departmentId?: Types.ObjectId;
  departmentName?: string;
  permissionGrants: Permission[];
  permissionDenies: Permission[];
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  passwordHistory: string[];
  passwordChangedAt?: Date;
  mustChangePassword: boolean;
  /** SLA business hours for this doctor's cases (default 48). */
  slaBusinessHours: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      required: true,
      index: true,
    },
    accountType: {
      type: String,
      enum: ALL_ACCOUNT_TYPES,
      default: ACCOUNT_TYPES.INDIVIDUAL,
      index: true,
    },
    accountStatus: {
      type: String,
      enum: ALL_ACCOUNT_STATUSES,
      default: ACCOUNT_STATUSES.ACTIVE,
      index: true,
    },
    doctorId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    clinicName: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    companyAddress: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: '' },
      postalCode: { type: String, trim: true, default: '' },
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    corporateCustomerId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    facilityId: {
      type: Schema.Types.ObjectId,
      ref: 'Facility',
      index: true,
    },
    employeeId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    subAccountId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    assignedCountry: {
      type: String,
      trim: true,
    },
    mobile: {
      type: String,
      trim: true,
    },
    emailVerifiedAt: { type: Date },
    subAccountVerificationTokenHash: { type: String, select: false },
    subAccountVerificationExpires: { type: Date, select: false },
    pendingEmailVerification: { type: Boolean, default: false, index: true },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
    },
    departmentName: {
      type: String,
      trim: true,
    },
    permissionGrants: {
      type: [String],
      enum: ALL_PERMISSIONS,
      default: [],
    },
    permissionDenies: {
      type: [String],
      enum: ALL_PERMISSIONS,
      default: [],
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    passwordHistory: {
      type: [String],
      default: [],
      select: false,
    },
    passwordChangedAt: {
      type: Date,
      default: Date.now,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    slaBusinessHours: {
      type: Number,
      default: 48,
      min: 1,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre('save', async function syncStatusAndHash(next) {
  if (this.isModified('accountStatus')) {
    this.isActive = this.accountStatus === ACCOUNT_STATUSES.ACTIVE;
  } else if (this.isModified('isActive') && !this.isModified('accountStatus')) {
    this.accountStatus = this.isActive
      ? ACCOUNT_STATUSES.ACTIVE
      : ACCOUNT_STATUSES.BLOCKED;
  }

  if (!this.isModified('password')) {
    next();
    return;
  }

  // Skip re-hash when password is already a bcrypt hash (e.g. copied from RegistrationRequest).
  if (typeof this.password === 'string' && /^\$2[aby]\$/.test(this.password)) {
    this.passwordChangedAt = new Date();
    next();
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date();
  next();
});

userSchema.methods.comparePassword = function comparePassword(
  candidate: string,
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>('User', userSchema);

export function getUserOverrides(user: Pick<IUser, 'permissionGrants' | 'permissionDenies'>) {
  return {
    grants: user.permissionGrants ?? [],
    denies: user.permissionDenies ?? [],
  };
}

export function resolveUserPermissions(
  user: Pick<IUser, 'role' | 'permissionGrants' | 'permissionDenies'>,
  roleOverrides?: { grants: Permission[]; denies: Permission[] },
): Permission[] {
  return resolveEffectivePermissions({
    role: user.role,
    roleOverrides,
    userOverrides: getUserOverrides(user),
  });
}
