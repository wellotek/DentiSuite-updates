import { z } from 'zod';
import {
  MemoryObjectStorage,
  R2ObjectStorage,
  type ObjectStorage,
} from '../media/storage.js';

const nodeEnvSchema = z.enum(['development', 'test', 'production']);

const envSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  /** Bind address: 127.0.0.1 (dev default) or 0.0.0.0 (public hosts / Railway). */
  HOST: z.string().min(1).default('127.0.0.1'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
      'DATABASE_URL must be a PostgreSQL connection string',
    ),
  DIRECT_URL: z
    .string()
    .min(1)
    .refine(
      (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
      'DIRECT_URL must be a PostgreSQL connection string',
    )
    .optional(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .optional(),
  /** Opaque session lifetime in seconds (default 30 days). */
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  /** Minimum password length. */
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).max(128).default(10),
  /** In-memory auth rate-limit window (ms). */
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  /** Max auth attempts per IP+route within the window. */
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  /**
   * When true, rate-limit keys use X-Forwarded-For / X-Real-Ip.
   * Enable only behind a trusted reverse proxy (Railway, nginx).
   */
  TRUST_PROXY: z.enum(['true', 'false']).optional(),
  /**
   * When false, POST /organization is rejected (commercial path = bootstrap + license).
   * Defaults: allowed in development/test; blocked in production.
   */
  ALLOW_OPEN_ORG_CREATE: z.enum(['true', 'false']).optional(),
  /** Object storage: memory (default) or r2 (Cloudflare R2). */
  OBJECT_STORAGE_PROVIDER: z.enum(['memory', 'r2']).default('memory'),
  /** Signed upload/download URL TTL in seconds. */
  MEDIA_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
});

export type AppConfig = {
  nodeEnv: z.infer<typeof nodeEnvSchema>;
  port: number;
  host: string;
  databaseUrl: string;
  directUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  isProduction: boolean;
  product: 'DentiSuite';
  version: string;
  sessionTtlSeconds: number;
  passwordMinLength: number;
  authRateLimitWindowMs: number;
  authRateLimitMax: number;
  trustProxy: boolean;
  allowOpenOrgCreate: boolean;
  objectStorageProvider: 'memory' | 'r2';
  mediaSignedUrlTtlSeconds: number;
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    endpoint?: string;
  } | null;
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Load and validate process environment for the API.
 * Never logs secret values.
 */
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const parsed = envSchema.safeParse({
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    HOST: env.HOST ?? (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
    DATABASE_URL: env.DATABASE_URL,
    DIRECT_URL: env.DIRECT_URL ?? env.DATABASE_URL,
    LOG_LEVEL: env.LOG_LEVEL,
    SESSION_TTL_SECONDS: env.SESSION_TTL_SECONDS,
    PASSWORD_MIN_LENGTH: env.PASSWORD_MIN_LENGTH,
    AUTH_RATE_LIMIT_WINDOW_MS: env.AUTH_RATE_LIMIT_WINDOW_MS,
    AUTH_RATE_LIMIT_MAX: env.AUTH_RATE_LIMIT_MAX,
    TRUST_PROXY: env.TRUST_PROXY,
    ALLOW_OPEN_ORG_CREATE: env.ALLOW_OPEN_ORG_CREATE,
    OBJECT_STORAGE_PROVIDER: env.OBJECT_STORAGE_PROVIDER,
    MEDIA_SIGNED_URL_TTL_SECONDS: env.MEDIA_SIGNED_URL_TTL_SECONDS,
    R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: env.R2_BUCKET,
    R2_ENDPOINT: env.R2_ENDPOINT,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new ConfigError(`Invalid API configuration: ${details}`);
  }

  const data = parsed.data;
  const logLevel =
    data.LOG_LEVEL ??
    (data.NODE_ENV === 'production'
      ? 'info'
      : data.NODE_ENV === 'test'
        ? 'silent'
        : 'debug');

  let r2: AppConfig['r2'] = null;
  if (data.OBJECT_STORAGE_PROVIDER === 'r2') {
    if (
      !data.R2_ACCOUNT_ID ||
      !data.R2_ACCESS_KEY_ID ||
      !data.R2_SECRET_ACCESS_KEY ||
      !data.R2_BUCKET
    ) {
      throw new ConfigError(
        'Invalid API configuration: R2 provider requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET',
      );
    }
    r2 = {
      accountId: data.R2_ACCOUNT_ID,
      accessKeyId: data.R2_ACCESS_KEY_ID,
      secretAccessKey: data.R2_SECRET_ACCESS_KEY,
      bucket: data.R2_BUCKET,
      endpoint: data.R2_ENDPOINT,
    };
  }

  const allowOpenOrgCreate =
    data.ALLOW_OPEN_ORG_CREATE === 'true'
      ? true
      : data.ALLOW_OPEN_ORG_CREATE === 'false'
        ? false
        : data.NODE_ENV !== 'production';

  return {
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    host: data.HOST,
    databaseUrl: data.DATABASE_URL,
    directUrl: data.DIRECT_URL ?? data.DATABASE_URL,
    logLevel,
    isProduction: data.NODE_ENV === 'production',
    product: 'DentiSuite',
    version: '3.1.2',
    sessionTtlSeconds: data.SESSION_TTL_SECONDS,
    passwordMinLength: data.PASSWORD_MIN_LENGTH,
    authRateLimitWindowMs: data.AUTH_RATE_LIMIT_WINDOW_MS,
    authRateLimitMax: data.AUTH_RATE_LIMIT_MAX,
    trustProxy: data.TRUST_PROXY === 'true',
    allowOpenOrgCreate,
    objectStorageProvider: data.OBJECT_STORAGE_PROVIDER,
    mediaSignedUrlTtlSeconds: data.MEDIA_SIGNED_URL_TTL_SECONDS,
    r2,
  };
}

export function createObjectStorageFromConfig(config: AppConfig): ObjectStorage {
  if (config.objectStorageProvider === 'r2' && config.r2) {
    return new R2ObjectStorage(config.r2);
  }
  return new MemoryObjectStorage();
}
