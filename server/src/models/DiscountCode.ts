import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IDiscountCode extends Document {
  code: string;
  description: string;
  percentOff?: number;
  amountOff?: number;
  currency: string;
  customerUserId?: Types.ObjectId;
  validFrom?: Date;
  validUntil?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const discountCodeSchema = new Schema<IDiscountCode>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    percentOff: { type: Number, min: 0, max: 100 },
    amountOff: { type: Number, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true },
    customerUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    validFrom: { type: Date },
    validUntil: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const DiscountCode: Model<IDiscountCode> =
  mongoose.models.DiscountCode ??
  mongoose.model<IDiscountCode>('DiscountCode', discountCodeSchema);
