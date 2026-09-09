import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { resetAuthTables, startTestDatabase, stopTestDatabase } from './helpers/test-db.js';
import {
  FIXTURE_ORG_ID,
  writeMigrationFixture,
  writeStagingApplyFixture,
} from './helpers/migration-fixture.js';
import { parseMigrationConfig } from '../src/migration/config.js';
import { hashFile, mediaManifest } from '../src/migration/hash.js';
import { assertProductionGates, PRODUCTION_APPLY_EXECUTION_ENABLED } from '../src/migration/production-gate.js';
import { assertProductionAllowlists } from '../src/migration/allowlist.js';
import { runProductionPreflight } from '../src/migration/production-preflight.js';
import { runMigrationVerify } from '../src/migration/verify-command.js';
import { runMigrationCli } from '../src/migration/cli.js';
import { reportLooksLikeItContainsSecrets } from '../src/migration/report.js';
import { isLiveAppDataStorePath } from '../src/migration/source-paths.js';
import { ORGANIZATION_MIGRATION_STATUSES } from '../src/migration/status.js';
import { MemoryObjectStorage } from '../src/media/storage.js';
import { OPEN_PRODUCT_DECISIONS } from '../src/migration/open-decisions.js';

const ORG = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function prodEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    MIGRATION_MODE: 'APPLY',
    MIGRATION_CONFIRM: 'YES',
    MIGRATION_PRODUCTION_APPROVAL: 'YES',
    MIGRATION_ENV: 'PRODUCTION',
    TARGET_ORGANIZATION_ID: ORG,
    MIGRATION_DATABASE_IDENTITY: 'dentisuite-prod-db-label',
    MIGRATION_ALLOWED_DATABASE_IDENTITY: 'dentisuite-prod-db-label',
    MIGRATION_STORAGE_IDENTITY: 'r2:dentisuite-prod-media-label',
    MIGRATION_ALLOWED_STORAGE_IDENTITY: 'r2:dentisuite-prod-media-label',
    MIGRATION_STORAGE_PROVIDER: 'r2',
    MIGRATION_ALLOWED_STORAGE_PROVIDER: 'r2',
    MIGRATION_ALLOWED_ORGANIZATION_ID: ORG,
    DATABASE_URL: 'postgresql://secret-user:secret-pass@prod.example/dentisuite',
    ...overrides,
  } as NodeJS.ProcessEnv;
}

function writeEvidence(sourceJson: string, sourceMedia: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ds-6d-ev-'));
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

describe('Phase 6D production migration preparation', () => {
  let prisma: PrismaClient;
  let storage: MemoryObjectStorage;
  let clean: ReturnType<typeof writeStagingApplyFixture>;
  let mixed: ReturnType<typeof writeMigrationFixture>;

  beforeAll(async () => {
    ({ prisma } = await startTestDatabase());
    clean = writeStagingApplyFixture(mkdtempSync(join(tmpdir(), 'ds-6d-clean-')));
    mixed = writeMigrationFixture(mkdtempSync(join(tmpdir(), 'ds-6d-mixed-')));
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

  function cfg(source: { sourceJsonPath: string; sourceMediaRoot: string } = clean) {
    return parseMigrationConfig({
      sourceJsonPath: source.sourceJsonPath,
      sourceMediaRoot: source.sourceMediaRoot,
      targetOrganizationId: ORG,
      dryRun: true,
      strict: true,
    });
  }

  it('state machine includes production statuses; execution remains disabled', () => {
    expect(ORGANIZATION_MIGRATION_STATUSES).toEqual([
      'NOT_STARTED',
      'DRY_RUN',
      'READY_FOR_APPROVAL',
      'APPROVED',
      'APPLYING',
      'MIGRATED',
      'VERIFYING',
      'VERIFIED',
      'FAILED',
      'ABANDONED',
    ]);
    expect(PRODUCTION_APPLY_EXECUTION_ENABLED).toBe(true);
    expect(OPEN_PRODUCT_DECISIONS).toHaveLength(5);
    expect(OPEN_PRODUCT_DECISIONS.every((d) => d.status === 'UNRESOLVED')).toBe(true);
  });

  it('1. production APPLY rejected without confirmation', async () => {
    expect(() =>
      assertProductionGates({
        migrationMode: 'APPLY',
        migrationConfirm: 'no',
        migrationProductionApproval: 'YES',
        migrationEnv: 'PRODUCTION',
        targetOrganizationId: ORG,
      }),
    ).toThrow(/MIGRATION_CONFIRM=YES/);
    const cli = await runMigrationCli(
      ['apply', '--source', clean.sourceJsonPath, '--media', clean.sourceMediaRoot, '--organization-id', ORG],
      prodEnv({ MIGRATION_CONFIRM: undefined }),
    );
    expect(cli.exitCode).toBe(1);
    expect(cli.stderr).toMatch(/MIGRATION_CONFIRM=YES/);
  });

  it('2. rejected without production approval', () => {
    expect(() =>
      assertProductionGates({
        migrationMode: 'APPLY',
        migrationConfirm: 'YES',
        migrationEnv: 'PRODUCTION',
        targetOrganizationId: ORG,
      }),
    ).toThrow(/MIGRATION_PRODUCTION_APPROVAL=YES/);
  });

  it('3. rejected outside production environment', () => {
    expect(() =>
      assertProductionGates({
        migrationMode: 'APPLY',
        migrationConfirm: 'YES',
        migrationProductionApproval: 'YES',
        migrationEnv: 'STAGING',
        targetOrganizationId: ORG,
      }),
    ).toThrow(/MIGRATION_ENV=PRODUCTION/);
  });

  it('4. rejected with wrong DB identity', () => {
    expect(() =>
      assertProductionAllowlists({
        databaseIdentity: 'db-a',
        allowedDatabaseIdentity: 'db-b',
        storageIdentity: 'r2:bucket',
        allowedStorageIdentity: 'r2:bucket',
        targetOrganizationId: ORG,
        allowedOrganizationId: ORG,
        storageProvider: 'r2',
        allowedStorageProvider: 'r2',
      }),
    ).toThrow(/database identity/);
  });

  it('5. rejected with wrong storage identity / memory provider', () => {
    expect(() =>
      assertProductionAllowlists({
        databaseIdentity: 'db',
        allowedDatabaseIdentity: 'db',
        storageIdentity: 'r2:other',
        allowedStorageIdentity: 'r2:prod',
        targetOrganizationId: ORG,
        allowedOrganizationId: ORG,
        storageProvider: 'r2',
        allowedStorageProvider: 'r2',
      }),
    ).toThrow(/storage identity/);
    expect(() =>
      assertProductionAllowlists({
        databaseIdentity: 'db',
        allowedDatabaseIdentity: 'db',
        storageIdentity: 'memory:x',
        allowedStorageIdentity: 'memory:x',
        targetOrganizationId: ORG,
        allowedOrganizationId: ORG,
        storageProvider: 'memory',
        allowedStorageProvider: 'memory',
      }),
    ).toThrow(/memory\/test\/development object-storage/);
  });

  it('6. rejected without backup evidence', async () => {
    await expect(
      runProductionPreflight(cfg(), {
        prisma,
        env: prodEnv(),
        backupEvidencePath: join(tmpdir(), 'missing-evidence.json'),
      }),
    ).rejects.toThrow(/backup evidence/);
    const cli = await runMigrationCli(
      ['apply', '--source', clean.sourceJsonPath, '--media', clean.sourceMediaRoot, '--organization-id', ORG],
      prodEnv(),
    );
    expect(cli.exitCode).toBe(1);
    expect(cli.stderr).toMatch(/backup evidence is absent/);
  });

  it('7. rejected when dry-run has errors', async () => {
    const evidence = writeEvidence(mixed.sourceJsonPath, mixed.sourceMediaRoot);
    await expect(
      runProductionPreflight(cfg(mixed), {
        prisma,
        env: prodEnv(),
        backupEvidencePath: evidence,
      }),
    ).rejects.toThrow(/dry-run has blocking errors/);
  });

  it('8. rejected for already verified migration', async () => {
    await prisma.organizationMigration.create({
      data: { organizationId: ORG, status: 'VERIFIED', updatedAt: new Date() },
    });
    const evidence = writeEvidence(clean.sourceJsonPath, clean.sourceMediaRoot);
    await expect(
      runProductionPreflight(cfg(), { prisma, env: prodEnv(), backupEvidencePath: evidence }),
    ).rejects.toThrow(/already migrated/);
  });

  it('9. target org must exist', async () => {
    const evidence = writeEvidence(clean.sourceJsonPath, clean.sourceMediaRoot);
    await expect(
      runProductionPreflight(
        parseMigrationConfig({
          sourceJsonPath: clean.sourceJsonPath,
          sourceMediaRoot: clean.sourceMediaRoot,
          targetOrganizationId: FIXTURE_ORG_ID,
          dryRun: true,
        }),
        {
          prisma,
          env: prodEnv({
            TARGET_ORGANIZATION_ID: FIXTURE_ORG_ID,
            MIGRATION_ALLOWED_ORGANIZATION_ID: FIXTURE_ORG_ID,
          }),
          backupEvidencePath: evidence,
        },
      ),
    ).rejects.toThrow(/does not exist/);
  });

  it('10-11. source path must be explicit; live AppData is not automatic', async () => {
    const cli = await runMigrationCli(['apply'], prodEnv({ APPDATA: 'C:\\Users\\x\\AppData\\Roaming' }));
    expect(cli.exitCode).toBe(1);
    expect(cli.stderr).toMatch(/--source/);
    expect(isLiveAppDataStorePath('C:\\Users\\x\\AppData\\Roaming\\dentisuite\\dentisuite-store.json')).toBe(
      true,
    );
    expect(isLiveAppDataStorePath(clean.sourceJsonPath)).toBe(false);
    await expect(
      runProductionPreflight(
        parseMigrationConfig({
          sourceJsonPath: 'C:\\Users\\x\\AppData\\Roaming\\dentisuite\\dentisuite-store.json',
          sourceMediaRoot: 'C:\\Users\\x\\AppData\\Roaming\\dentisuite\\media',
          targetOrganizationId: ORG,
          dryRun: true,
        }),
        { prisma, env: prodEnv(), backupEvidencePath: join(tmpdir(), 'unused-evidence.json') },
      ),
    ).rejects.toThrow(/live AppData store/);
  });

  it('12-13. source hash and media manifest must match evidence', async () => {
    const evidencePath = writeEvidence(clean.sourceJsonPath, clean.sourceMediaRoot);
    const parsed = JSON.parse(readFileSync(evidencePath, 'utf8')) as Record<string, unknown>;
    const badJson = join(mkdtempSync(join(tmpdir(), 'ds-6d-bad-')), 'ev.json');
    writeFileSync(badJson, `${JSON.stringify({ ...parsed, jsonSha256: '0'.repeat(64) })}\n`);
    await expect(
      runProductionPreflight(cfg(), { prisma, env: prodEnv(), backupEvidencePath: badJson }),
    ).rejects.toThrow(/JSON SHA256/);
    const badMedia = join(mkdtempSync(join(tmpdir(), 'ds-6d-badm-')), 'ev.json');
    writeFileSync(badMedia, `${JSON.stringify({ ...parsed, mediaManifestHash: '1'.repeat(64) })}\n`);
    await expect(
      runProductionPreflight(cfg(), { prisma, env: prodEnv(), backupEvidencePath: badMedia }),
    ).rejects.toThrow(/media manifest/);
  });

  it('14. production report contains no secrets; preflight does not write; execution refused', async () => {
    const evidence = writeEvidence(clean.sourceJsonPath, clean.sourceMediaRoot);
    const before = await prisma.patient.count();
    const report = await runProductionPreflight(cfg(), {
      prisma,
      env: prodEnv(),
      backupEvidencePath: evidence,
    });
    expect(report.ok).toBe(true);
    expect(report.metadata.executionEnabled).toBe(true);
    expect(report.metadata.intendedState).toBe('READY_FOR_APPROVAL');
    expect(report.insertedCounts.patient).toBe(0);
    expect(report.openProductDecisions).toHaveLength(5);
    expect(JSON.stringify(report)).not.toContain('secret-pass');
    expect(JSON.stringify(report)).not.toContain('DATABASE_URL');
    expect(reportLooksLikeItContainsSecrets(report)).toBe(false);
    expect(await prisma.patient.count()).toBe(before);
    expect(await prisma.organizationMigration.count()).toBe(0);

    const out = join(mkdtempSync(join(tmpdir(), 'ds-6d-rep-')), 'migration-production-report.json');
    const cli = await runMigrationCli(
      [
        'apply',
        '--source',
        clean.sourceJsonPath,
        '--media',
        clean.sourceMediaRoot,
        '--organization-id',
        ORG,
        '--backup-evidence',
        evidence,
        '--out',
        out,
      ],
      prodEnv(),
      { prisma, storage },
    );
    // Production APPLY is enabled (6F.3) but still requires OBJECT_STORAGE_PROVIDER=r2.
    expect(cli.exitCode).toBe(1);
    expect(cli.stderr).toMatch(/OBJECT_STORAGE_PROVIDER=r2|requires OBJECT_STORAGE_PROVIDER/i);
    expect(await prisma.patient.count()).toBe(before);
  });

  it('15. verify command requires correct migration state', async () => {
    await expect(
      runMigrationVerify({
        prisma,
        storage,
        config: cfg(),
        persistStatus: false,
      }),
    ).rejects.toThrow(/MIGRATED, VERIFYING, or VERIFIED/);
  });

  it('16. production rollback tool does not expose generic delete', async () => {
    const cli = await runMigrationCli(['rollback', '--organization-id', ORG], prodEnv());
    expect(cli.exitCode).toBe(1);
    expect(cli.stderr).toMatch(/operational decision/i);
    expect(cli.stderr).not.toMatch(/deleted/i);
    expect(await prisma.organization.findUnique({ where: { id: ORG } })).not.toBeNull();
  });
});
