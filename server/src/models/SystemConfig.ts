import {
  DEFAULT_SYSTEM_MESSAGES,
  type SystemMessages,
} from '@ayetis/shared';
import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface ISystemConfig extends Document {
  key: string;
  messages: SystemMessages;
  createdAt: Date;
  updatedAt: Date;
}

const systemConfigSchema = new Schema<ISystemConfig>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'default',
    },
    messages: {
      registrationConfirmation: {
        type: String,
        default: DEFAULT_SYSTEM_MESSAGES.registrationConfirmation,
      },
      emailVerifiedPending: {
        type: String,
        default: DEFAULT_SYSTEM_MESSAGES.emailVerifiedPending,
      },
      accountBlocked: {
        type: String,
        default: DEFAULT_SYSTEM_MESSAGES.accountBlocked,
      },
      accountSuspended: {
        type: String,
        default: DEFAULT_SYSTEM_MESSAGES.accountSuspended,
      },
    },
  },
  { timestamps: true },
);

export const SystemConfig: Model<ISystemConfig> =
  mongoose.models.SystemConfig ??
  mongoose.model<ISystemConfig>('SystemConfig', systemConfigSchema);

function toMessages(config: ISystemConfig | null): SystemMessages {
  return {
    registrationConfirmation:
      config?.messages?.registrationConfirmation ??
      DEFAULT_SYSTEM_MESSAGES.registrationConfirmation,
    emailVerifiedPending:
      config?.messages?.emailVerifiedPending ?? DEFAULT_SYSTEM_MESSAGES.emailVerifiedPending,
    accountBlocked:
      config?.messages?.accountBlocked ?? DEFAULT_SYSTEM_MESSAGES.accountBlocked,
    accountSuspended:
      config?.messages?.accountSuspended ?? DEFAULT_SYSTEM_MESSAGES.accountSuspended,
  };
}

export async function getSystemMessages(): Promise<SystemMessages> {
  const config = await SystemConfig.findOneAndUpdate(
    { key: 'default' },
    {
      $setOnInsert: {
        key: 'default',
        messages: DEFAULT_SYSTEM_MESSAGES,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return toMessages(config);
}

export async function updateSystemMessages(
  messages: Partial<SystemMessages>,
): Promise<SystemMessages> {
  const $set: Record<string, string> = {};
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value === 'string') {
      $set[`messages.${key}`] = value;
    }
  }

  const config = await SystemConfig.findOneAndUpdate(
    { key: 'default' },
    {
      $set,
      $setOnInsert: {
        key: 'default',
        messages: DEFAULT_SYSTEM_MESSAGES,
      },
    },
    { upsert: true, new: true },
  );

  return toMessages(config);
}
