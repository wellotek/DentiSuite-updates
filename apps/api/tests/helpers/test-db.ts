import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PrismaClient } from '@prisma/client';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import {
  createApp,
  createOrganizationService,
  createPermissionService,
} from '../../src/app.js';
import { loadConfig, type AppConfig } from '../../src/config/env.js';
import { createLogger } from '../../src/lib/logger.js';
import { MemoryObjectStorage } from '../../src/media/storage.js';
import { MemoryRateLimitStore } from '../../src/middleware/rate-limit.js';
import { seedPermissions } from '../../src/permissions/seed.js';
import { hashToken } from '../../src/auth/tokens.js';

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, '..', '..');

let pglite: PGlite | null = null;
let prisma: PrismaClient | null = null;

/** Dummy URL for config validation; PGlite adapter does not use it for queries. */
const TEST_DATABASE_URL =
  'postgresql://dentisuite:dentisuite@127.0.0.1:5432/dentisuite_test';

const MIGRATIONS = [
  '20260302140000_auth_foundation',
  '20260302160000_organization_membership',
  '20260302180000_rbac_permissions',
  '20260302200000_patient',
  '20260302220000_appointment',
  '20260302240000_clinical_session_treatment',
  '20260302260000_prescription',
  '20260302280000_dentist',
  '20260302300000_patient_media',
  '20260302320000_invoice',
  '20260302340000_stock_prosthesis',
  '20260302360000_organization_migration',
  '20260302380000_organization_migration_applying',
  '20260302400000_organization_migration_production_states',
  '20260302420000_organization_contact',
  '20260308120000_user_username_audit_log',
] as const;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function applyMigrations(client: PrismaClient): Promise<void> {
  for (const name of MIGRATIONS) {
    const sql = readFileSync(
      join(apiRoot, 'prisma', 'migrations', name, 'migration.sql'),
      'utf8',
    );
    for (const statement of splitSqlStatements(sql)) {
      await client.$executeRawUnsafe(statement);
    }
  }
}

export async function startTestDatabase(): Promise<{
  prisma: PrismaClient;
  databaseUrl: string;
}> {
  if (prisma) {
    return { prisma, databaseUrl: TEST_DATABASE_URL };
  }

  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.DIRECT_URL = TEST_DATABASE_URL;

  pglite = new PGlite();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPGlite(pglite) as any;
  prisma = new PrismaClient({ adapter });
  await prisma.$connect();
  await applyMigrations(prisma);
  await seedPermissions(prisma);

  return { prisma, databaseUrl: TEST_DATABASE_URL };
}

export async function stopTestDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
  if (pglite) {
    await pglite.close();
    pglite = null;
  }
}

export async function resetAuthTables(client: PrismaClient): Promise<void> {
  await client.auditLog.deleteMany();
  await client.prosthesis.deleteMany();
  await client.stockItem.deleteMany();
  await client.invoice.deleteMany();
  await client.patientMedia.deleteMany();
  await client.prescriptionItem.deleteMany();
  await client.prescription.deleteMany();
  await client.treatment.deleteMany();
  await client.clinicalSession.deleteMany();
  await client.appointment.deleteMany();
  await client.dentist.deleteMany();
  await client.patient.deleteMany();
  await client.membershipPermissionOverride.deleteMany();
  await client.licenseBinding.deleteMany();
  await client.organizationMigration.deleteMany();
  await client.membership.deleteMany();
  await client.organization.deleteMany();
  await client.session.deleteMany();
  await client.device.deleteMany();
  await client.user.deleteMany();
  // Keep Permission / RolePermission catalog (seeded once).
}

export function createTestConfig(
  overrides: Partial<NodeJS.ProcessEnv> = {},
): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    PORT: '3001',
    DATABASE_URL: TEST_DATABASE_URL,
    DIRECT_URL: TEST_DATABASE_URL,
    LOG_LEVEL: 'silent',
    PASSWORD_MIN_LENGTH: '10',
    SESSION_TTL_SECONDS: String(60 * 60 * 24),
    AUTH_RATE_LIMIT_WINDOW_MS: '60000',
    AUTH_RATE_LIMIT_MAX: '100',
    ...overrides,
  });
}

export function createTestApp(
  client: PrismaClient,
  options?: {
    config?: AppConfig;
    rateLimitStore?: MemoryRateLimitStore;
    objectStorage?: MemoryObjectStorage;
  },
) {
  const config = options?.config ?? createTestConfig();
  const logger = createLogger(config);
  const rateLimitStore = options?.rateLimitStore ?? new MemoryRateLimitStore();
  const objectStorage = options?.objectStorage ?? new MemoryObjectStorage();
  return {
    app: createApp({
      config,
      logger,
      prisma: client,
      rateLimitStore,
      objectStorage,
    }),
    config,
    logger,
    rateLimitStore,
    objectStorage,
    organizationService: createOrganizationService(client, logger),
    permissionService: createPermissionService(client, logger),
  };
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function registerLogin(
  app: ReturnType<typeof createApp>,
  email: string,
  password: string,
): Promise<{ token: string; userId: string }> {
  await app.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const login = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await login.json()) as {
    token: string;
    user: { id: string };
  };
  return { token: body.token, userId: body.user.id };
}

export { hashToken };
