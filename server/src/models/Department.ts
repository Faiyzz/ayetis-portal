import {
  ALL_DEPARTMENT_TYPES,
  DEPARTMENT_TYPES,
  type DepartmentType,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IDepartment extends Document {
  name: string;
  code: string;
  type: DepartmentType;
  description: string;
  supervisorId?: Types.ObjectId;
  supervisorName?: string;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedById?: Types.ObjectId;
  deletedByName?: string;
  deleteReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, trim: true, index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: {
      type: String,
      enum: ALL_DEPARTMENT_TYPES,
      default: DEPARTMENT_TYPES.GENERAL,
      index: true,
    },
    description: { type: String, default: '', trim: true },
    supervisorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    supervisorName: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedById: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedByName: { type: String },
    deleteReason: { type: String },
  },
  { timestamps: true },
);

export const Department: Model<IDepartment> =
  mongoose.models.Department ?? mongoose.model<IDepartment>('Department', departmentSchema);
