import type { PrismaClient } from '@prisma/client';
import type { MigrationConfig } from './config.js';
import { ApplyGateError } from './apply-gate.js';
import { allowlistsFromEnv, assertProductionAllowlists, expectedMediaPrefix } from './allowlist.js';
import {
  PRODUCTION_APPLY_EXECUTION_ENABLED,
  assertProductionExecutionDisabled,
  assertProductionGates,
  productionGatesFromEnv,
} from './production-gate.js';
import { assertBackupEvidenceMatchesSource, loadBackupEvidence } from './backup-evidence.js';
import { runDryRun } from './dry-run.js';
import { hashFile, mediaManifest } from './hash.js';
import { classifyOperatorReview } from './signoff.js';
import { OPEN_PRODUCT_DECISIONS } from './open-decisions.js';
import type { ProductionPreflightReport } from './production-report.js';
import { isLiveAppDataStorePath } from './source-paths.js';

export type ProductionPreflightDeps = {
  /** Isolated/test Prisma only. Omit to avoid opening a production DATABASE_URL. */
  prisma?: PrismaClient;
  env: NodeJS.ProcessEnv;
  backupEvidencePath: string;
  requireLicenseBinding?: boolean;
};

const ZERO_INSERTED: Record<string, number> = {
  dentist: 0,
  patient: 0,
  appointment: 0,
  clinicalSession: 0,
  treatment: 0,
  prescription: 0,
  prescriptionItem: 0,
  invoice: 0,
  stockItem: 0,
  prosthesis: 0,
  patientMedia: 0,
};

function plannedCounts(dry: ReturnType<typeof runDryRun>): Record<string, number> {
  return {
    dentist: dry.planned.dentists.length,
    patient: dry.planned.patients.length,
    appointment: dry.planned.appointments.length,
    clinicalSession: dry.planned.sessions.length,
    treatment: dry.planned.treatments.length,
    prescription: dry.planned.prescriptions.length,
    prescriptionItem: dry.planned.prescriptions.reduce((n, rx) => n + rx.lines.length, 0),
    invoice: dry.planned.invoices.length,
    stockItem: dry.planned.stock.length,
    prosthesis: dry.planned.prostheses.length,
    patientMedia: dry.planned.media.length,
  };
}

/**
 * Read-only production preflight. Never writes clinical rows or objects.
 * Callers must still refuse execution (PRODUCTION_APPLY_EXECUTION_ENABLED=false).
 */
export async function runProductionPreflight(
  config: MigrationConfig,
  deps: ProductionPreflightDeps,
): Promise<ProductionPreflightReport> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const gates = productionGatesFromEnv(deps.env);
  if (!gates.targetOrganizationId) {
    gates.targetOrganizationId = config.targetOrganizationId;
  }
  assertProductionGates(gates);
  if (gates.targetOrganizationId !== config.targetOrganizationId) {
    throw new ApplyGateError('TARGET_ORGANIZATION_ID must match --organization-id.');
  }

  const allowlists = allowlistsFromEnv(deps.env);
  allowlists.targetOrganizationId = config.targetOrganizationId;
  assertProductionAllowlists(allowlists);

  if (isLiveAppDataStorePath(config.sourceJsonPath)) {
    throw new ApplyGateError(
      'Production APPLY refuses the live AppData store. Use an explicit backup/copy directory.',
    );
  }
  const configuredProvider = deps.env.OBJECT_STORAGE_PROVIDER;
  if (configuredProvider && configuredProvider !== allowlists.storageProvider) {
    throw new ApplyGateError(
      'Production APPLY refuses: OBJECT_STORAGE_PROVIDER does not match MIGRATION_STORAGE_PROVIDER.',
    );
  }

  const evidence = loadBackupEvidence(deps.backupEvidencePath);
  assertBackupEvidenceMatchesSource(evidence, config.sourceJsonPath, config.sourceMediaRoot);

  let organizationChecked = false;
  if (deps.prisma) {
    organizationChecked = true;
    const org = await deps.prisma.organization.findUnique({
      where: { id: config.targetOrganizationId },
      include: { licenseBinding: true, migration: true },
    });
    if (!org) {
      throw new ApplyGateError(
        'Target organization does not exist. APPLY does not create Organization/User/Membership.',
      );
    }
    if (org.status !== 'ACTIVE') {
      throw new ApplyGateError('Target organization is not ACTIVE.');
    }
    if (org.migration && (org.migration.status === 'MIGRATED' || org.migration.status === 'VERIFIED')) {
      throw new ApplyGateError('Organization already migrated. Production APPLY refuses a completed migration.');
    }

    const requireLicense =
      deps.requireLicenseBinding === true || deps.env.MIGRATION_REQUIRE_LICENSE_BINDING === 'YES';
    if (requireLicense) {
      if (!org.licenseBinding || org.licenseBinding.status !== 'ACTIVE') {
        throw new ApplyGateError('Production APPLY refuses: expected ACTIVE license binding is missing.');
      }
    }
  }

  const dryRun = runDryRun({ ...config, dryRun: true });
  if (!dryRun.report.ok || dryRun.report.errors.length > 0) {
    throw new ApplyGateError('Refusing production APPLY: dry-run has blocking errors.');
  }
  const mediaPrefix = expectedMediaPrefix(config.targetOrganizationId);
  for (const row of dryRun.planned.media) {
    if (!row.storageKey.startsWith(mediaPrefix) || !row.storageKey.includes('/media/')) {
      throw new ApplyGateError('Production APPLY refuses: planned media key is outside the allowed organization prefix.');
    }
  }

  const jsonHash = hashFile(config.sourceJsonPath);
  const manifest = mediaManifest(config.sourceMediaRoot);
  const report: ProductionPreflightReport = {
    metadata: {
      mode: 'PRODUCTION_PREFLIGHT',
      environment: 'PRODUCTION',
      executionEnabled: PRODUCTION_APPLY_EXECUTION_ENABLED,
      targetOrganizationId: config.targetOrganizationId,
      databaseIdentity: allowlists.databaseIdentity!,
      storageIdentity: allowlists.storageIdentity!,
      storageProvider: allowlists.storageProvider!,
      expectedMediaPrefix: expectedMediaPrefix(config.targetOrganizationId),
      sourceJsonHash: jsonHash,
      mediaManifestHash: manifest.hash,
      mediaFileCount: manifest.count,
      backupTimestamp: evidence.backupTimestamp,
      intendedState: 'READY_FOR_APPROVAL',
      migrationState: organizationChecked ? 'READY_FOR_APPROVAL' : 'NOT_STARTED',
      organizationChecked,
      startedAt,
      finishedAt: new Date().toISOString(),
    },
    operatorConfirmation: {
      migrationMode: 'APPLY',
      migrationConfirm: true,
      migrationProductionApproval: true,
      migrationEnv: 'PRODUCTION',
    },
    dryRunOk: true,
    sourceCounts: dryRun.report.counts,
    plannedCounts: plannedCounts(dryRun),
    insertedCounts: { ...ZERO_INSERTED },
    skipped: dryRun.report.skipped,
    warnings: dryRun.report.warnings,
    errors,
    mappingStatistics: dryRun.report.mappings,
    mediaStatistics: {
      source: dryRun.report.counts.mediaFiles.source,
      planned: dryRun.planned.media.length,
      missing: dryRun.report.missingMedia.filter((i) => i.code === 'MISSING_MEDIA').length,
    },
    operatorReview: classifyOperatorReview(dryRun),
    openProductDecisions: OPEN_PRODUCT_DECISIONS,
    verification: null,
    ok: true,
  };
  return report;
}

export function refuseProductionApplyExecution(): never {
  assertProductionExecutionDisabled();
}
