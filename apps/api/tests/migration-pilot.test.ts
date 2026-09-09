import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { resetAuthTables, startTestDatabase, stopTestDatabase } from './helpers/test-db.js';
import {
  writeMigrationFixture,
  writePilotReadyFixture,
} from './helpers/migration-fixture.js';
import { hashFile, mediaManifest } from '../src/migration/hash.js';
import { parsePilotIdentity } from '../src/migration/pilot-identity.js';
import { parsePilotPolicies } from '../src/migration/pilot-policies.js';
import { runPilotReadiness } from '../src/migration/pilot-readiness.js';
import { runMigrationCli } from '../src/migration/cli.js';
import { reportLooksLikeItContainsSecrets } from '../src/migration/report.js';
import { PRODUCTION_APPLY_EXECUTION_ENABLED } from '../src/migration/production-gate.js';
import { MemoryObjectStorage } from '../src/media/storage.js';

const ORG = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const here = dirname(fileURLToPath(import.meta.url));
const REAL_JSON = join(here, '..', 'tmp', 'staging-6c-source', 'dentisuite-store.json');
const REAL_MEDIA = join(here, '..', 'tmp', 'staging-6c-source', 'media');

function policyEnv(): Record<string, string> {
  return {
    PILOT_POLICY_WALK_IN_INVOICE: 'SKIP',
    PILOT_POLICY_WALK_IN_PRESCRIPTION: 'SKIP',
    PILOT_POLICY_EMPTY_PHONE: 'ERROR',
    PILOT_POLICY_SETTINGS: 'DEFERRED',
    PILOT_POLICY_ACT_CATALOG: 'DEFERRED',
  };
}

function prodAllowlist(org = ORG): Record<string, string> {
  return {
    MIGRATION_MODE: 'APPLY',
    MIGRATION_CONFIRM: 'YES',
    MIGRATION_PRODUCTION_APPROVAL: 'YES',
    MIGRATION_ENV: 'PRODUCTION',
    TARGET_ORGANIZATION_ID: org,
    MIGRATION_DATABASE_IDENTITY: 'dentisuite-prod-db-label',
    MIGRATION_ALLOWED_DATABASE_IDENTITY: 'dentisuite-prod-db-label',
    MIGRATION_STORAGE_IDENTITY: 'r2:dentisuite-prod-media-label',
    MIGRATION_ALLOWED_STORAGE_IDENTITY: 'r2:dentisuite-prod-media-label',
    MIGRATION_STORAGE_PROVIDER: 'r2',
    MIGRATION_ALLOWED_STORAGE_PROVIDER: 'r2',
    MIGRATION_ALLOWED_ORGANIZATION_ID: org,
  };
}

function writeEvidence(sourceJson: string, sourceMedia: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ds-6e-ev-'));
  const path = join(dir, 'migration-backup-evidence.json');
  const manifest = mediaManifest(sourceMedia);
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        sourceJsonBackupPath: sourceJson,
        sourceMediaBackupPath: sourceMedia,
        backupTimestamp: '2026-09-03T00:00:00.000Z',
        jsonSha256: hashFile(sourceJson),
        mediaManifestHash: manifest.hash,
        mediaFileCount: manifest.count,
      },
      null,
      2,
    )}\n`,
  );
  return path;
}

describe('Phase 6E pilot production migration readiness', () => {
  let prisma: PrismaClient;
  let storage: MemoryObjectStorage;
  let ready: ReturnType<typeof writePilotReadyFixture>;
  let mixed: ReturnType<typeof writeMigrationFixture>;

  beforeAll(async () => {
    ({ prisma } = await startTestDatabase());
    ready = writePilotReadyFixture(mkdtempSync(join(tmpdir(), 'ds-6e-ready-')));
    mixed = writeMigrationFixture(mkdtempSync(join(tmpdir(), 'ds-6e-mixed-')));
  }, 120_000);

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await resetAuthTables(prisma);
    storage = new MemoryObjectStorage();
    await prisma.organization.create({
      data: { id: ORG, name: 'Pilot Cabinet', slug: 'pilot-cabinet' },
    });
  });

  function envFor(
    source: { sourceJsonPath: string; sourceMediaRoot: string },
    extra: Record<string, string | undefined> = {},
  ): NodeJS.ProcessEnv {
    const evidence = Object.prototype.hasOwnProperty.call(extra, 'PILOT_BACKUP_EVIDENCE')
      ? extra.PILOT_BACKUP_EVIDENCE
      : writeEvidence(source.sourceJsonPath, source.sourceMediaRoot);
    return {
      NODE_ENV: 'test',
      PILOT_SOURCE_JSON: source.sourceJsonPath,
      PILOT_MEDIA_ROOT: source.sourceMediaRoot,
      PILOT_TARGET_ORGANIZATION_ID: ORG,
      PILOT_EXPECTED_ORGANIZATION_SLUG: 'pilot-cabinet',
      PILOT_BACKUP_EVIDENCE: evidence,
      DATABASE_URL: 'postgresql://secret-user:secret-pass@prod.example/dentisuite',
      ...policyEnv(),
      ...prodAllowlist(),
      ...extra,
    } as NodeJS.ProcessEnv;
  }

  it('never infers the pilot cabinet; PILOT_* are required', () => {
    expect(() => parsePilotIdentity({} as NodeJS.ProcessEnv)).toThrow(/PILOT_SOURCE_JSON/);
    expect(
      parsePilotIdentity({
        PILOT_SOURCE_JSON: ready.sourceJsonPath,
        PILOT_MEDIA_ROOT: ready.sourceMediaRoot,
        PILOT_TARGET_ORGANIZATION_ID: ORG,
      } as NodeJS.ProcessEnv).targetOrganizationId,
    ).toBe(ORG);
  });

  it('does not silently accept default policies', () => {
    expect(parsePilotPolicies({} as NodeJS.ProcessEnv).ok).toBe(false);
    expect(parsePilotPolicies({ PILOT_POLICY_WALK_IN_INVOICE: 'MIGRATE' } as NodeJS.ProcessEnv).ok).toBe(false);
    expect(parsePilotPolicies(policyEnv() as NodeJS.ProcessEnv).ok).toBe(true);
  });

  it('refuses live AppData as the pilot source', async () => {
    const report = await runPilotReadiness({
      prisma,
      env: envFor(ready, {
        PILOT_SOURCE_JSON: 'C:\\Users\\x\\AppData\\Roaming\\dentisuite\\dentisuite-store.json',
        PILOT_MEDIA_ROOT: 'C:\\Users\\x\\AppData\\Roaming\\dentisuite\\media',
      }),
    });
    expect(report.verdict).toBe('NOT_READY');
    expect(report.blockers.some((b) => b.code === 'LIVE_APPDATA')).toBe(true);
    expect(report.dryRunOk).toBe(false);
  });

  it('is NOT_READY without backup evidence', async () => {
    const report = await runPilotReadiness({
      prisma,
      env: envFor(ready, { PILOT_BACKUP_EVIDENCE: undefined, MIGRATION_BACKUP_EVIDENCE: undefined }),
      backupEvidencePath: undefined,
    });
    expect(report.verdict).toBe('NOT_READY');
    expect(report.blockers.some((b) => b.code === 'BACKUP_EVIDENCE_MISSING')).toBe(true);
  });

  it('is NOT_READY when policies are missing or wrong', async () => {
    const missing = await runPilotReadiness({
      prisma,
      env: envFor(ready, {
        PILOT_POLICY_WALK_IN_INVOICE: undefined,
        PILOT_POLICY_WALK_IN_PRESCRIPTION: undefined,
        PILOT_POLICY_EMPTY_PHONE: undefined,
        PILOT_POLICY_SETTINGS: undefined,
        PILOT_POLICY_ACT_CATALOG: undefined,
      }),
    });
    expect(missing.verdict).toBe('NOT_READY');
    expect(missing.policiesConfirmed).toBe(false);
    const wrong = await runPilotReadiness({
      prisma,
      env: envFor(ready, { PILOT_POLICY_EMPTY_PHONE: 'SKIP' }),
    });
    expect(wrong.verdict).toBe('NOT_READY');
    expect(wrong.policyDecisions.find((d) => d.id === 'empty-phone')?.confirmed).toBe(false);
  });

  it('is NOT_READY for mixed fixture (errors, empty phone, media mismatch, unmapped dentist)', async () => {
    const report = await runPilotReadiness({ prisma, env: envFor(mixed) });
    expect(report.verdict).toBe('NOT_READY');
    expect(report.emptyPhone?.count).toBeGreaterThan(0);
    expect(report.media?.sizeMismatch).toBeGreaterThan(0);
    expect(report.dentistMappings?.resolved).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
    expect(await prisma.patient.count()).toBe(0);
  });

  it('READY_FOR_PILOT_APPLY on synthetic fixture with explicit policies; walk-ins classified not migrated', async () => {
    const jsonBefore = hashFile(ready.sourceJsonPath);
    const mediaBefore = mediaManifest(ready.sourceMediaRoot);
    const beforePatients = await prisma.patient.count();
    const report = await runPilotReadiness({ prisma, env: envFor(ready) });
    expect(report.verdict).toBe('READY_FOR_PILOT_APPLY');
    expect(report.blockers).toEqual([]);
    expect(report.dryRunOk).toBe(true);
    expect(report.policiesConfirmed).toBe(true);
    expect(report.walkIn?.patientlessInvoices).toBe(1);
    expect(report.walkIn?.patientlessPrescriptions).toBe(1);
    expect(report.walkIn?.migrated).toBe(false);
    expect(report.emptyPhone?.count).toBe(0);
    expect(report.dentistMappings?.resolved).toBe(true);
    expect(report.media?.filesMissing).toBe(0);
    expect(report.media?.sizeMismatch).toBe(0);
    expect(report.media?.uploaded).toBe(false);
    expect(report.money?.silentConversion).toBe(false);
    expect(report.settings?.migrated).toBe(false);
    expect(report.catalog?.migrated).toBe(false);
    expect(report.catalog?.unusedCatalogIds).toContain('act-unused');
    expect(report.catalog?.treatmentsKeepActCodeActId).toBe(true);
    expect(report.preflight.ok).toBe(true);
    expect(report.preflight.executionEnabled).toBe(false);
    expect(report.metadata.productionApplyStatus).toBe('DISABLED');
    expect(report.steps6to13Executed).toBe(false);
    expect(report.cutoverChecklist.filter((s) => s.blockedUntilFutureApply).map((s) => s.step)).toEqual([
      6, 7, 8, 9, 10, 11, 12, 13,
    ]);
    expect(JSON.stringify(report)).not.toContain('secret-pass');
    expect(reportLooksLikeItContainsSecrets(report)).toBe(false);
    expect(hashFile(ready.sourceJsonPath)).toBe(jsonBefore);
    expect(mediaManifest(ready.sourceMediaRoot).hash).toBe(mediaBefore.hash);
    expect(await prisma.patient.count()).toBe(beforePatients);
    expect(await prisma.organizationMigration.count()).toBe(0);
    expect(PRODUCTION_APPLY_EXECUTION_ENABLED).toBe(true);
  });

  it('is NOT_READY when the target organization is already migrated', async () => {
    await prisma.organizationMigration.create({
      data: { organizationId: ORG, status: 'VERIFIED', updatedAt: new Date() },
    });
    const report = await runPilotReadiness({ prisma, env: envFor(ready) });
    expect(report.verdict).toBe('NOT_READY');
    expect(report.blockers.some((b) => b.code === 'TARGET_ORG_ALREADY_MIGRATED')).toBe(true);
  });

  it('CLI requires explicit PILOT_* and production APPLY remains refused', async () => {
    const missing = await runMigrationCli(['pilot-readiness'], { NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toMatch(/PILOT_SOURCE_JSON/);

    const out = join(mkdtempSync(join(tmpdir(), 'ds-6e-rep-')), 'pilot-readiness-report.json');
    const ok = await runMigrationCli(
      [
        'pilot-readiness',
        '--source',
        ready.sourceJsonPath,
        '--media',
        ready.sourceMediaRoot,
        '--organization-id',
        ORG,
        '--out',
        out,
      ],
      envFor(ready),
      { prisma, storage },
    );
    expect(ok.exitCode).toBe(0);
    expect(ok.stdout).toMatch(/READY_FOR_PILOT_APPLY/);
    expect(existsSync(out)).toBe(true);
    expect(JSON.parse(readFileSync(out, 'utf8')).verdict).toBe('READY_FOR_PILOT_APPLY');

    const env = envFor(ready);
    const apply = await runMigrationCli(
      [
        'apply',
        '--source',
        ready.sourceJsonPath,
        '--media',
        ready.sourceMediaRoot,
        '--organization-id',
        ORG,
        '--backup-evidence',
        String(env.PILOT_BACKUP_EVIDENCE),
      ],
      env,
      { prisma, storage },
    );
    expect(apply.exitCode).toBe(1);
    expect(apply.stderr).toMatch(/OBJECT_STORAGE_PROVIDER=r2|requires OBJECT_STORAGE_PROVIDER/i);
    expect(await prisma.patient.count()).toBe(0);
  });
});

describe.skipIf(!existsSync(REAL_JSON) || !existsSync(REAL_MEDIA))(
  'Phase 6E operator-supplied pilot copy (read-only)',
  () => {
    let prisma: PrismaClient;

    beforeAll(async () => {
      ({ prisma } = await startTestDatabase());
    }, 120_000);

    afterAll(async () => {
      await stopTestDatabase();
    });

    it('classifies the real copy without production writes', async () => {
      await resetAuthTables(prisma);
      await prisma.organization.create({
        data: { id: ORG, name: 'Pilot Cabinet', slug: 'pilot-cabinet' },
      });
      const jsonBefore = hashFile(REAL_JSON);
      const mediaBefore = mediaManifest(REAL_MEDIA);
      const evidenceDir = mkdtempSync(join(tmpdir(), 'ds-6e-real-ev-'));
      const evidencePath = join(evidenceDir, 'migration-backup-evidence.json');
      const manifest = mediaManifest(REAL_MEDIA);
      writeFileSync(
        evidencePath,
        `${JSON.stringify({
          sourceJsonBackupPath: REAL_JSON,
          sourceMediaBackupPath: REAL_MEDIA,
          backupTimestamp: '2026-09-03T00:00:00.000Z',
          jsonSha256: jsonBefore,
          mediaManifestHash: manifest.hash,
          mediaFileCount: manifest.count,
        })}\n`,
      );
      const report = await runPilotReadiness({
        prisma,
        env: {
          NODE_ENV: 'test',
          PILOT_SOURCE_JSON: REAL_JSON,
          PILOT_MEDIA_ROOT: REAL_MEDIA,
          PILOT_TARGET_ORGANIZATION_ID: ORG,
          PILOT_EXPECTED_ORGANIZATION_SLUG: 'pilot-cabinet',
          PILOT_BACKUP_EVIDENCE: evidencePath,
          ...policyEnv(),
          ...prodAllowlist(),
        } as NodeJS.ProcessEnv,
      });
      expect(report.metadata.productionApplyStatus).toBe('DISABLED');
      expect(report.walkIn?.migrated).toBe(false);
      expect(report.settings?.migrated).toBe(false);
      expect(report.catalog?.migrated).toBe(false);
      expect(report.steps6to13Executed).toBe(false);
      expect(hashFile(REAL_JSON)).toBe(jsonBefore);
      expect(mediaManifest(REAL_MEDIA).hash).toBe(mediaBefore.hash);
      expect(await prisma.patient.count()).toBe(0);
      expect(['READY_FOR_PILOT_APPLY', 'NOT_READY']).toContain(report.verdict);
    });
  },
);
