import { config as loadDotenv } from 'dotenv';
import { loadConfig, ConfigError } from '../src/config/env.js';
import { createPrismaClient, disconnectPrisma } from '../src/lib/prisma.js';
import { seedPermissions } from '../src/permissions/seed.js';

loadDotenv();

async function main(): Promise<void> {
  try {
    loadConfig();
  } catch (error) {
    const message =
      error instanceof ConfigError ? error.message : 'Invalid configuration';
    console.error(`[dentisuite-api] ${message}`);
    process.exit(1);
  }

  if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }

  const prisma = createPrismaClient();
  try {
    const result = await seedPermissions(prisma);
    console.log(
      `[dentisuite-api] Seeded permissions=${result.permissions} rolePermissions=${result.rolePermissions}`,
    );
  } finally {
    await disconnectPrisma(prisma);
  }
}

void main();
