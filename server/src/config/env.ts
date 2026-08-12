import path from 'path';
import dotenv from 'dotenv';

// Prefer repo-root .env, then server/.env (later file wins for overlapping keys).
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/ayetis-portal'),
  jwtSecret: required('JWT_SECRET', 'dev-ayetis-jwt-secret-change-in-production-32chars'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@ayetis.com',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'Ayetis Portal <onboarding@resend.dev>',
  isDev: (process.env.NODE_ENV ?? 'development') !== 'production',
  /** local = disk under UPLOADS_DIR; s3 = Railway / S3-compatible private bucket */
  storageProvider: (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase() === 's3' ? 's3' as const : 'local' as const,
  uploadsDir: process.env.UPLOADS_DIR ?? '',
  s3Endpoint: process.env.S3_ENDPOINT ?? process.env.AWS_ENDPOINT_URL ?? '',
  s3Region: process.env.S3_REGION ?? process.env.AWS_REGION ?? 'auto',
  s3Bucket: process.env.S3_BUCKET ?? process.env.AWS_S3_BUCKET ?? '',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? '',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? '',
  s3ForcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true').toLowerCase() !== 'false',
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 300 * 1024 * 1024),
  /** Days after passwordChangedAt before login requires a change. 0 disables expiry. */
  passwordExpiryDays: Number(process.env.PASSWORD_EXPIRY_DAYS ?? 90),
  /** Seconds a signed file download URL remains valid. */
  signedUrlTtlSeconds: Number(process.env.SIGNED_URL_TTL_SECONDS ?? 300),
  /**
   * Cost-minimal cold storage:
   * - Archive unused objects to Glacier Flexible Retrieval (cheap storage).
   * - On access, temporary RestoreObject only — never CopyObject back to STANDARD
   *   (avoids promotion rewrite costs). Hot window = temporary restore days.
   * - Local provider: free rename between uploads/hot and uploads/cold.
   */
  fileHotDays: Math.max(0, Number(process.env.FILE_HOT_DAYS ?? 30)),
  fileColdStorageEnabled: (() => {
    const raw = process.env.FILE_COLD_STORAGE_ENABLED;
    if (raw != null && raw !== '') {
      return raw.toLowerCase() !== 'false' && raw !== '0';
    }
    return true;
  })(),
  /** GLACIER (Flexible) default — cheaper than Instant Retrieval; no per-read fees until restore. */
  fileColdStorageClass: (process.env.FILE_COLD_STORAGE_CLASS ?? 'GLACIER').toUpperCase(),
  /** Bulk = lowest restore cost (slower). Standard/Expedited cost more. */
  fileRestoreTier: (process.env.FILE_RESTORE_TIER ?? 'Bulk') as 'Bulk' | 'Standard' | 'Expedited',
  /** Temporary Glacier restore window; also used as re-hot period after restore completes. */
  fileRestoreDays: Math.max(1, Number(process.env.FILE_RESTORE_DAYS ?? process.env.FILE_HOT_DAYS ?? 30)),
  /** Auto-delete cold objects after this many days (0 = never). Reduces long-term storage cost. */
  fileColdDeleteAfterDays: Math.max(0, Number(process.env.FILE_COLD_DELETE_AFTER_DAYS ?? 365)),
  fileColdStorageCron: process.env.FILE_COLD_STORAGE_CRON ?? '0 * * * *',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
  /** Idle minutes before client logout (0 disables). Overridable via BusinessConfig. */
  sessionIdleTimeoutMinutes: Math.max(0, Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES ?? 30)),
  /** Failed password attempts before temporary lockout. */
  loginMaxFailedAttempts: Math.max(1, Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS ?? 5)),
  /** Minutes the account stays locked after max failures. */
  loginLockoutMinutes: Math.max(1, Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15)),
};
