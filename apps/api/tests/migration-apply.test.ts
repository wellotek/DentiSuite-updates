import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { FIXTURE_ORG_ID, writeStagingApplyFixture } from './helpers/migration-fixture.js';
import { resetAuthTables, startTestDatabase, stopTestDatabase } from './helpers/test-db.js';
import { parseMigrationConfig } from '../src/migration/config.js';
import { runDryRun } from '../src/migration/dry-run.js';
import { mappedUuid } from '../src/migration/ids.js';
import { hashFile, hashMediaTree } from '../src/migration/hash.js';
import { ApplyGateError, assertApplyGates } from '../src/migration/apply-gate.js';
import { runApply } from '../src/migration/apply.js';
import { rollbackStagingMigration } from '../src/migration/rollback.js';
import { runMigrationCli } from '../src/migration/cli.js';
import { reportLooksLikeItContainsSecrets } from '../src/migration/report.js';
import { MemoryObjectStorage } from '../src/media/storage.js';

const OTHER_ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const MISSING_ORG_ID = '33333333-3333-4333-8333-333333333333';

const STAGING_GATES = {
  migrationMode: 'APPLY',
  migrationConfirm: 'YES',
  migrationEnv: 'STAGING',
  nodeEnv: 'test',
  r2Bucket: null as string | null,
  databaseUrl: 'postgresql://dentisuite:dentisuite@127.0.0.1:5432/dentisuite_test',
};

const STAGING_ENV = {
  NODE_ENV: 'test',
  MIGRATION_MODE: 'APPLY',
  MIGRATION_CONFIRM: 'YES',
  MIGRATION_ENV: 'STAGING',
  DATABASE_URL: STAGING_GATES.databaseUrl!,
} as NodeJS.ProcessEnv;

class WrongSizeStorage extends MemoryObjectStorage {
  override async headObject(key: string) {
    const head = await super.headObject(key);
    if (!head.exists) return head;
    return { exists: true, size: 1, contentType: head.contentType };
  }
}

function walkFileCount(root: string): number {
  let n = 0;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else n += 1;
    }
  }
  return n;
}

describe('Phase 6B staging APPLY', () => {
  let prisma: PrismaClient;
  let storage: MemoryObjectStorage;
  let paths: ReturnType<typeof writeStagingApplyFixture>;

  beforeAll(async () => {
    ({ prisma } = await startTestDatabase());
    paths = writeStagingApplyFixture(mkdtempSync(join(tmpdir(), 'ds-6b-')));
  }, 120_000);

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await resetAuthTables(prisma);
    storage = new MemoryObjectStorage();
    await prisma.organization.create({
      data: { id: FIXTURE_ORG_ID, name: 'DentiSuite Staging', slug: 'dentisuite-staging' },
    });
    await prisma.organization.create({
      data: { id: OTHER_ORG_ID, name: 'Other Tenant', slug: 'other-tenant' },
    });
  });

  function cfg(overrides: Record<string, unknown> = {}) {
    return parseMigrationConfig({
      sourceJsonPath: paths.sourceJsonPath,
      sourceMediaRoot: paths.sourceMediaRoot,
      targetOrganizationId: FIXTURE_ORG_ID,
      dryRun: true,
      strict: true,
      ...overrides,
    });
  }

  function applyDeps(extra: { failAfterStatus?: boolean; storage?: MemoryObjectStorage } = {}) {
    return {
      prisma,
      storage: extra.storage ?? storage,
      gates: STAGING_GATES,
      failAfterStatus: extra.failAfterStatus,
    };
  }

  it('1. APPLY gate refusal without MIGRATION_MODE=APPLY', async () => {
    expect(() => assertApplyGates({ ...STAGING_GATES, migrationMode: 'DRY_RUN' })).toThrow(
      /MIGRATION_MODE=APPLY/,
    );
    const cli = await runMigrationCli(
      ['apply', '--source', paths.sourceJsonPath, '--media', paths.sourceMediaRoot, '--organization-id', FIXTURE_ORG_ID],
      { NODE_ENV: 'test', MIGRATION_CONFIRM: 'YES', MIGRATION_ENV: 'STAGING' },
    );
    expect(cli.exitCode).toBe(1);
    expect(cli.stderr).toMatch(/MIGRATION_MODE=APPLY/);
  });

  it('2. APPLY gate refusal without confirmation', async () => {
    expect(() => assertApplyGates({ ...STAGING_GATES, migrationConfirm: 'no' })).toThrow(
      /MIGRATION_CONFIRM=YES/,
    );
    const cli = await runMigrationCli(
      ['apply', '--source', paths.sourceJsonPath, '--media', paths.sourceMediaRoot, '--organization-id', FIXTURE_ORG_ID],
      { NODE_ENV: 'test', MIGRATION_MODE: 'APPLY', MIGRATION_ENV: 'STAGING' },
    );
    expect(cli.exitCode).toBe(1);
    expect(cli.stderr).toMatch(/MIGRATION_CONFIRM=YES/);
  });

  it('3. APPLY gate refusal outside staging / production', async () => {
    expect(() => assertApplyGates({ ...STAGING_GATES, migrationEnv: 'PRODUCTION' })).toThrow(
      /STAGING/,
    );
    expect(() => assertApplyGates({ ...STAGING_GATES, nodeEnv: 'production' })).toThrow(/STAGING/);
    expect(() =>
      assertApplyGates({ ...STAGING_GATES, r2Bucket: 'dentisuite-prod' }),
    ).toThrow(/production object-storage/);
    const cli = await runMigrationCli(
      ['apply', '--source', paths.sourceJsonPath, '--media', paths.sourceMediaRoot, '--organization-id', FIXTURE_ORG_ID],
      { ...STAGING_ENV, NODE_ENV: 'production' },
    );
    expect(cli.stderr).toMatch(/STAGING/);
  });

  it('4. invalid / non-staging target organization', async () => {
    await expect(
      runApply(cfg({ targetOrganizationId: MISSING_ORG_ID }), applyDeps()),
    ).rejects.toBeInstanceOf(ApplyGateError);
    await expect(
      runApply(cfg({ targetOrganizationId: MISSING_ORG_ID }), applyDeps()),
    ).rejects.toThrow(/does not exist/);
    await prisma.organization.update({
      where: { id: FIXTURE_ORG_ID },
      data: { name: 'Live Customer', slug: 'live-customer' },
    });
    await expect(runApply(cfg(), applyDeps())).rejects.toThrow(/not appropriate for staging/);
  });

  it('5. already migrated organization is idempotent (no duplicates)', async () => {
    const first = await runApply(cfg(), applyDeps());
    expect(first.report.metadata.status).toBe('VERIFIED');
    const second = await runApply(cfg(), applyDeps());
    expect(second.report.ok).toBe(true);
    expect(second.report.alreadyExists.patient).toBe(3);
    expect(second.report.inserted.patient).toBe(0);
    expect(await prisma.patient.count({ where: { organizationId: FIXTURE_ORG_ID } })).toBe(3);
  });

  it('6-7. deterministic rerun after rollback; no duplicates on retry', async () => {
    const first = await runApply(cfg(), applyDeps());
    const patientId = mappedUuid(FIXTURE_ORG_ID, 'patient', 'p1');
    expect(first.report.ok).toBe(true);
    expect((await prisma.patient.findUnique({ where: { id: patientId } }))?.organizationId).toBe(
      FIXTURE_ORG_ID,
    );

    await rollbackStagingMigration({
      prisma,
      storage,
      organizationId: FIXTURE_ORG_ID,
      gates: STAGING_GATES,
    });
    expect(await prisma.patient.count({ where: { organizationId: FIXTURE_ORG_ID } })).toBe(0);

    const second = await runApply(cfg(), applyDeps());
    expect(second.report.ok).toBe(true);
    expect(second.report.inserted.patient).toBe(3);
    expect(await prisma.patient.findUnique({ where: { id: patientId } })).not.toBeNull();
    expect(await prisma.patient.count({ where: { organizationId: FIXTURE_ORG_ID } })).toBe(3);

    await prisma.organizationMigration.update({
      where: { organizationId: FIXTURE_ORG_ID },
      data: { status: 'ABANDONED' },
    });
    const third = await runApply(cfg(), applyDeps());
    expect(third.report.ok).toBe(true);
    expect(third.report.alreadyExists.patient).toBe(3);
    expect(third.report.inserted.patient).toBe(0);
    expect(await prisma.patient.count({ where: { organizationId: FIXTURE_ORG_ID } })).toBe(3);
    expect(await prisma.appointment.count({ where: { organizationId: FIXTURE_ORG_ID } })).toBe(3);
    expect(await prisma.invoice.count({ where: { organizationId: FIXTURE_ORG_ID } })).toBe(3);
  });

  it('8-12. source unchanged, counts, references, snapshots', async () => {
    const jsonBefore = hashFile(paths.sourceJsonPath);
    const mediaBefore = hashMediaTree(paths.sourceMediaRoot);
    const mediaCount = walkFileCount(paths.sourceMediaRoot);
    const { report, dryRun } = await runApply(cfg(), applyDeps());
    expect(hashFile(paths.sourceJsonPath)).toBe(jsonBefore);
    expect(hashMediaTree(paths.sourceMediaRoot).hash).toBe(mediaBefore.hash);
    expect(walkFileCount(paths.sourceMediaRoot)).toBe(mediaCount);
    expect(report.metadata.sourceJsonUnchanged).toBe(true);
    expect(report.metadata.sourceMediaUnchanged).toBe(true);
    expect(report.ok).toBe(true);
    expect(report.verification?.ok).toBe(true);
    for (const [key, parity] of Object.entries(report.verification!.countParity)) {
      expect(parity.difference, key).toBe(0);
    }
    expect(report.verification?.samplesChecked).toBeGreaterThanOrEqual(3 + 3 + 3 + 3 + 3 + 3 + 2 + 2 + 2);
    const appt = await prisma.appointment.findFirst({
      where: { id: dryRun.planned.appointments[0]!.cloudId },
    });
    expect(appt?.patientName).toBe('Sophie Martin SNAPSHOT');
    expect(appt?.patientPhone).toBe('OLD-PHONE-1');
    expect(appt?.practitioner).toBe('Dr. Amine El Amrani');
  });

  it('13-16. dentist/treatment/prescription/invoice mapping', async () => {
    const { dryRun } = await runApply(cfg(), applyDeps());
    const dentistCloud = mappedUuid(FIXTURE_ORG_ID, 'dentist', 'd1');
    const patient = await prisma.patient.findFirst({
      where: { id: mappedUuid(FIXTURE_ORG_ID, 'patient', 'p1') },
    });
    expect(patient?.dentistId).toBe(dentistCloud);
    const a3 = await prisma.appointment.findFirst({
      where: { id: mappedUuid(FIXTURE_ORG_ID, 'appointment', 'a3') },
    });
    expect(a3?.dentistId).toBeNull();
    const t1 = await prisma.treatment.findFirst({
      where: { id: mappedUuid(FIXTURE_ORG_ID, 'treatment', 't1') },
    });
    expect(t1?.cost).toBe(6000);
    expect(t1?.actId).toBe('act-s02');
    const rx = await prisma.prescription.findFirst({
      where: { id: mappedUuid(FIXTURE_ORG_ID, 'prescription', 'rx1') },
      include: { lines: true },
    });
    expect(rx?.patientName).toBe('Sophie Martin RX');
    expect(rx?.dentistId).toBe(dentistCloud);
    expect(rx?.lines).toHaveLength(1);
    expect(await prisma.prescription.count({ where: { organizationId: FIXTURE_ORG_ID } })).toBe(3);
    const i1 = await prisma.invoice.findFirst({
      where: { id: mappedUuid(FIXTURE_ORG_ID, 'invoice', 'i1') },
    });
    expect(i1?.treatmentId).toBe(mappedUuid(FIXTURE_ORG_ID, 'treatment', 't1'));
    expect(i1?.amount).toBe(6000);
    const i3 = await prisma.invoice.findFirst({
      where: { id: mappedUuid(FIXTURE_ORG_ID, 'invoice', 'i3') },
    });
    expect(i3?.treatmentId).toBeNull();
    expect(dryRun.report.warnings.some((w) => w.code === 'UNMAPPED_TREATMENT')).toBe(true);
    expect(
      await prisma.prescription.findFirst({
        where: { id: mappedUuid(FIXTURE_ORG_ID, 'prescription', 'rx-walkin') },
      }),
    ).toBeNull();
  });

  it('17-20. missing media, size mismatch, READY after object verify, DICOM generic', async () => {
    const { report } = await runApply(cfg(), applyDeps());
    expect(report.media.missing).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.patientMedia.findFirst({
        where: { id: mappedUuid(FIXTURE_ORG_ID, 'media', 'med-missing') },
      }),
    ).toBeNull();
    expect(
      await prisma.patientMedia.findFirst({
        where: { id: mappedUuid(FIXTURE_ORG_ID, 'media', 'med-mismatch') },
      }),
    ).toBeNull();
    const image = await prisma.patientMedia.findFirst({
      where: { id: mappedUuid(FIXTURE_ORG_ID, 'media', 'med-ok') },
    });
    expect(image?.status).toBe('READY');
    expect(image?.size).toBe(paths.photoSize);
    const head = await storage.headObject(image!.storageKey);
    expect(head.exists).toBe(true);
    expect(head.size).toBe(paths.photoSize);
    const dicom = await prisma.patientMedia.findFirst({
      where: { id: mappedUuid(FIXTURE_ORG_ID, 'media', 'med-dicom') },
    });
    expect(dicom?.kind).toBe('dicom');
    expect(dicom?.status).toBe('READY');
    expect(dicom?.storageKey.endsWith('.dcm')).toBe(true);
    expect(dicom?.storageKey.includes('scan.dcm')).toBe(false);

    await resetAuthTables(prisma);
    await prisma.organization.create({
      data: { id: FIXTURE_ORG_ID, name: 'DentiSuite Staging', slug: 'dentisuite-staging' },
    });
    const lying = new WrongSizeStorage();
    const failed = await runApply(cfg(), applyDeps({ storage: lying }));
    expect(failed.report.ok).toBe(false);
    const pending = await prisma.patientMedia.findFirst({
      where: { id: mappedUuid(FIXTURE_ORG_ID, 'media', 'med-ok') },
    });
    expect(pending?.status).not.toBe('READY');
    const mig = await prisma.organizationMigration.findUnique({
      where: { organizationId: FIXTURE_ORG_ID },
    });
    expect(mig?.status).toBe('FAILED');
  });

  it('21. envoye is preserved (not remapped to fabrication)', async () => {
    await runApply(cfg(), applyDeps());
    const row = await prisma.prosthesis.findFirst({
      where: { id: mappedUuid(FIXTURE_ORG_ID, 'prosthesis', 'pr-envoye') },
    });
    expect(row?.status).toBe('envoye');
    expect(row?.status).not.toBe('fabrication');
  });

  it('22. zero invalid cross-tenant rows', async () => {
    await runApply(cfg(), applyDeps());
    expect(await prisma.patient.count({ where: { organizationId: OTHER_ORG_ID } })).toBe(0);
    expect(await prisma.appointment.count({ where: { organizationId: OTHER_ORG_ID } })).toBe(0);
    const leaked = await prisma.patient.count({
      where: { organizationId: { not: FIXTURE_ORG_ID }, id: { in: [mappedUuid(FIXTURE_ORG_ID, 'patient', 'p1')] } },
    });
    expect(leaked).toBe(0);
    const patients = await prisma.patient.findMany();
    expect(patients.every((p) => p.organizationId === FIXTURE_ORG_ID)).toBe(true);
  });

  it('23-24. FAILED state; VERIFIED only after validation', async () => {
    await expect(runApply(cfg(), applyDeps({ failAfterStatus: true }))).rejects.toThrow(/Injected APPLY failure/);
    const failed = await prisma.organizationMigration.findUnique({
      where: { organizationId: FIXTURE_ORG_ID },
    });
    expect(failed?.status).toBe('FAILED');
    expect(await prisma.patient.count({ where: { organizationId: FIXTURE_ORG_ID } })).toBe(0);

    await resetAuthTables(prisma);
    await prisma.organization.create({
      data: { id: FIXTURE_ORG_ID, name: 'DentiSuite Staging', slug: 'dentisuite-staging' },
    });
    const { report } = await runApply(cfg(), applyDeps());
    expect(report.metadata.status).toBe('VERIFIED');
    expect(report.verification?.ok).toBe(true);
    expect(report.verification?.sessionPrescriptionSeparated).toBe(true);
    expect(report.verification?.envoyePreserved).toBe(true);
    const sessions = await prisma.clinicalSession.findMany({ where: { organizationId: FIXTURE_ORG_ID } });
    expect(sessions.some((s) => s.prescription === 'KEEP_FREE_TEXT_XYZ')).toBe(true);
    const leakedRx = await prisma.prescription.findFirst({
      where: { title: 'KEEP_FREE_TEXT_XYZ' },
    });
    expect(leakedRx).toBeNull();
  });

  it('25. no secrets in apply report', async () => {
    process.env.R2_SECRET_ACCESS_KEY = 'super-secret-test-value';
    process.env.DATABASE_URL = STAGING_GATES.databaseUrl!;
    const out = join(paths.sourceJsonPath, '..', 'migration-apply-report.json');
    const cli = await runMigrationCli(
      [
        'apply',
        '--source',
        paths.sourceJsonPath,
        '--media',
        paths.sourceMediaRoot,
        '--organization-id',
        FIXTURE_ORG_ID,
        '--out',
        out,
      ],
      STAGING_ENV,
      { prisma, storage },
    );
    expect(cli.exitCode).toBe(0);
    const raw = readFileSync(out, 'utf8');
    expect(raw).not.toMatch(/super-secret-test-value/);
    expect(raw).not.toMatch(/R2_SECRET_ACCESS_KEY/);
    expect(raw).not.toMatch(/password/i);
    const parsed = JSON.parse(raw) as unknown;
    expect(reportLooksLikeItContainsSecrets(parsed)).toBe(false);
    expect(JSON.stringify(parsed)).not.toContain('DATABASE_URL');
  });

  it('dry-run still performs zero writes; APPLY uses Prisma not public POST', async () => {
    const before = await prisma.patient.count();
    const dry = runDryRun(cfg());
    expect(dry.report.ok).toBe(true);
    expect(dry.report.databaseWrites).toBe(0);
    expect(await prisma.patient.count()).toBe(before);
    const { report } = await runApply(cfg(), applyDeps());
    expect(report.ok).toBe(true);
    expect(report.metadata.environment).toBe('STAGING');
    expect(await prisma.organization.count()).toBe(2);
    expect(await prisma.user.count()).toBe(0);
    const stock = await prisma.stockItem.findFirst({
      where: { id: mappedUuid(FIXTURE_ORG_ID, 'stock', 'st1') },
    });
    expect(stock?.expiryDate).toBeNull();
  });

  it('CLI rollback is staging-gated and not a public API', async () => {
    await runApply(cfg(), applyDeps());
    const refused = await runMigrationCli(
      ['rollback', '--organization-id', FIXTURE_ORG_ID],
      { NODE_ENV: 'test' },
    );
    expect(refused.exitCode).toBe(1);
    const ok = await runMigrationCli(
      ['rollback', '--organization-id', FIXTURE_ORG_ID],
      STAGING_ENV,
      { prisma, storage },
    );
    expect(ok.exitCode).toBe(0);
    expect(await prisma.patient.count({ where: { organizationId: FIXTURE_ORG_ID } })).toBe(0);
    const mig = await prisma.organizationMigration.findUnique({
      where: { organizationId: FIXTURE_ORG_ID },
    });
    expect(mig?.status).toBe('ABANDONED');
  });
});
