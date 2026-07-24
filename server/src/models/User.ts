import {
  ALL_PERMISSIONS,
  ALL_ROLES,
  type Permission,
  type Role,
  resolveEffectivePermissions,
} from '@ayetis/shared';
import bcrypt from 'bcryptjs';
import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  permissionGrants: Permission[];
  permissionDenies: Permission[];
  passwordResetToken?: string;
  passwordResetExpires?: Date;
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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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
  },
  {
    timestamps: true,
  },
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    next();
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
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
