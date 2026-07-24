import {
  ALL_PERMISSIONS,
  ALL_ROLES,
  ROLES,
  getPermissionsForRole,
  resolveEffectivePermissions,
  type Permission,
  type Role,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IRolePermissionConfig extends Document {
  role: Role;
  grants: Permission[];
  denies: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

const rolePermissionConfigSchema = new Schema<IRolePermissionConfig>(
  {
    role: {
      type: String,
      enum: ALL_ROLES,
      required: true,
      unique: true,
      index: true,
    },
    grants: {
      type: [String],
      enum: ALL_PERMISSIONS,
      default: [],
    },
    denies: {
      type: [String],
      enum: ALL_PERMISSIONS,
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export const RolePermissionConfig: Model<IRolePermissionConfig> =
  mongoose.models.RolePermissionConfig ??
  mongoose.model<IRolePermissionConfig>('RolePermissionConfig', rolePermissionConfigSchema);

export function isRoleLocked(role: Role): boolean {
  return role === ROLES.ADMIN;
}

export function toRoleOverride(config?: Pick<IRolePermissionConfig, 'grants' | 'denies'> | null) {
  return {
    grants: config?.grants ?? [],
    denies: config?.denies ?? [],
  };
}

export function buildRolePermissionDto(
  role: Role,
  config?: Pick<IRolePermissionConfig, 'grants' | 'denies'> | null,
) {
  const overrides = toRoleOverride(config);
  const locked = isRoleLocked(role);

  return {
    role,
    grants: locked ? [] : overrides.grants,
    denies: locked ? [] : overrides.denies,
    defaults: [...getPermissionsForRole(role)],
    effective: resolveEffectivePermissions({
      role,
      roleOverrides: locked ? undefined : overrides,
    }),
    locked,
  };
}
