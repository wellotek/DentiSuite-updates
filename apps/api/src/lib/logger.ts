import pino from 'pino';
import type { AppConfig } from '../config/env.js';

export function createLogger(config: Pick<AppConfig, 'logLevel' | 'nodeEnv'>) {
  return pino({
    level: config.logLevel,
    base: {
      service: 'dentisuite-api',
      env: config.nodeEnv,
    },
    // Never serialize passwords / tokens / connection strings.
    redact: {
      paths: [
        'DATABASE_URL',
        'DIRECT_URL',
        'password',
        'authorization',
        'headers.authorization',
        'req.headers.authorization',
        'token',
        'accessToken',
        'refreshToken',
      ],
      remove: true,
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
