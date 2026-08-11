import { formatInvoiceNumber, formatReceiptNumber } from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IDocumentCounter extends Document {
  key: string;
  seq: number;
}

const documentCounterSchema = new Schema<IDocumentCounter>({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 },
});

export const DocumentCounter: Model<IDocumentCounter> =
  mongoose.models.DocumentCounter ??
  mongoose.model<IDocumentCounter>('DocumentCounter', documentCounterSchema);

async function nextSeq(key: string): Promise<number> {
  const counter = await DocumentCounter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return counter.seq;
}

export async function generateInvoiceNumber(): Promise<string> {
  return formatInvoiceNumber(await nextSeq('invoice'));
}

export async function generateReceiptNumber(): Promise<string> {
  return formatReceiptNumber(await nextSeq('receipt'));
}
