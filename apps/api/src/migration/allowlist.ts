import { ApplyGateError } from './apply-gate.js';

export type ProductionAllowlistInput = {
  databaseIdentity?: string;
  allowedDatabaseIdentity?: string;
  storageIdentity?: string;
  allowedStorageIdentity?: string;
  targetOrganizationId?: string;
  allowedOrganizationId?: string;
  storageProvider?: string;
  allowedStorageProvider?: string;
  storageRegion?: string;
  allowedStorageRegion?: string;
  storageAccountIdentity?: string;
  allowedStorageAccountIdentity?: string;
};

const FORBIDDEN_STORAGE_PROVIDERS = new Set(['memory', 'test', 'development', 'dev', 'local', 'filesystem']);

function requireExact(label: string, actual?: string, allowed?: string): void {
  if (!actual || !allowed) {
    throw new ApplyGateError(`Production APPLY refuses: ${label} identity and allowlist are required.`);
  }
  if (actual !== allowed) {
    throw new ApplyGateError(`Production APPLY refuses: ${label} identity does not match allowlist.`);
  }
}

/**
 * Exact identity checks only. Never infer safety from a database hostname.
 * Identities are opaque labels — not connection strings or secrets.
 */
export function assertProductionAllowlists(input: ProductionAllowlistInput): void {
  requireExact('database', input.databaseIdentity, input.allowedDatabaseIdentity);
  requireExact('storage', input.storageIdentity, input.allowedStorageIdentity);
  requireExact('organization', input.targetOrganizationId, input.allowedOrganizationId);
  requireExact('storage provider', input.storageProvider, input.allowedStorageProvider);
  if (
    FORBIDDEN_STORAGE_PROVIDERS.has(input.storageProvider ?? '') ||
    FORBIDDEN_STORAGE_PROVIDERS.has(input.allowedStorageProvider ?? '')
  ) {
    throw new ApplyGateError('Production APPLY refuses memory/test/development object-storage providers.');
  }
  if (input.storageProvider !== 'r2') {
    throw new ApplyGateError('Production APPLY refuses: storage provider must be r2.');
  }
  if (input.allowedStorageRegion) {
    requireExact('storage region', input.storageRegion, input.allowedStorageRegion);
  }
  if (input.allowedStorageAccountIdentity) {
    requireExact('storage account', input.storageAccountIdentity, input.allowedStorageAccountIdentity);
  }
}

export function expectedMediaPrefix(organizationId: string): string {
  return `org/${organizationId}/patients/`;
}

export function allowlistsFromEnv(env: NodeJS.ProcessEnv): ProductionAllowlistInput {
  return {
    databaseIdentity: env.MIGRATION_DATABASE_IDENTITY,
    allowedDatabaseIdentity: env.MIGRATION_ALLOWED_DATABASE_IDENTITY,
    storageIdentity: env.MIGRATION_STORAGE_IDENTITY,
    allowedStorageIdentity: env.MIGRATION_ALLOWED_STORAGE_IDENTITY,
    targetOrganizationId: env.TARGET_ORGANIZATION_ID ?? env.DENTISUITE_MIGRATION_ORGANIZATION_ID,
    allowedOrganizationId: env.MIGRATION_ALLOWED_ORGANIZATION_ID,
    storageProvider: env.MIGRATION_STORAGE_PROVIDER ?? env.OBJECT_STORAGE_PROVIDER,
    allowedStorageProvider: env.MIGRATION_ALLOWED_STORAGE_PROVIDER,
    storageRegion: env.MIGRATION_STORAGE_REGION,
    allowedStorageRegion: env.MIGRATION_ALLOWED_STORAGE_REGION,
    storageAccountIdentity: env.MIGRATION_STORAGE_ACCOUNT_IDENTITY,
    allowedStorageAccountIdentity: env.MIGRATION_ALLOWED_STORAGE_ACCOUNT_IDENTITY,
  };
}
