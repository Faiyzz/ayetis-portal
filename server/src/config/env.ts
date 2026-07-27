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
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 500 * 1024 * 1024),
  /** Days after passwordChangedAt before login requires a change. 0 disables expiry. */
  passwordExpiryDays: Number(process.env.PASSWORD_EXPIRY_DAYS ?? 90),
  /** Seconds a signed file download URL remains valid. */
  signedUrlTtlSeconds: Number(process.env.SIGNED_URL_TTL_SECONDS ?? 300),
};
