import {
  ALL_FACILITY_STATUSES,
  FACILITY_STATUSES,
  type FacilityStatus,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IFacility extends Document {
  organizationId: Types.ObjectId;
  corporateCustomerId: string;
  name: string;
  country: string;
  state: string;
  city: string;
  address: string;
  timezone: string;
  contactPhone: string;
  contactEmail: string;
  status: FacilityStatus;
  createdAt: Date;
  updatedAt: Date;
}

const facilitySchema = new Schema<IFacility>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    corporateCustomerId: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    country: { type: String, default: '', trim: true, index: true },
    state: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    timezone: { type: String, default: 'UTC', trim: true },
    contactPhone: { type: String, default: '', trim: true },
    contactEmail: { type: String, default: '', trim: true, lowercase: true },
    status: {
      type: String,
      enum: ALL_FACILITY_STATUSES,
      default: FACILITY_STATUSES.ACTIVE,
      index: true,
    },
  },
  { timestamps: true },
);

facilitySchema.index({ organizationId: 1, name: 1 });

export const Facility: Model<IFacility> =
  mongoose.models.Facility ?? mongoose.model<IFacility>('Facility', facilitySchema);
