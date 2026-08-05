import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IDoctorCounter extends Document {
  key: string;
  seq: number;
}

const doctorCounterSchema = new Schema<IDoctorCounter>({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 },
});

export const DoctorCounter: Model<IDoctorCounter> =
  mongoose.models.DoctorCounter ??
  mongoose.model<IDoctorCounter>('DoctorCounter', doctorCounterSchema);

/** Generates IDs like DR-00000001 */
export async function generateDoctorId(): Promise<string> {
  const counter = await DoctorCounter.findOneAndUpdate(
    { key: 'doctor' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const seq = String(counter.seq).padStart(8, '0');
  return `DR-${seq}`;
}
