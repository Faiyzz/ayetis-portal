import type { Permission } from './permissions';
import type { Role } from './roles';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiFailure {
  success: false;
  message: string;
  errors?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  permissionGrants: Permission[];
  permissionDenies: Permission[];
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: string;
}

export interface AuthPayload {
  user: PublicUser;
  tokens: AuthTokens;
}

export interface RolePermissionConfigDto {
  role: Role;
  grants: Permission[];
  denies: Permission[];
  defaults: Permission[];
  effective: Permission[];
  locked: boolean;
}

export interface ManagedUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  permissionGrants: Permission[];
  permissionDenies: Permission[];
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}
