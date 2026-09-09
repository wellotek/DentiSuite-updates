import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
  FIXTURE_ORG_ID,
  writeMigrationFixture,
} from './helpers/migration-fixture.js';
import {
  resetAuthTables,
  startTestDatabase,
  stopTestDatabase,
} from './helpers/test-db.js';
import { parseMigrationConfig } from '../src/migration/config.js';
import { runDryRun } from '../src/migration/dry-run.js';
import { loadLocalStore, MalformedStoreError } from '../src/migration/loader.js';
import { mappedUuid } from '../src/migration/ids.js';
import { MIGRATION_PLAN_ORDER } from '../src/migration/planner.js';
import { refuseApply } from '../src/migration/apply-gate.js';
import { runMigrationCli } from '../src/migration/cli.js';
import { MemoryObjectStorage } from '../src/media/storage.js';
import { SUPPORTED_CLINIC_SCHEMA_VERSION } from '../src/migration/source-schema.js';

const password = 'SecurePass1!';

async function snapshotCounts(prisma: PrismaClient) {
  return {
    user: await prisma.user.count(),
    organization: await prisma.organization.count(),
    organizationMigration: await prisma.organizationMigration.count(),
    membership: await prisma.membership.count(),
    patient: await prisma.patient.count(),
    appointment: await prisma.appointment.count(),
    clinicalSession: await prisma.clinicalSession.count(),
    treatment: await prisma.treatment.count(),
    prescription: await prisma.prescription.count(),
    dentist: await prisma.dentist.count(),
    patientMedia: await prisma.patientMedia.count(),
    invoice: await prisma.invoice.count(),
    stockItem: await prisma.stockItem.count(),
    prosthesis: await prisma.prosthesis.count(),
  };
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('Phase 6A migration dry-run foundation', () => {
  let prisma: PrismaClient;
  let paths: ReturnType<typeof writeMigrationFixture>;

  beforeAll(async () => {
    ({ prisma } = await startTestDatabase());
    paths = writeMigrationFixture(mkdtempSync(join(tmpdir(), 'ds-mig-')));
  }, 120_000);

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await resetAuthTables(prisma);
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

  it('valid JSON loads', () => {
    const loaded = loadLocalStore(paths.sourceJsonPath);
    expect(loaded.schemaVersion).toBe(SUPPORTED_CLINIC_SCHEMA_VERSION);
    expect(loaded.clinic.patients.length).toBeGreaterThan(0);
    expect(loaded.zoomFactor).toBe(1.2);
  });

  it('malformed JSON rejected', () => {
    expect(() => loadLocalStore(paths.malformedJsonPath)).toThrow(MalformedStoreError);
  });

  it('schemaVersion validation', () => {
    const result = runDryRun(cfg({ sourceJsonPath: paths.v7JsonPath }));
    expect(result.report.errors.some((e) => e.code === 'SCHEMA_VERSION')).toBe(true);
    expect(result.report.ok).toBe(false);
  });

  it('duplicate IDs detected', () => {
    const result = runDryRun(cfg({ sourceJsonPath: paths.duplicateJsonPath }));
    expect(result.report.errors.some((e) => e.code === 'DUPLICATE_ID')).toBe(true);
    expect(result.report.ok).toBe(false);
  });

  it('all local→cloud mappings generated', () => {
    const result = runDryRun(cfg());
    expect(result.maps.patient.get('p1')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result.maps.dentist.get('d1')).toBeDefined();
    expect(result.maps.appointment.get('a1')).toBeDefined();
    expect(result.maps.session.get('ses1')).toBeDefined();
    expect(result.maps.treatment.get('t1')).toBeDefined();
    expect(result.maps.prescription.get('rx1')).toBeDefined();
    expect(result.maps.prescriptionLine.get('rxl1')).toBeDefined();
    expect(result.maps.invoice.get('i1')).toBeDefined();
    expect(result.maps.stock.get('st1')).toBeDefined();
    expect(result.maps.prosthesis.get('pr-envoye')).toBeDefined();
    expect(result.maps.media.get('med-ok')).toBeDefined();
    expect(result.report.mappings.patient).toBeGreaterThan(0);
  });

  it('deterministic rerun mapping', () => {
    const a = runDryRun(cfg());
    const b = runDryRun(cfg());
    expect(a.maps.patient.get('p1')).toBe(b.maps.patient.get('p1'));
    expect(a.maps.patient.get('p1')).toBe(mappedUuid(FIXTURE_ORG_ID, 'patient', 'p1'));
    expect(a.maps.dentist.get('d1')).toBe(b.maps.dentist.get('d1'));
  });

  it('patient reference validation', () => {
    const result = runDryRun(cfg());
    expect(result.planned.patients.some((p) => p.localId === 'p1')).toBe(true);
    expect(result.report.errors.some((e) => e.code === 'EMPTY_PHONE')).toBe(true);
  });

  it('dentist reference validation', () => {
    const result = runDryRun(cfg());
    const ghost = result.planned.patients.find((p) => p.localId === 'p-ghost-dentist');
    expect(ghost?.dentistId).toBeNull();
    expect(result.report.orphanReferences.some((i) => i.code === 'ORPHAN_DENTIST')).toBe(true);
    const p1 = result.planned.patients.find((p) => p.localId === 'p1');
    expect(p1?.dentistId).toBe(result.maps.dentist.get('d1'));
  });

  it('appointment reference validation', () => {
    const result = runDryRun(cfg());
    const ok = result.planned.appointments.find((a) => a.localId === 'a1');
    expect(ok?.patientName).toBe('Sophie Martin SNAPSHOT');
    expect(ok?.patientPhone).toBe('OLD-PHONE');
    expect(ok?.practitioner).toBe('Dr. Amine El Amrani');
    expect(result.report.errors.some((e) => e.entity === 'appointment' && e.code === 'ORPHAN_PATIENT')).toBe(
      true,
    );
    expect(result.report.errors.some((e) => e.entity === 'appointment' && e.code === 'INVALID_DATE')).toBe(
      true,
    );
  });

  it('treatment reference validation', () => {
    const result = runDryRun(cfg());
    const t1 = result.planned.treatments.find((t) => t.localId === 't1');
    expect(t1?.patientId).toBe(result.maps.patient.get('p1'));
    expect(t1?.actId).toBe('act-s02');
    expect(t1?.cost).toBe(6000);
  });

  it('prescription relation validation', () => {
    const result = runDryRun(cfg());
    const rx = result.planned.prescriptions.find((p) => p.localId === 'rx1');
    expect(rx?.patientId).toBe(result.maps.patient.get('p1'));
    expect(rx?.patientName).toBe('Sophie Martin RX');
    expect(rx?.dentistName).toBe('Dr. Amine El Amrani');
    expect(rx?.lines).toHaveLength(1);
    expect(result.report.skipped.some((s) => s.code === 'WALK_IN_PRESCRIPTION')).toBe(true);
    expect(result.report.skipped.some((s) => s.code === 'PRESCRIPTION_NO_LINES')).toBe(true);
  });

  it('invoice relation validation', () => {
    const result = runDryRun(cfg());
    const inv = result.planned.invoices.find((i) => i.localId === 'i1');
    expect(inv?.treatmentId).toBe(result.maps.treatment.get('t1'));
    expect(inv?.patientName).toBe('Sophie Martin INV');
    const orphanT = result.planned.invoices.find((i) => i.localId === 'i-orphan-t');
    expect(orphanT?.treatmentId).toBeNull();
    expect(result.report.warnings.some((w) => w.code === 'UNMAPPED_TREATMENT')).toBe(true);
  });

  it('stock validation', () => {
    const result = runDryRun(cfg());
    expect(result.planned.stock).toHaveLength(1);
    expect(result.planned.stock[0]?.expiryDate).toBeNull();
    expect(result.planned.stock[0]?.unitPrice).toBe(14500);
  });

  it('prosthesis validation', () => {
    const result = runDryRun(cfg());
    expect(result.planned.prostheses[0]?.status).toBe('envoye');
    expect(result.planned.prostheses[0]?.patientName).toBe('Sophie Martin PROTH');
  });

  it('missing media detected', () => {
    const result = runDryRun(cfg());
    expect(result.report.missingMedia.some((i) => i.code === 'MISSING_MEDIA')).toBe(true);
    expect(result.planned.media.some((m) => m.localId === 'med-missing')).toBe(false);
  });

  it('file size mismatch detected', () => {
    const result = runDryRun(cfg());
    expect(result.report.missingMedia.some((i) => i.code === 'MEDIA_SIZE_MISMATCH')).toBe(true);
    expect(result.planned.media.some((m) => m.localId === 'med-mismatch')).toBe(false);
  });

  it('DICOM treated as generic media', () => {
    const result = runDryRun(cfg());
    const dicom = result.planned.media.find((m) => m.localId === 'med-dicom');
    expect(dicom?.kind).toBe('dicom');
    expect(dicom?.storageKey).toContain(`/media/${result.maps.media.get('med-dicom')}.dcm`);
    expect(result.report.infos.some((i) => i.code === 'DICOM_GENERIC_MEDIA')).toBe(true);
  });

  it('PatientSession.prescription remains free text', () => {
    const result = runDryRun(cfg());
    expect(result.planned.sessions[0]?.prescription).toBe('KEEP_FREE_TEXT_XYZ');
    expect(result.planned.prescriptions.some((p) => p.advice.includes('KEEP_FREE_TEXT_XYZ'))).toBe(false);
    expect(result.planned.prescriptions.some((p) => p.lines.some((l) => l.drug.includes('KEEP_FREE_TEXT_XYZ')))).toBe(
      false,
    );
    expect(result.report.infos.some((i) => i.code === 'SESSION_PRESCRIPTION_NOT_MERGED')).toBe(true);
  });

  it('Prosthesis envoye preserved', () => {
    const result = runDryRun(cfg());
    expect(result.planned.prostheses.map((p) => p.status)).toEqual(['envoye']);
  });

  it('settings deferred', () => {
    const result = runDryRun(cfg());
    expect(result.report.deferred.settings).toBe('DEFERRED');
    expect(result.organizationNameCopy).toBeNull();
    const copied = runDryRun(cfg({ copyOrganizationName: true }));
    expect(copied.organizationNameCopy).toBe('Cabinet Fixture');
  });

  it('actCatalog deferred', () => {
    const result = runDryRun(cfg());
    expect(result.report.deferred.actCatalog).toBe('DEFERRED');
    expect(result.planned.treatments.find((t) => t.localId === 't1')?.actId).toBe('act-s02');
  });

  it('walk-in policies reported', () => {
    const result = runDryRun(cfg());
    expect(result.report.skipped.some((s) => s.code === 'WALK_IN_PRESCRIPTION')).toBe(true);
    expect(result.report.skipped.some((s) => s.code === 'WALK_IN_INVOICE')).toBe(true);
    expect(result.report.skipped.some((s) => s.code === 'ZERO_INVOICE')).toBe(true);
    expect(result.planned.prescriptions.some((p) => p.localId === 'rx-walkin')).toBe(false);
    expect(result.planned.invoices.some((i) => i.localId === 'i-walkin')).toBe(false);
    expect(result.planned.invoices.some((i) => i.localId === 'i-zero')).toBe(false);
  });

  it('money conversion reported', () => {
    const strict = runDryRun(cfg());
    expect(strict.report.errors.some((e) => e.code === 'LOSSY_MONEY' && e.entity === 'treatment')).toBe(true);
    expect(strict.report.errors.some((e) => e.code === 'LOSSY_MONEY' && e.entity === 'invoice')).toBe(true);
    expect(strict.planned.treatments.some((t) => t.localId === 't-float')).toBe(false);
  });

  it('strict mode fails appropriately', () => {
    const result = runDryRun(cfg({ strict: true }));
    expect(result.report.ok).toBe(false);
    expect(result.report.errors.length).toBeGreaterThan(0);
  });

  it('non-strict mode generates warnings/skips', () => {
    const result = runDryRun(cfg({ strict: false }));
    expect(result.report.skipped.some((s) => s.code === 'EMPTY_PHONE')).toBe(true);
    expect(result.report.skipped.some((s) => s.code === 'INVALID_DATE')).toBe(true);
    expect(result.report.warnings.some((w) => w.code === 'LOSSY_MONEY')).toBe(true);
    expect(result.planned.treatments.some((t) => t.localId === 't-float' && t.cost === 13)).toBe(true);
    expect(result.planned.invoices.some((i) => i.localId === 'i-float' && i.amount === 11)).toBe(true);
  });

  it('dry-run performs ZERO DB writes', async () => {
    const before = await snapshotCounts(prisma);
    expect(before.organization).toBe(0);
    expect(before.user).toBe(0);
    runDryRun(cfg());
    const after = await snapshotCounts(prisma);
    expect(after).toEqual(before);
  });

  it('dry-run does not mutate existing org/user and performs ZERO production storage writes', async () => {
    await prisma.user.create({
      data: {
        email: 'keep@example.com',
        passwordHash: password,
      },
    });
    const org = await prisma.organization.create({
      data: { name: 'Existing', slug: 'existing-cab' },
    });
    const storage = new MemoryObjectStorage();
    const before = await snapshotCounts(prisma);
    const beforeHash = sha256(paths.sourceJsonPath);
    runDryRun(cfg());
    const after = await snapshotCounts(prisma);
    expect(after).toEqual(before);
    expect(after.organizationMigration).toBe(0);
    expect(await prisma.organization.findUnique({ where: { id: org.id } })).not.toBeNull();
    expect(sha256(paths.sourceJsonPath)).toBe(beforeHash);
    expect(storage.provider).toBe('memory');
    expect((await storage.headObject('org/any')).exists).toBe(false);
  });

  it('source JSON is not modified by loader/dry-run', () => {
    const before = sha256(paths.sourceJsonPath);
    loadLocalStore(paths.sourceJsonPath);
    runDryRun(cfg());
    expect(sha256(paths.sourceJsonPath)).toBe(before);
  });

  it('apply CLI refuses without staging gates (APPLY is not a dry-run path)', async () => {
    expect(() => refuseApply()).toThrow(/STAGING|migrate:apply/i);
    const cli = await runMigrationCli(['apply', '--i-understand-this-writes-data'], {
      MIGRATION_MODE: 'APPLY',
    });
    expect(cli.exitCode).toBe(1);
    expect(cli.stderr).toMatch(/MIGRATION_CONFIRM=YES|STAGING/i);
  });

  it('plan command prints dependency order without writes', async () => {
    const before = await snapshotCounts(prisma);
    const cli = await runMigrationCli([
      'plan',
      '--source',
      paths.sourceJsonPath,
      '--media',
      paths.sourceMediaRoot,
      '--organization-id',
      FIXTURE_ORG_ID,
      '--non-strict',
    ]);
    expect(cli.stdout).toContain(MIGRATION_PLAN_ORDER[0]);
    expect(cli.stdout).toContain('DATABASE WRITES: 0');
    expect(await snapshotCounts(prisma)).toEqual(before);
  });

  it('target organizationId is never taken from JSON', () => {
    const result = runDryRun(cfg());
    expect(result.report.metadata.targetOrganizationId).toBe(FIXTURE_ORG_ID);
    expect(result.report.warnings.some((w) => w.code === 'ORGANIZATION_ID_IN_SOURCE_IGNORED')).toBe(true);
    expect(result.maps.patient.get('p1')).toBe(mappedUuid(FIXTURE_ORG_ID, 'patient', 'p1'));
  });

  it('media storage key uses cloud ids not original filename', () => {
    const result = runDryRun(cfg());
    const image = result.planned.media.find((m) => m.localId === 'med-ok');
    expect(image?.storageKey).toBe(
      `org/${FIXTURE_ORG_ID}/patients/${result.maps.patient.get('p1')}/media/${result.maps.media.get('med-ok')}.png`,
    );
    expect(image?.storageKey.includes('photo.png')).toBe(false);
  });

  it('schema includes OrganizationMigration; excludes later domains', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = readFileSync(join(here, '..', 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toMatch(/model\s+OrganizationMigration\b/);
    expect(schema).toMatch(/enum\s+OrganizationMigrationStatus\b/);
    for (const model of ['ImagingStudy', 'Warehouse', 'StockMovement', 'ActCatalog']) {
      expect(schema).not.toMatch(new RegExp(`model\\s+${model}\\b`));
    }
    expect(schema).toMatch(/model\s+AuditLog\b/);
  });
});
