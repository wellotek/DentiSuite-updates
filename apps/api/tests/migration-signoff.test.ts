import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { resetAuthTables, startTestDatabase, stopTestDatabase } from './helpers/test-db.js';
import { parseMigrationConfig } from '../src/migration/config.js';
import { runDryRun } from '../src/migration/dry-run.js';
import { runApply } from '../src/migration/apply.js';
import { rollbackStagingMigration } from '../src/migration/rollback.js';
import { hashFile, hashMediaTree } from '../src/migration/hash.js';
import { mappedUuid } from '../src/migration/ids.js';
import { classifyOperatorReview, differenceFail, moneyParity, STAGING_6C_ORG_ID } from '../src/migration/signoff.js';
import { writeApplyReportJson, reportLooksLikeItContainsSecrets } from '../src/migration/report.js';
import { MemoryObjectStorage } from '../src/media/storage.js';
import { formatCalendarDate } from '../src/appointments/schemas.js';

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, '..');
const SOURCE_JSON = join(apiRoot, 'tmp', 'staging-6c-source', 'dentisuite-store.json');
const SOURCE_MEDIA = join(apiRoot, 'tmp', 'staging-6c-source', 'media');
const REPORT_PATH = join(apiRoot, 'tmp', 'migration-apply-report.json');
const hasRealCopy = existsSync(SOURCE_JSON) && existsSync(SOURCE_MEDIA);

const STAGING_GATES = {
  migrationMode: 'APPLY',
  migrationConfirm: 'YES',
  migrationEnv: 'STAGING',
  nodeEnv: 'test',
  r2Bucket: 'dentisuite-staging-6c',
  databaseUrl: 'postgresql://dentisuite:dentisuite@127.0.0.1:5432/dentisuite_test',
};

describe.skipIf(!hasRealCopy)('Phase 6C real staging sign-off', () => {
  let prisma: PrismaClient;
  let storage: MemoryObjectStorage;
  let userId: string;
  let membershipId: string;

  beforeAll(async () => {
    ({ prisma } = await startTestDatabase());
    await resetAuthTables(prisma);
    storage = new MemoryObjectStorage();
    await prisma.organization.create({
      data: {
        id: STAGING_6C_ORG_ID,
        name: 'DentiSuite Staging 6C',
        slug: 'dentisuite-staging-6c',
      },
    });
    const user = await prisma.user.create({
      data: { email: 'staging-6c@example.test', passwordHash: 'not-a-login-hash' },
    });
    userId = user.id;
    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: STAGING_6C_ORG_ID,
        role: 'ADMIN',
      },
    });
    membershipId = membership.id;
  }, 120_000);

  afterAll(async () => {
    await stopTestDatabase();
  });

  function cfg() {
    return parseMigrationConfig({
      sourceJsonPath: SOURCE_JSON,
      sourceMediaRoot: SOURCE_MEDIA,
      targetOrganizationId: STAGING_6C_ORG_ID,
      dryRun: true,
      strict: true,
    });
  }

  it('dry-run → APPLY → idempotent re-APPLY → rollback → re-APPLY', async () => {
    const jsonBefore = hashFile(SOURCE_JSON);
    const mediaBefore = hashMediaTree(SOURCE_MEDIA);

    const dry = runDryRun(cfg());
    expect(dry.report.ok).toBe(true);
    expect(dry.report.errors).toHaveLength(0);
    const review = classifyOperatorReview(dry);
    expect(review.find((r) => r.category === 'walk-in invoices')?.count).toBeGreaterThan(0);
    expect(review.find((r) => r.category === 'missing media')?.count).toBeGreaterThan(0);
    expect(review.find((r) => r.category === 'deferred settings')?.action).toBe('DEFERRED');
    expect(review.find((r) => r.category === 'deferred act catalog')?.action).toBe('DEFERRED');
    expect(moneyParity(dry).ok).toBe(true);

    const first = await runApply(cfg(), { prisma, storage, gates: STAGING_GATES });
    writeApplyReportJson(REPORT_PATH, first.report);
    expect(first.report.ok).toBe(true);
    expect(first.report.metadata.status).toBe('VERIFIED');
    expect(first.report.metadata.environment).toBe('STAGING');
    expect(differenceFail(first.report)).toEqual([]);
    expect(first.report.verification?.ok).toBe(true);
    expect(first.report.verification?.sessionPrescriptionSeparated).toBe(true);
    expect(first.report.verification?.envoyePreserved).toBe(true);
    expect(hashFile(SOURCE_JSON)).toBe(jsonBefore);
    expect(hashMediaTree(SOURCE_MEDIA).hash).toBe(mediaBefore.hash);
    expect(reportLooksLikeItContainsSecrets(first.report)).toBe(false);

    const patients = await prisma.patient.findMany({
      where: { organizationId: STAGING_6C_ORG_ID },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });
    expect(patients).toHaveLength(5);
    for (const src of dry.planned.patients.slice(0, 5)) {
      const row = patients.find((p) => p.id === src.cloudId) ??
        (await prisma.patient.findFirst({ where: { id: src.cloudId, organizationId: STAGING_6C_ORG_ID } }));
      expect(row?.firstName).toBe(src.firstName);
      expect(row?.phone).toBe(src.phone);
      expect(row?.dentistId).toBe(src.dentistId);
    }
    for (const src of dry.planned.appointments.slice(0, 5)) {
      const row = await prisma.appointment.findFirst({
        where: { id: src.cloudId, organizationId: STAGING_6C_ORG_ID },
      });
      expect(row?.patientName).toBe(src.patientName);
      expect(row?.patientPhone).toBe(src.patientPhone);
      expect(row?.practitioner).toBe(src.practitioner);
      expect(formatCalendarDate(row!.date)).toBe(src.date);
    }
    for (const src of dry.planned.sessions.slice(0, 5)) {
      const row = await prisma.clinicalSession.findFirst({
        where: { id: src.cloudId, organizationId: STAGING_6C_ORG_ID },
      });
      expect(row?.prescription).toBe(src.prescription);
    }
    for (const src of dry.planned.treatments.slice(0, 5)) {
      const row = await prisma.treatment.findFirst({
        where: { id: src.cloudId, organizationId: STAGING_6C_ORG_ID },
      });
      expect(Number(row?.cost)).toBe(src.cost);
      expect(Number.isInteger(Number(row?.cost))).toBe(true);
      expect(row?.act).toBe(src.act);
      expect(row?.code).toBe(src.code);
      expect(row?.actId).toBe(src.actId);
    }
    for (const src of dry.planned.prescriptions.slice(0, 5)) {
      const row = await prisma.prescription.findFirst({
        where: { id: src.cloudId, organizationId: STAGING_6C_ORG_ID },
      });
      expect(row?.patientName).toBe(src.patientName);
      expect(row?.dentistName).toBe(src.dentistName);
    }
    for (const src of dry.planned.invoices.slice(0, 5)) {
      const row = await prisma.invoice.findFirst({
        where: { id: src.cloudId, organizationId: STAGING_6C_ORG_ID },
      });
      expect(row?.patientName).toBe(src.patientName);
      expect(row?.amount).toBe(src.amount);
      expect(Number.isInteger(row?.amount)).toBe(true);
    }
    for (const src of dry.planned.dentists.slice(0, 3)) {
      const row = await prisma.dentist.findFirst({
        where: { id: src.cloudId, organizationId: STAGING_6C_ORG_ID },
      });
      expect(row?.lastName).toBe(src.lastName);
    }
    for (const src of dry.planned.stock.slice(0, 3)) {
      const row = await prisma.stockItem.findFirst({
        where: { id: src.cloudId, organizationId: STAGING_6C_ORG_ID },
      });
      expect(row?.code).toBe(src.code);
      expect(row?.unitPrice).toBe(src.unitPrice);
    }
    for (const src of dry.planned.prostheses.slice(0, 3)) {
      const row = await prisma.prosthesis.findFirst({
        where: { id: src.cloudId, organizationId: STAGING_6C_ORG_ID },
      });
      expect(row?.patientName).toBe(src.patientName);
      expect(row?.status).toBe(src.status);
    }
    const envoye = await prisma.prosthesis.findMany({
      where: { organizationId: STAGING_6C_ORG_ID, status: 'envoye' },
    });
    expect(envoye.length).toBeGreaterThan(0);
    expect(envoye.every((p) => p.status === 'envoye')).toBe(true);

    const missingId = mappedUuid(STAGING_6C_ORG_ID, 'media', 'med-6c-missing-probe');
    expect(await prisma.patientMedia.findFirst({ where: { id: missingId } })).toBeNull();

    const images = await prisma.patientMedia.findMany({
      where: { organizationId: STAGING_6C_ORG_ID, kind: 'image', status: 'READY' },
    });
    expect(images.length).toBeGreaterThanOrEqual(1);
    const downloaded = await storage.getObject(images[0]!.storageKey);
    expect(downloaded).not.toBeNull();
    expect(downloaded!.body.length).toBe(images[0]!.size);
    expect(images[0]!.storageKey.startsWith(`org/${STAGING_6C_ORG_ID}/`)).toBe(true);
    const dicom = await prisma.patientMedia.findMany({
      where: { organizationId: STAGING_6C_ORG_ID, kind: 'dicom' },
    });
    expect(dicom).toHaveLength(0);

    const store = JSON.parse(readFileSync(SOURCE_JSON, 'utf8')) as {
      clinic: { settings?: { name?: string }; actCatalog?: unknown[] };
    };
    const org = await prisma.organization.findUnique({ where: { id: STAGING_6C_ORG_ID } });
    expect(org?.name).toBe('DentiSuite Staging 6C');
    expect(org?.name).not.toBe(store.clinic.settings?.name);
    expect(Array.isArray(store.clinic.actCatalog)).toBe(true);

    const second = await runApply(cfg(), { prisma, storage, gates: STAGING_GATES });
    expect(second.report.ok).toBe(true);
    expect(second.report.alreadyExists.patient).toBe(dry.planned.patients.length);
    expect(second.report.inserted.patient).toBe(0);
    expect(await prisma.patient.count({ where: { organizationId: STAGING_6C_ORG_ID } })).toBe(
      dry.planned.patients.length,
    );
    expect(await prisma.appointment.count({ where: { organizationId: STAGING_6C_ORG_ID } })).toBe(
      dry.planned.appointments.length,
    );

    const rollback = await rollbackStagingMigration({
      prisma,
      storage,
      organizationId: STAGING_6C_ORG_ID,
      gates: STAGING_GATES,
    });
    expect(rollback.deleted.patient).toBe(dry.planned.patients.length);
    expect(await prisma.patient.count({ where: { organizationId: STAGING_6C_ORG_ID } })).toBe(0);
    expect(await prisma.patientMedia.count({ where: { organizationId: STAGING_6C_ORG_ID } })).toBe(0);
    expect(await prisma.organization.findUnique({ where: { id: STAGING_6C_ORG_ID } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull();
    expect(await prisma.membership.findUnique({ where: { id: membershipId } })).not.toBeNull();
    expect(hashFile(SOURCE_JSON)).toBe(jsonBefore);

    const third = await runApply(cfg(), { prisma, storage, gates: STAGING_GATES });
    expect(third.report.ok).toBe(true);
    expect(third.report.metadata.status).toBe('VERIFIED');
    expect(third.report.inserted.patient).toBe(dry.planned.patients.length);
    expect(await prisma.patient.count({ where: { organizationId: STAGING_6C_ORG_ID } })).toBe(
      dry.planned.patients.length,
    );
    expect(hashFile(SOURCE_JSON)).toBe(jsonBefore);
    expect(hashMediaTree(SOURCE_MEDIA).hash).toBe(mediaBefore.hash);
  }, 120_000);
});
