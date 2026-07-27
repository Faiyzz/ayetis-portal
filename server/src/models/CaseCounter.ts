import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface ICaseCounter extends Document {
  key: string;
  seq: number;
}

const caseCounterSchema = new Schema<ICaseCounter>({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 },
});

export const CaseCounter: Model<ICaseCounter> =
  mongoose.models.CaseCounter ?? mongoose.model<ICaseCounter>('CaseCounter', caseCounterSchema);

/** Generates IDs like AYT-20260727-0001 */
export async function generateCaseId(): Promise<string> {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const key = `${yyyy}${mm}${dd}`;

  const counter = await CaseCounter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const seq = String(counter.seq).padStart(4, '0');
  return `AYT-${key}-${seq}`;
}
