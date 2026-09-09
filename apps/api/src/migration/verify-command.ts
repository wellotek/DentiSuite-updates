import type { PrismaClient } from '@prisma/client';
import type { ObjectStorage } from '../media/storage.js';
import type { MigrationConfig } from './config.js';
import { ApplyGateError } from './apply-gate.js';
import { runDryRun } from './dry-run.js';
import { VERIFY_ALLOWED_STATUSES } from './status.js';
import { verifyStagingApply, type VerificationResult } from './verify.js';

export async function runMigrationVerify(opts: {
  prisma: PrismaClient;
  storage: ObjectStorage;
  config: MigrationConfig;
  /** Staging only. Production verify is read-only. */
  persistStatus?: boolean;
}): Promise<{ verification: VerificationResult; status: string }> {
  const organizationId = opts.config.targetOrganizationId;
  const row = await opts.prisma.organizationMigration.findUnique({
    where: { organizationId },
  });
  if (!row || !(VERIFY_ALLOWED_STATUSES as string[]).includes(row.status)) {
    throw new ApplyGateError(
      'migrate:verify requires migration state MIGRATED, VERIFYING, or VERIFIED.',
    );
  }

  const dry = runDryRun({ ...opts.config, dryRun: true });
  if (opts.persistStatus) {
    await opts.prisma.organizationMigration.update({
      where: { id: row.id },
      data: { status: 'VERIFYING', updatedAt: new Date() },
    });
  }
  const verification = await verifyStagingApply(
    opts.prisma,
    organizationId,
    dry.planned,
    opts.storage,
  );
  if (opts.persistStatus) {
    await opts.prisma.organizationMigration.update({
      where: { id: row.id },
      data: verification.ok
        ? { status: 'VERIFIED', lastVerifiedAt: new Date(), updatedAt: new Date() }
        : { status: 'FAILED', lastFailedAt: new Date(), updatedAt: new Date() },
    });
  }
  const latest = await opts.prisma.organizationMigration.findUnique({
    where: { organizationId },
  });
  return { verification, status: latest?.status ?? row.status };
}
