export class ApplyGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApplyGateError';
  }
}

export type ApplyGateInput = {
  migrationMode?: string;
  migrationConfirm?: string;
  migrationEnv?: string;
  nodeEnv?: string;
  r2Bucket?: string | null;
  databaseUrl?: string | null;
};

const PRODUCTION_BUCKET = /(?:^|[._-])prod(?:uction)?(?:[._-]|$)/i;

export function looksLikeStagingBucket(bucket: string | null | undefined): boolean {
  if (!bucket) return false;
  return /staging|stage|test|dev|local/i.test(bucket);
}

export function looksLikeProductionBucket(bucket: string | null | undefined): boolean {
  if (!bucket) return false;
  if (looksLikeStagingBucket(bucket)) return false;
  return PRODUCTION_BUCKET.test(bucket);
}

export function looksLikeProductionDatabase(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('staging') ||
    lower.includes('dentisuite_test')
  ) {
    return false;
  }
  return /(?:^|[/_-])prod(?:uction)?(?:[/_-]|$)/i.test(lower);
}

/**
 * Staging APPLY gates. Production is always rejected.
 */
export function assertApplyGates(input: ApplyGateInput): void {
  if (input.nodeEnv === 'production') {
    throw new ApplyGateError('Migration APPLY is allowed only in STAGING.');
  }
  if (input.migrationMode !== 'APPLY') {
    throw new ApplyGateError('migrate:apply requires MIGRATION_MODE=APPLY');
  }
  if (input.migrationConfirm !== 'YES') {
    throw new ApplyGateError('migrate:apply requires MIGRATION_CONFIRM=YES');
  }
  if (input.migrationEnv !== 'STAGING') {
    throw new ApplyGateError('Migration APPLY is allowed only in STAGING.');
  }
  if (input.r2Bucket && !looksLikeStagingBucket(input.r2Bucket)) {
    throw new ApplyGateError('Migration APPLY refuses production object-storage buckets.');
  }
  if (looksLikeProductionDatabase(input.databaseUrl)) {
    throw new ApplyGateError('Migration APPLY refuses production database URLs.');
  }
}

/** Target org must already exist and look like a staging/test cabinet. */
export function assertStagingTargetOrganization(org: {
  name: string;
  slug: string;
  status: string;
}): void {
  if (org.status !== 'ACTIVE') {
    throw new ApplyGateError('Target organization is not ACTIVE.');
  }
  const label = `${org.name} ${org.slug}`;
  if (!/staging|test|fixture/i.test(label)) {
    throw new ApplyGateError('Target organization is not appropriate for staging.');
  }
}

export function gatesFromEnv(env: NodeJS.ProcessEnv): ApplyGateInput {
  return {
    migrationMode: env.MIGRATION_MODE,
    migrationConfirm: env.MIGRATION_CONFIRM,
    migrationEnv: env.MIGRATION_ENV,
    nodeEnv: env.NODE_ENV,
    r2Bucket: env.R2_BUCKET,
    databaseUrl: env.DATABASE_URL,
  };
}

/** Dry-run path must never write. */
export function refuseApply(reason?: string): never {
  throw new Error(
    reason ??
      'APPLY is not available on the dry-run path. Use migrate:apply with MIGRATION_MODE=APPLY, MIGRATION_CONFIRM=YES, MIGRATION_ENV=STAGING.',
  );
}

export function assertDryRunOnly(dryRun: boolean): void {
  if (!dryRun) {
    refuseApply('dryRun=false is rejected on the dry-run path. Use migrate:apply.');
  }
}
