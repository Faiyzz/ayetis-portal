import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { formatCorporateCustomerId } from '@ayetis/shared';

export interface ICorporateCounter extends Document {
  key: string;
  seq: number;
}

const corporateCounterSchema = new Schema<ICorporateCounter>({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 },
});

export const CorporateCounter: Model<ICorporateCounter> =
  mongoose.models.CorporateCounter ??
  mongoose.model<ICorporateCounter>('CorporateCounter', corporateCounterSchema);

/** Generates IDs like C134789 */
export async function generateCorporateCustomerId(): Promise<string> {
  const counter = await CorporateCounter.findOneAndUpdate(
    { key: 'corporate_customer' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return formatCorporateCustomerId(counter.seq);
}
