import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __dentisuitePrisma: PrismaClient | undefined;
}

/**
 * Single reusable PrismaClient instance.
 * Phase 1: connection foundation only — no business repositories.
 */
export function createPrismaClient(): PrismaClient {
  if (globalThis.__dentisuitePrisma) {
    return globalThis.__dentisuitePrisma;
  }

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__dentisuitePrisma = client;
  }

  return client;
}

export async function disconnectPrisma(client: PrismaClient): Promise<void> {
  await client.$disconnect();
  if (globalThis.__dentisuitePrisma === client) {
    globalThis.__dentisuitePrisma = undefined;
  }
}
