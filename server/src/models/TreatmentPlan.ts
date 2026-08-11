import {
  ALL_CASE_CATEGORIES,
  type CaseCategory,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface ITreatmentPlan extends Document {
  name: string;
  caseCategory?: CaseCategory;
  description: string;
  price: number;
  currency: string;
  estimatedDeliveryHours?: number;
  isActive: boolean;
  isDefault: boolean;
  isFreeDemo: boolean;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const treatmentPlanSchema = new Schema<ITreatmentPlan>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    caseCategory: { type: String, enum: ALL_CASE_CATEGORIES },
    description: { type: String, default: '', trim: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true },
    estimatedDeliveryHours: { type: Number },
    isActive: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false, index: true },
    isFreeDemo: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
  },
  { timestamps: true },
);

export const TreatmentPlan: Model<ITreatmentPlan> =
  mongoose.models.TreatmentPlan ??
  mongoose.model<ITreatmentPlan>('TreatmentPlan', treatmentPlanSchema);
