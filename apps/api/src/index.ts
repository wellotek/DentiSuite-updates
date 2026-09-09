import { config as loadDotenv } from 'dotenv';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { createPrismaClient, disconnectPrisma } from './lib/prisma.js';
import { seedPermissions } from './permissions/seed.js';

loadDotenv();

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    const message =
      error instanceof ConfigError ? error.message : 'Failed to load configuration';
    // Use stderr only — logger may not be configured yet. Never print env values.
    console.error(`[dentisuite-api] ${message}`);
    process.exit(1);
  }

  // Ensure Prisma sees DIRECT_URL when providers require it for migrations/runtime.
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = config.directUrl;
  }

  const logger = createLogger(config);
  const prisma = createPrismaClient();

  try {
    const seeded = await seedPermissions(prisma);
    logger.info(
      { permissions: seeded.permissions, rolePermissions: seeded.rolePermissions },
      'Permission catalog seeded',
    );
  } catch (error) {
    logger.error(
      {
        err: {
          name: error instanceof Error ? error.name : 'Error',
          message: error instanceof Error ? error.message : String(error),
        },
      },
      'Failed to seed permission catalog',
    );
    await disconnectPrisma(prisma);
    process.exit(1);
  }

  const app = createApp({ config, logger, prisma });

  const server = serve(
    {
      fetch: app.fetch,
      port: config.port,
      hostname: config.host,
    },
    (info) => {
      logger.info(
        {
          port: info.port,
          host: config.host,
          product: config.product,
          phase: 6,
          cloudMode: false,
          migrationApply: 'staging-gated; production-prepared-disabled; pilot-readiness-only',
          auth: true,
          organization: true,
          rbac: true,
          patients: true,
          appointments: true,
          consultations: true,
          treatments: true,
          prescriptions: true,
          dentists: true,
          media: true,
          billing: true,
          stock: true,
          prostheses: true,
        },
        'DentiSuite API listening (Phase 6E pilot readiness; production APPLY disabled; staging APPLY gated)',
      );
    },
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down API');
    server.close();
    await disconnectPrisma(prisma);
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void main();
