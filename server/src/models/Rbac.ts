import {
  ALL_ASSIGNMENT_QUEUES,
  ALL_EXPERIENCE_LEVELS,
  ALL_PERMISSIONS,
  ALL_PORTAL_TEMPLATES,
  ALL_QC_SCOPES,
  type AssignmentQueue,
  type ExperienceLevel,
  type Permission,
  type PortalTemplate,
  type QcScope,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IRoleDefinition extends Document {
  key: string;
  name: string;
  description?: string;
  portalTemplate: PortalTemplate;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  isDisabled: boolean;
  qcScope: QcScope;
  permissionGrants: Permission[];
  permissionDenies: Permission[];
  clonedFromKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const roleDefinitionSchema = new Schema<IRoleDefinition>(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    portalTemplate: {
      type: String,
      enum: ALL_PORTAL_TEMPLATES,
      required: true,
    },
    sortOrder: { type: Number, default: 0, index: true },
    isSystem: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isDisabled: { type: Boolean, default: false, index: true },
    qcScope: {
      type: String,
      enum: ALL_QC_SCOPES,
      default: 'none',
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
    clonedFromKey: { type: String, trim: true },
  },
  { timestamps: true },
);

export const RoleDefinition: Model<IRoleDefinition> =
  mongoose.models.RoleDefinition ??
  mongoose.model<IRoleDefinition>('RoleDefinition', roleDefinitionSchema);

export interface ITeam extends Document {
  name: string;
  code?: string;
  supervisorIds: Types.ObjectId[];
  memberIds: Types.ObjectId[];
  regionIds: Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true, index: true },
    code: { type: String, trim: true, sparse: true, index: true },
    supervisorIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    memberIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    regionIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Region' }], default: [] },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const Team: Model<ITeam> =
  mongoose.models.Team ?? mongoose.model<ITeam>('Team', teamSchema);

export interface IAssignmentRule extends Document {
  name: string;
  isActive: boolean;
  priority: number;
  targetQueue: AssignmentQueue;
  roleKeys: string[];
  teamIds: Types.ObjectId[];
  regionIds: Types.ObjectId[];
  countryIds: Types.ObjectId[];
  excludedCountryIds: Types.ObjectId[];
  experienceLevels: ExperienceLevel[];
  softwareKeys: string[];
  requireAvailable: boolean;
  maxOpenCases: number | null;
  weight: number;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentRuleSchema = new Schema<IAssignmentRule>(
  {
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 0, index: true },
    targetQueue: {
      type: String,
      enum: ALL_ASSIGNMENT_QUEUES,
      required: true,
      index: true,
    },
    roleKeys: { type: [String], default: [] },
    teamIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Team' }], default: [] },
    regionIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Region' }], default: [] },
    countryIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Country' }], default: [] },
    excludedCountryIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Country' }], default: [] },
    experienceLevels: {
      type: [String],
      enum: ALL_EXPERIENCE_LEVELS,
      default: [],
    },
    softwareKeys: { type: [String], default: [] },
    requireAvailable: { type: Boolean, default: true },
    maxOpenCases: { type: Number, default: null, min: 0 },
    weight: { type: Number, default: 1, min: 0 },
  },
  { timestamps: true },
);

export const AssignmentRule: Model<IAssignmentRule> =
  mongoose.models.AssignmentRule ??
  mongoose.model<IAssignmentRule>('AssignmentRule', assignmentRuleSchema);
