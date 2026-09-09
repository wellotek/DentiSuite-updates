import type { PrismaClient } from '@prisma/client';
import { parseMigrationConfig } from './config.js';
import { ApplyGateError } from './apply-gate.js';
import { hashFile, mediaManifest } from './hash.js';
import { runDryRun, type DryRunResult } from './dry-run.js';
import { assertBackupEvidenceMatchesSource, loadBackupEvidence, type BackupEvidence } from './backup-evidence.js';
import { runProductionPreflight } from './production-preflight.js';
import { PRODUCTION_APPLY_EXECUTION_ENABLED } from './production-gate.js';
import { parsePilotIdentity } from './pilot-identity.js';
import { parsePilotPolicies, type PilotPolicyDecision } from './pilot-policies.js';
import { PILOT_CUTOVER_CHECKLIST, PILOT_ROLLBACK_PLAN } from './pilot-cutover.js';
import {
  catalogReport,
  dentistMappingReport,
  emptyPhoneReport,
  mediaPilotReport,
  moneyReport,
  settingsReport,
  walkInReport,
  type CatalogReport,
  type DentistMappingReport,
  type EmptyPhoneReport,
  type MediaPilotReport,
  type MoneyReport,
  type SettingsReport,
  type WalkInReport,
} from './pilot-inventory.js';
import type { ProductionPreflightReport } from './production-report.js';
import { classifyOperatorReview } from './signoff.js';

export type PilotReadinessVerdict = 'READY_FOR_PILOT_APPLY' | 'NOT_READY';

export type PilotBlocker = { code: string; message: string };

export type PilotReadinessReport = {
  metadata: {
    mode: 'PILOT_READINESS';
    productionApplyEnabled: boolean;
    productionApplyStatus: 'ENABLED' | 'DISABLED';
    targetOrganizationId: string;
    sourceJsonPath: string;
    sourceMediaRoot: string;
    sourceJsonHash: string | null;
    mediaManifestHash: string | null;
    mediaFileCount: number | null;
    backupTimestamp: string | null;
    backupLocation: string | null;
    sourceUnchanged: boolean;
    startedAt: string;
    finishedAt: string;
  };
  verdict: PilotReadinessVerdict;
  blockers: PilotBlocker[];
  policyDecisions: PilotPolicyDecision[];
  policiesConfirmed: boolean;
  sourceCounts: DryRunResult['report']['counts'] | null;
  plannedCounts: Record<string, number> | null;
  skipped: DryRunResult['report']['skipped'];
  warnings: DryRunResult['report']['warnings'];
  errors: DryRunResult['report']['errors'];
  dryRunOk: boolean;
  walkIn: WalkInReport | null;
  emptyPhone: EmptyPhoneReport | null;
  dentistMappings: DentistMappingReport | null;
  media: MediaPilotReport | null;
  money: MoneyReport | null;
  settings: SettingsReport | null;
  catalog: CatalogReport | null;
  organization: {
    checked: boolean;
    exists: boolean;
    active: boolean;
    alreadyMigrated: boolean;
    licenseBinding: 'ACTIVE' | 'MISSING' | 'NOT_REQUIRED' | 'NOT_CHECKED';
    appropriateForPilot: boolean;
    slugMatched: boolean | null;
  };
  preflight: {
    ran: boolean;
    ok: boolean;
    error: string | null;
    executionEnabled: boolean;
  };
  operatorReview: ReturnType<typeof classifyOperatorReview> | null;
  cutoverChecklist: typeof PILOT_CUTOVER_CHECKLIST;
  rollbackPlan: typeof PILOT_ROLLBACK_PLAN;
  steps6to13Executed: false;
};

export type PilotReadinessDeps = {
  env: NodeJS.ProcessEnv;
  prisma?: PrismaClient;
  backupEvidencePath?: string;
  cli?: { sourceJsonPath?: string; sourceMediaRoot?: string; targetOrganizationId?: string };
};

function plannedCounts(dry: DryRunResult): Record<string, number> {
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
 * Read-only pilot readiness. Never writes production DB, storage, or source files.
 * Production APPLY remains disabled.
 */
export async function runPilotReadiness(deps: PilotReadinessDeps): Promise<PilotReadinessReport> {
  const startedAt = new Date().toISOString();
  const blockers: PilotBlocker[] = [];
  const identity = parsePilotIdentity(deps.env, deps.cli);
  const policies = parsePilotPolicies(deps.env);
  if (!policies.ok) {
    blockers.push({
      code: 'POLICIES_NOT_CONFIRMED',
      message: 'All five product policies must be explicitly confirmed. Defaults are not accepted.',
    });
  }

  if (identity.liveAppDataRefused) {
    blockers.push({
      code: 'LIVE_APPDATA',
      message: 'Pilot source must be a backup/copy directory, not the live AppData store.',
    });
  }

  let evidence: BackupEvidence | null = null;
  const backupPath = deps.backupEvidencePath ?? deps.env.PILOT_BACKUP_EVIDENCE ?? deps.env.MIGRATION_BACKUP_EVIDENCE;
  if (!backupPath) {
    blockers.push({ code: 'BACKUP_EVIDENCE_MISSING', message: 'Pilot backup evidence file is required.' });
  } else if (!identity.liveAppDataRefused) {
    try {
      evidence = loadBackupEvidence(backupPath);
      assertBackupEvidenceMatchesSource(evidence, identity.sourceJsonPath, identity.sourceMediaRoot);
    } catch (error) {
      blockers.push({
        code: 'BACKUP_EVIDENCE_INVALID',
        message: error instanceof Error ? error.message : String(error),
      });
      evidence = null;
    }
  }

  let sourceJsonHash: string | null = null;
  let mediaManifestHash: string | null = null;
  let mediaFileCount: number | null = null;
  let sourceUnchanged = false;
  let dry: DryRunResult | null = null;

  if (!identity.liveAppDataRefused) {
    try {
      sourceJsonHash = hashFile(identity.sourceJsonPath);
      const manifest = mediaManifest(identity.sourceMediaRoot);
      mediaManifestHash = manifest.hash;
      mediaFileCount = manifest.count;
      const config = parseMigrationConfig({
        sourceJsonPath: identity.sourceJsonPath,
        sourceMediaRoot: identity.sourceMediaRoot,
        targetOrganizationId: identity.targetOrganizationId,
        dryRun: true,
        strict: true,
      });
      dry = runDryRun(config);
      const jsonAfter = hashFile(identity.sourceJsonPath);
      const mediaAfter = mediaManifest(identity.sourceMediaRoot);
      sourceUnchanged = jsonAfter === sourceJsonHash && mediaAfter.hash === mediaManifestHash;
      if (!sourceUnchanged) {
        blockers.push({ code: 'SOURCE_INTEGRITY', message: 'Source JSON or media changed during readiness (unexpected).' });
      }
    } catch (error) {
      blockers.push({
        code: 'DRY_RUN_FAILED',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (dry) {
    if (!dry.report.ok || dry.report.errors.length > 0) {
      blockers.push({ code: 'DRY_RUN_ERRORS', message: `Dry-run has ${dry.report.errors.length} blocking error(s).` });
    }
    const unexpectedOrphans = dry.report.orphanReferences.filter((i) => i.code === 'ORPHAN_PATIENT');
    if (unexpectedOrphans.length > 0) {
      blockers.push({ code: 'UNEXPECTED_ORPHAN', message: `${unexpectedOrphans.length} unexpected orphan relation(s).` });
    }
    if (dry.report.skipped.some((i) => i.code === 'MEDIA_SIZE_MISMATCH')) {
      blockers.push({ code: 'CRITICAL_MEDIA_MISMATCH', message: 'Media size mismatch is a blocking readiness condition.' });
    }
  }

  const dentistMappings = dry
    ? dentistMappingReport(dry.loaded.clinic, identity.targetOrganizationId)
    : null;
  if (dentistMappings && !dentistMappings.resolved) {
    blockers.push({
      code: 'DENTIST_MAPPING_UNRESOLVED',
      message: `${dentistMappings.unmappedReferences.length} dentistId reference(s) do not map to a local dentist.`,
    });
  }

  const organization = {
    checked: false,
    exists: false,
    active: false,
    alreadyMigrated: false,
    licenseBinding: 'NOT_CHECKED' as 'NOT_CHECKED' | 'ACTIVE' | 'MISSING' | 'NOT_REQUIRED',
    appropriateForPilot: false,
    slugMatched: null as boolean | null,
  };

  const requireLicense =
    deps.env.MIGRATION_REQUIRE_LICENSE_BINDING === 'YES' || deps.env.PILOT_REQUIRE_LICENSE_BINDING === 'YES';
  const expectedSlug = deps.env.PILOT_EXPECTED_ORGANIZATION_SLUG;

  if (deps.prisma) {
    organization.checked = true;
    const org = await deps.prisma.organization.findUnique({
      where: { id: identity.targetOrganizationId },
      include: { licenseBinding: true, migration: true },
    });
    organization.exists = Boolean(org);
    organization.active = org?.status === 'ACTIVE';
    organization.alreadyMigrated = Boolean(
      org?.migration && (org.migration.status === 'MIGRATED' || org.migration.status === 'VERIFIED'),
    );
    if (requireLicense) {
      organization.licenseBinding = org?.licenseBinding?.status === 'ACTIVE' ? 'ACTIVE' : 'MISSING';
    } else {
      organization.licenseBinding = 'NOT_REQUIRED';
    }
    if (expectedSlug) {
      organization.slugMatched = org?.slug === expectedSlug;
    } else {
      organization.slugMatched = org ? true : null;
    }
    organization.appropriateForPilot =
      organization.exists &&
      organization.active &&
      !organization.alreadyMigrated &&
      organization.licenseBinding !== 'MISSING' &&
      organization.slugMatched !== false;
    if (!organization.exists) {
      blockers.push({ code: 'TARGET_ORG_MISSING', message: 'Target organization does not exist.' });
    } else if (!organization.active) {
      blockers.push({ code: 'TARGET_ORG_INACTIVE', message: 'Target organization is not ACTIVE.' });
    }
    if (organization.alreadyMigrated) {
      blockers.push({ code: 'TARGET_ORG_ALREADY_MIGRATED', message: 'Target organization is already MIGRATED/VERIFIED.' });
    }
    if (organization.licenseBinding === 'MISSING') {
      blockers.push({ code: 'LICENSE_BINDING_MISSING', message: 'Expected ACTIVE license binding is missing.' });
    }
    if (organization.slugMatched === false) {
      blockers.push({
        code: 'TARGET_ORG_NOT_PILOT',
        message: 'Target organization slug does not match PILOT_EXPECTED_ORGANIZATION_SLUG.',
      });
    }
  } else {
    blockers.push({
      code: 'TARGET_ORG_NOT_CHECKED',
      message: 'Target organization was not verified (no isolated Prisma client).',
    });
  }

  const preflight = {
    ran: false,
    ok: false,
    error: null as string | null,
    executionEnabled: PRODUCTION_APPLY_EXECUTION_ENABLED,
  };
  if (!identity.liveAppDataRefused && backupPath && evidence && dry?.report.ok) {
    try {
      const config = parseMigrationConfig({
        sourceJsonPath: identity.sourceJsonPath,
        sourceMediaRoot: identity.sourceMediaRoot,
        targetOrganizationId: identity.targetOrganizationId,
        dryRun: true,
        strict: true,
      });
      const result: ProductionPreflightReport = await runProductionPreflight(config, {
        prisma: deps.prisma,
        env: {
          ...deps.env,
          TARGET_ORGANIZATION_ID: identity.targetOrganizationId,
          MIGRATION_ALLOWED_ORGANIZATION_ID:
            deps.env.MIGRATION_ALLOWED_ORGANIZATION_ID ?? identity.targetOrganizationId,
        },
        backupEvidencePath: backupPath,
      });
      preflight.ran = true;
      preflight.ok = result.ok;
      preflight.executionEnabled = result.metadata.executionEnabled;
      if (!preflight.ok) {
        blockers.push({ code: 'PREFLIGHT_FAILED', message: 'Production preflight did not pass.' });
      }
    } catch (error) {
      preflight.ran = true;
      preflight.ok = false;
      preflight.error = error instanceof Error ? error.message : String(error);
      blockers.push({ code: 'PREFLIGHT_FAILED', message: preflight.error });
    }
  } else if (!preflight.ran) {
    blockers.push({
      code: 'PREFLIGHT_NOT_RUN',
      message: 'Production preflight did not run (backup, dry-run, or source not eligible).',
    });
  }

  // Phase 6F.3+: production APPLY may be enabled; readiness remains a classification report.

  const verdict: PilotReadinessVerdict = blockers.length === 0 ? 'READY_FOR_PILOT_APPLY' : 'NOT_READY';

  return {
    metadata: {
      mode: 'PILOT_READINESS',
      productionApplyEnabled: PRODUCTION_APPLY_EXECUTION_ENABLED,
      productionApplyStatus: PRODUCTION_APPLY_EXECUTION_ENABLED ? 'ENABLED' : 'DISABLED',
      targetOrganizationId: identity.targetOrganizationId,
      sourceJsonPath: identity.sourceJsonPath,
      sourceMediaRoot: identity.sourceMediaRoot,
      sourceJsonHash,
      mediaManifestHash,
      mediaFileCount,
      backupTimestamp: evidence?.backupTimestamp ?? null,
      backupLocation: backupPath ?? null,
      sourceUnchanged,
      startedAt,
      finishedAt: new Date().toISOString(),
    },
    verdict,
    blockers,
    policyDecisions: policies.decisions,
    policiesConfirmed: policies.ok,
    sourceCounts: dry?.report.counts ?? null,
    plannedCounts: dry ? plannedCounts(dry) : null,
    skipped: dry?.report.skipped ?? [],
    warnings: dry?.report.warnings ?? [],
    errors: dry?.report.errors ?? [],
    dryRunOk: Boolean(dry?.report.ok),
    walkIn: dry ? walkInReport(dry.loaded.clinic) : null,
    emptyPhone: dry ? emptyPhoneReport(dry.loaded.clinic) : null,
    dentistMappings,
    media: dry ? mediaPilotReport(dry) : null,
    money: dry ? moneyReport(dry.loaded.clinic) : null,
    settings: dry ? settingsReport(dry.loaded.clinic, dry.loaded.zoomFactor) : null,
    catalog: dry ? catalogReport(dry.loaded.clinic, dry) : null,
    organization,
    preflight,
    operatorReview: dry ? classifyOperatorReview(dry) : null,
    cutoverChecklist: PILOT_CUTOVER_CHECKLIST,
    rollbackPlan: PILOT_ROLLBACK_PLAN,
    steps6to13Executed: false,
  };
}

export function formatPilotReadiness(report: PilotReadinessReport): string {
  const lines = [
    'DentiSuite pilot readiness (Phase 6E)',
    `verdict: ${report.verdict}`,
    `production APPLY: ${report.metadata.productionApplyStatus}`,
    `dry-run ok: ${report.dryRunOk}`,
    `policies confirmed: ${report.policiesConfirmed}`,
    `source unchanged: ${report.metadata.sourceUnchanged}`,
    `target: ${report.metadata.targetOrganizationId}`,
    `walk-in invoices: ${report.walkIn?.patientlessInvoices ?? 'n/a'} (not migrated)`,
    `walk-in prescriptions: ${report.walkIn?.patientlessPrescriptions ?? 'n/a'} (not migrated)`,
    `empty phone: ${report.emptyPhone?.count ?? 'n/a'}`,
    `dentist unmapped: ${report.dentistMappings?.unmappedReferences.length ?? 'n/a'}`,
    `media found/missing/mismatch: ${report.media?.filesFound ?? 'n/a'}/${report.media?.filesMissing ?? 'n/a'}/${report.media?.sizeMismatch ?? 'n/a'}`,
    `WARNINGS: ${report.warnings.length}`,
    `SKIPPED: ${report.skipped.length}`,
    `ERRORS: ${report.errors.length}`,
    `BLOCKERS: ${report.blockers.length}`,
    ...report.blockers.map((b) => `  - ${b.code}: ${b.message}`),
    'Cutover steps 6–13 were not executed.',
  ];
  return lines.join('\n');
}

export function assertPilotDoesNotApply(): void {
  if (PRODUCTION_APPLY_EXECUTION_ENABLED) {
    throw new ApplyGateError('Production APPLY must remain disabled.');
  }
}
