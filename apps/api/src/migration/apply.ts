import type { OrganizationMigrationStatus, Prisma, PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { parseCalendarDate } from '../appointments/schemas.js';
import type { ObjectStorage } from '../media/storage.js';
import {
  ApplyGateError,
  assertApplyGates,
  assertStagingTargetOrganization,
  type ApplyGateInput,
} from './apply-gate.js';
import type { MigrationConfig } from './config.js';
import { runDryRun, type DryRunResult, type PlannedEntities } from './dry-run.js';
import { hashFile, hashMediaTree } from './hash.js';
import type { MediaResolution } from './media.js';
import { countOrg } from './counts.js';
import { verifyStagingApply, type VerificationResult } from './verify.js';

/**
 * Staging APPLY write strategy (not one giant transaction):
 *
 * 1. Gates + source hash + dry-run (read-only) + org exists/staging.
 *    A second APPLY on MIGRATED/VERIFIED is allowed and must be idempotent
 *    (alreadyExists, no duplicates).
 * 2. OrganizationMigration DRY_RUN → APPLYING.
 * 3. Per-entity Prisma `$transaction` batches in plan order (Dentists … Prostheses).
 *    Each row is findFirst(id + organizationId) then create — no duplicates.
 * 4. PatientMedia metadata as PENDING, then object PUT + HEAD size check, then READY.
 *    Media bytes are outside the DB transaction (object storage).
 * 5. MIGRATED → verify → VERIFIED or FAILED.
 *
 * Source JSON/media are never opened for write. Production buckets/DBs are gated out.
 */

export type WriteStat = {
  inserted: number;
  alreadyExists: number;
  skipped: number;
};

function emptyStat(): WriteStat {
  return { inserted: 0, alreadyExists: 0, skipped: 0 };
}

export type ApplyReport = {
  metadata: {
    sourcePath: string;
    sourceMediaRoot: string;
    sourceJsonHashBefore: string;
    sourceJsonHashAfter: string;
    sourceJsonUnchanged: boolean;
    sourceMediaHashBefore: string;
    sourceMediaHashAfter: string;
    sourceMediaUnchanged: boolean;
    sourceMediaFileCount: number;
    targetOrganizationId: string;
    environment: 'STAGING' | 'PRODUCTION';
    mode: 'APPLY';
    startedAt: string;
    finishedAt: string;
    status: OrganizationMigrationStatus;
  };
  dryRunOk: boolean;
  inserted: Record<string, number>;
  alreadyExists: Record<string, number>;
  skipped: Record<string, number>;
  sourceCounts: Record<string, number>;
  targetCounts: Record<string, number>;
  expected: Record<string, number>;
  difference: Record<string, number>;
  mappingCounts: DryRunResult['report']['mappings'];
  media: {
    planned: number;
    uploaded: number;
    verified: number;
    missing: number;
    alreadyExists: number;
    failed: number;
  };
  warnings: DryRunResult['report']['warnings'];
  errors: string[];
  verification: VerificationResult | null;
  partialStagingData: string | null;
  ok: boolean;
};

export type ApplyDeps = {
  prisma: PrismaClient;
  storage: ObjectStorage;
  gates: ApplyGateInput;
  /** Production pilot APPLY (Phase 6F.3). Skips staging-only org/bucket gates. */
  mode?: 'STAGING' | 'PRODUCTION';
  /** Test-only: mark APPLYING then throw. */
  failAfterStatus?: boolean;
};

async function upsertMigration(
  prisma: PrismaClient,
  organizationId: string,
  status: OrganizationMigrationStatus,
  extra: {
    lastDryRunAt?: Date;
    lastAppliedAt?: Date;
    lastVerifiedAt?: Date;
    lastFailedAt?: Date;
  } = {},
): Promise<void> {
  const existing = await prisma.organizationMigration.findUnique({
    where: { organizationId },
  });
  if (!existing) {
    await prisma.organizationMigration.create({
      data: {
        organizationId,
        status,
        updatedAt: new Date(),
        ...extra,
      },
    });
    return;
  }
  await prisma.organizationMigration.update({
    where: { id: existing.id },
    data: { status, updatedAt: new Date(), ...extra },
  });
}

async function markFailed(prisma: PrismaClient, organizationId: string): Promise<void> {
  const existing = await prisma.organizationMigration.findUnique({
    where: { organizationId },
  });
  if (!existing) return;
  await prisma.organizationMigration.update({
    where: { id: existing.id },
    data: { status: 'FAILED', lastFailedAt: new Date(), updatedAt: new Date() },
  });
}

function statMap(stats: Record<string, WriteStat>): {
  inserted: Record<string, number>;
  alreadyExists: Record<string, number>;
  skipped: Record<string, number>;
} {
  const inserted: Record<string, number> = {};
  const alreadyExists: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  for (const [key, value] of Object.entries(stats)) {
    inserted[key] = value.inserted;
    alreadyExists[key] = value.alreadyExists;
    skipped[key] = value.skipped;
  }
  return { inserted, alreadyExists, skipped };
}

export async function runApply(
  config: MigrationConfig,
  deps: ApplyDeps,
): Promise<{ report: ApplyReport; dryRun: DryRunResult }> {
  const startedAt = new Date().toISOString();
  const applyMode = deps.mode ?? 'STAGING';
  if (applyMode === 'STAGING') {
    assertApplyGates(deps.gates);
  }
  const orgId = config.targetOrganizationId;
  const errors: string[] = [];

  const sourceJsonHashBefore = hashFile(config.sourceJsonPath);
  const mediaBefore = hashMediaTree(config.sourceMediaRoot);

  const dryRun = runDryRun({ ...config, dryRun: true });
  if (!dryRun.report.ok || dryRun.report.errors.length > 0) {
    throw new ApplyGateError('Refusing APPLY: dry-run has blocking errors.');
  }

  const org = await deps.prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    throw new ApplyGateError(
      'Target organization does not exist. APPLY does not create Organization/User/Membership.',
    );
  }
  if (applyMode === 'STAGING') {
    assertStagingTargetOrganization(org);
  } else if (org.status !== 'ACTIVE') {
    throw new ApplyGateError('Target organization is not ACTIVE.');
  }

  const jsonAfterPre = hashFile(config.sourceJsonPath);
  if (jsonAfterPre !== sourceJsonHashBefore) {
    throw new ApplyGateError('Source JSON changed during pre-apply checks.');
  }

  await upsertMigration(deps.prisma, orgId, 'DRY_RUN', { lastDryRunAt: new Date() });
  await upsertMigration(deps.prisma, orgId, 'APPLYING');

  if (deps.failAfterStatus) {
    await markFailed(deps.prisma, orgId);
    throw new ApplyGateError('Injected APPLY failure after APPLYING.');
  }

  const stats: Record<string, WriteStat> = {
    dentist: emptyStat(),
    patient: emptyStat(),
    appointment: emptyStat(),
    clinicalSession: emptyStat(),
    treatment: emptyStat(),
    prescription: emptyStat(),
    prescriptionItem: emptyStat(),
    invoice: emptyStat(),
    stockItem: emptyStat(),
    prosthesis: emptyStat(),
    patientMedia: emptyStat(),
  };
  stats.dentist.skipped = dryRun.report.counts.dentists.skipped + dryRun.report.counts.dentists.errors;
  stats.patient.skipped = dryRun.report.counts.patients.skipped + dryRun.report.counts.patients.errors;
  stats.appointment.skipped =
    dryRun.report.counts.appointments.skipped + dryRun.report.counts.appointments.errors;
  stats.clinicalSession.skipped =
    dryRun.report.counts.sessions.skipped + dryRun.report.counts.sessions.errors;
  stats.treatment.skipped = dryRun.report.counts.treatments.skipped + dryRun.report.counts.treatments.errors;
  stats.prescription.skipped =
    dryRun.report.counts.prescriptions.skipped + dryRun.report.counts.prescriptions.errors;
  stats.prescriptionItem.skipped = dryRun.report.counts.prescriptionLines.skipped;
  stats.invoice.skipped = dryRun.report.counts.invoices.skipped + dryRun.report.counts.invoices.errors;
  stats.stockItem.skipped = dryRun.report.counts.stockItems.skipped + dryRun.report.counts.stockItems.errors;
  stats.prosthesis.skipped =
    dryRun.report.counts.prostheses.skipped + dryRun.report.counts.prostheses.errors;
  stats.patientMedia.skipped =
    dryRun.report.counts.mediaFiles.skipped + dryRun.report.counts.mediaFiles.errors;

  const planned = dryRun.planned;
  const mediaStats = {
    planned: planned.media.length,
    uploaded: 0,
    verified: 0,
    missing: dryRun.report.missingMedia.filter((i) => i.code === 'MISSING_MEDIA').length,
    alreadyExists: 0,
    failed: 0,
  };

  try {
    await insertDentists(deps.prisma, orgId, planned, stats.dentist);
    await insertPatients(deps.prisma, orgId, planned, stats.patient);
    await insertAppointments(deps.prisma, orgId, planned, stats.appointment);
    await insertSessions(deps.prisma, orgId, planned, stats.clinicalSession);
    await insertTreatments(deps.prisma, orgId, planned, stats.treatment);
    await insertPrescriptions(deps.prisma, orgId, planned, stats);
    await insertInvoices(deps.prisma, orgId, planned, stats.invoice);
    await insertStock(deps.prisma, orgId, planned, stats.stockItem);
    await insertProstheses(deps.prisma, orgId, planned, stats.prosthesis);
    await insertMediaAndObjects(
      deps,
      orgId,
      planned,
      dryRun.mediaResolutions,
      stats.patientMedia,
      mediaStats,
    );

    await upsertMigration(deps.prisma, orgId, 'MIGRATED', { lastAppliedAt: new Date() });

    const sourceJsonHashAfter = hashFile(config.sourceJsonPath);
    const mediaAfter = hashMediaTree(config.sourceMediaRoot);
    if (sourceJsonHashBefore !== sourceJsonHashAfter) {
      errors.push('Source JSON was modified during APPLY.');
    }
    if (mediaBefore.hash !== mediaAfter.hash) {
      errors.push('Source media was modified during APPLY.');
    }

    const verification = await verifyStagingApply(deps.prisma, orgId, planned, deps.storage);
    if (!verification.ok) {
      errors.push(...verification.errors);
    }
    if (verification.ok && errors.length === 0) {
      await upsertMigration(deps.prisma, orgId, 'VERIFIED', { lastVerifiedAt: new Date() });
    } else {
      await markFailed(deps.prisma, orgId);
    }
    const targetCounts = await countOrg(deps.prisma, orgId);
    const expected: Record<string, number> = {
      dentist: planned.dentists.length,
      patient: planned.patients.length,
      appointment: planned.appointments.length,
      clinicalSession: planned.sessions.length,
      treatment: planned.treatments.length,
      prescription: planned.prescriptions.length,
      prescriptionItem: planned.prescriptions.reduce((n, rx) => n + rx.lines.length, 0),
      invoice: planned.invoices.length,
      stockItem: planned.stock.length,
      prosthesis: planned.prostheses.length,
      patientMedia: planned.media.length,
    };
    const difference: Record<string, number> = {};
    for (const key of Object.keys(expected)) {
      difference[key] = (targetCounts[key] ?? 0) - (expected[key] ?? 0);
    }

    const row = await deps.prisma.organizationMigration.findUnique({
      where: { organizationId: orgId },
    });
    const mapped = statMap(stats);
    const report: ApplyReport = {
      metadata: {
        sourcePath: config.sourceJsonPath,
        sourceMediaRoot: config.sourceMediaRoot,
        sourceJsonHashBefore,
        sourceJsonHashAfter,
        sourceJsonUnchanged: sourceJsonHashBefore === sourceJsonHashAfter,
        sourceMediaHashBefore: mediaBefore.hash,
        sourceMediaHashAfter: mediaAfter.hash,
        sourceMediaUnchanged: mediaBefore.hash === mediaAfter.hash,
        sourceMediaFileCount: mediaAfter.count,
        targetOrganizationId: orgId,
        environment: applyMode,
        mode: 'APPLY',
        startedAt,
        finishedAt: new Date().toISOString(),
        status: row?.status ?? 'FAILED',
      },
      dryRunOk: true,
      inserted: mapped.inserted,
      alreadyExists: mapped.alreadyExists,
      skipped: mapped.skipped,
      sourceCounts: {
        dentist: dryRun.report.counts.dentists.source,
        patient: dryRun.report.counts.patients.source,
        appointment: dryRun.report.counts.appointments.source,
        clinicalSession: dryRun.report.counts.sessions.source,
        treatment: dryRun.report.counts.treatments.source,
        prescription: dryRun.report.counts.prescriptions.source,
        prescriptionItem: dryRun.report.counts.prescriptionLines.source,
        invoice: dryRun.report.counts.invoices.source,
        stockItem: dryRun.report.counts.stockItems.source,
        prosthesis: dryRun.report.counts.prostheses.source,
        patientMedia: dryRun.report.counts.mediaFiles.source,
      },
      targetCounts,
      expected,
      difference,
      mappingCounts: dryRun.report.mappings,
      media: mediaStats,
      warnings: dryRun.report.warnings,
      errors,
      verification,
      partialStagingData:
        verification.ok && errors.length === 0
          ? null
          : 'Staging clinical rows and/or media objects may remain for this organization. Use migrate:rollback (STAGING-gated). Production is never cleaned up.',
      ok: verification.ok && errors.length === 0,
    };
    return { report, dryRun };
  } catch (error) {
    await markFailed(deps.prisma, orgId);
    throw error;
  }
}

async function insertDentists(
  prisma: PrismaClient,
  organizationId: string,
  planned: PlannedEntities,
  stat: WriteStat,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const row of planned.dentists) {
      const existing = await tx.dentist.findFirst({
        where: { id: row.cloudId, organizationId },
      });
      if (existing) {
        stat.alreadyExists += 1;
        continue;
      }
      await tx.dentist.create({
        data: {
          id: row.cloudId,
          organizationId,
          firstName: row.firstName,
          lastName: row.lastName,
          specialty: row.specialty,
          photo: row.photo,
          color: row.color,
          updatedAt: new Date(),
        },
      });
      stat.inserted += 1;
    }
  });
}

async function insertPatients(
  prisma: PrismaClient,
  organizationId: string,
  planned: PlannedEntities,
  stat: WriteStat,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const row of planned.patients) {
      const existing = await tx.patient.findFirst({
        where: { id: row.cloudId, organizationId },
      });
      if (existing) {
        stat.alreadyExists += 1;
        continue;
      }
      await tx.patient.create({
        data: {
          id: row.cloudId,
          organizationId,
          firstName: row.firstName,
          lastName: row.lastName,
          phone: row.phone,
          age: row.age,
          birthDate: row.birthDate ?? null,
          address: row.address,
          antecedents: row.antecedents,
          hasAllergies: row.hasAllergies,
          dentistId: row.dentistId,
          teeth: row.teeth as Prisma.InputJsonValue,
          notes: row.notes,
          updatedAt: new Date(),
        },
      });
      stat.inserted += 1;
    }
  });
}

async function insertAppointments(
  prisma: PrismaClient,
  organizationId: string,
  planned: PlannedEntities,
  stat: WriteStat,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const row of planned.appointments) {
      const existing = await tx.appointment.findFirst({
        where: { id: row.cloudId, organizationId },
      });
      if (existing) {
        stat.alreadyExists += 1;
        continue;
      }
      await tx.appointment.create({
        data: {
          id: row.cloudId,
          organizationId,
          patientId: row.patientId,
          date: parseCalendarDate(row.date),
          time: row.time,
          durationMin: row.durationMin,
          patientName: row.patientName,
          patientPhone: row.patientPhone,
          motif: row.motif,
          practitioner: row.practitioner,
          dentistId: row.dentistId,
          status: row.status,
          category: row.category,
          updatedAt: new Date(),
        },
      });
      stat.inserted += 1;
    }
  });
}

async function insertSessions(
  prisma: PrismaClient,
  organizationId: string,
  planned: PlannedEntities,
  stat: WriteStat,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const row of planned.sessions) {
      const existing = await tx.clinicalSession.findFirst({
        where: { id: row.cloudId, organizationId },
      });
      if (existing) {
        stat.alreadyExists += 1;
        continue;
      }
      await tx.clinicalSession.create({
        data: {
          id: row.cloudId,
          organizationId,
          patientId: row.patientId,
          date: parseCalendarDate(row.date),
          time: row.time,
          teeth: row.teeth as Prisma.InputJsonValue,
          acts: row.acts,
          notes: row.notes,
          prescription: row.prescription,
          updatedAt: new Date(),
        },
      });
      stat.inserted += 1;
    }
  });
}

async function insertTreatments(
  prisma: PrismaClient,
  organizationId: string,
  planned: PlannedEntities,
  stat: WriteStat,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const row of planned.treatments) {
      const existing = await tx.treatment.findFirst({
        where: { id: row.cloudId, organizationId },
      });
      if (existing) {
        stat.alreadyExists += 1;
        continue;
      }
      await tx.treatment.create({
        data: {
          id: row.cloudId,
          organizationId,
          patientId: row.patientId,
          date: parseCalendarDate(row.date),
          tooth: row.tooth,
          act: row.act,
          code: row.code,
          cost: row.cost,
          comment: row.comment,
          careStatus: row.careStatus,
          paymentStatus: row.paymentStatus,
          actId: row.actId,
          updatedAt: new Date(),
        },
      });
      stat.inserted += 1;
    }
  });
}

async function insertPrescriptions(
  prisma: PrismaClient,
  organizationId: string,
  planned: PlannedEntities,
  stats: Record<string, WriteStat>,
): Promise<void> {
  for (const row of planned.prescriptions) {
    const existing = await prisma.prescription.findFirst({
      where: { id: row.cloudId, organizationId },
      include: { lines: true },
    });
    if (existing) {
      stats.prescription.alreadyExists += 1;
      stats.prescriptionItem.alreadyExists += existing.lines.length;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      await tx.prescription.create({
        data: {
          id: row.cloudId,
          organizationId,
          patientId: row.patientId,
          patientName: row.patientName,
          date: parseCalendarDate(row.date),
          title: row.title,
          templateId: row.templateId,
          advice: row.advice,
          dentistId: row.dentistId,
          dentistName: row.dentistName,
          updatedAt: new Date(),
        },
      });
      for (const line of row.lines) {
        await tx.prescriptionItem.create({
          data: {
            id: line.cloudId,
            organizationId,
            prescriptionId: row.cloudId,
            drug: line.drug,
            posology: line.posology,
            duration: line.duration,
            notes: line.notes,
            sortOrder: line.sortOrder,
          },
        });
      }
    });
    stats.prescription.inserted += 1;
    stats.prescriptionItem.inserted += row.lines.length;
  }
}

async function insertInvoices(
  prisma: PrismaClient,
  organizationId: string,
  planned: PlannedEntities,
  stat: WriteStat,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const row of planned.invoices) {
      const existing = await tx.invoice.findFirst({
        where: { id: row.cloudId, organizationId },
      });
      if (existing) {
        stat.alreadyExists += 1;
        continue;
      }
      await tx.invoice.create({
        data: {
          id: row.cloudId,
          organizationId,
          patientId: row.patientId,
          patientName: row.patientName,
          label: row.label,
          amount: row.amount,
          paid: row.paid,
          date: parseCalendarDate(row.date),
          treatmentId: row.treatmentId,
          updatedAt: new Date(),
        },
      });
      stat.inserted += 1;
    }
  });
}

async function insertStock(
  prisma: PrismaClient,
  organizationId: string,
  planned: PlannedEntities,
  stat: WriteStat,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const row of planned.stock) {
      const existing = await tx.stockItem.findFirst({
        where: { id: row.cloudId, organizationId },
      });
      if (existing) {
        stat.alreadyExists += 1;
        continue;
      }
      await tx.stockItem.create({
        data: {
          id: row.cloudId,
          organizationId,
          code: row.code,
          name: row.name,
          category: row.category,
          quantity: row.quantity,
          minQuantity: row.minQuantity,
          unitPrice: row.unitPrice,
          addedAt: parseCalendarDate(row.addedAt),
          expiryDate: row.expiryDate ? parseCalendarDate(row.expiryDate) : null,
          supplier: row.supplier,
          updatedAt: new Date(),
        },
      });
      stat.inserted += 1;
    }
  });
}

async function insertProstheses(
  prisma: PrismaClient,
  organizationId: string,
  planned: PlannedEntities,
  stat: WriteStat,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const row of planned.prostheses) {
      const existing = await tx.prosthesis.findFirst({
        where: { id: row.cloudId, organizationId },
      });
      if (existing) {
        stat.alreadyExists += 1;
        continue;
      }
      await tx.prosthesis.create({
        data: {
          id: row.cloudId,
          organizationId,
          patientId: row.patientId,
          patientName: row.patientName,
          type: row.type,
          tooth: row.tooth,
          lab: row.lab,
          sentAt: parseCalendarDate(row.sentAt),
          expectedAt: row.expectedAt ? parseCalendarDate(row.expectedAt) : null,
          notes: row.notes,
          status: row.status,
          updatedAt: new Date(),
        },
      });
      stat.inserted += 1;
    }
  });
}

async function insertMediaAndObjects(
  deps: ApplyDeps,
  organizationId: string,
  planned: PlannedEntities,
  resolutions: MediaResolution[],
  stat: WriteStat,
  mediaStats: ApplyReport['media'],
): Promise<void> {
  const byLocalId = new Map(resolutions.map((item) => [item.localId, item]));
  for (const row of planned.media) {
    const existing = await deps.prisma.patientMedia.findFirst({
      where: { id: row.cloudId, organizationId },
    });
    if (existing) {
      stat.alreadyExists += 1;
      mediaStats.alreadyExists += 1;
    } else {
      await deps.prisma.patientMedia.create({
        data: {
          id: row.cloudId,
          organizationId,
          patientId: row.patientId,
          storageKey: row.storageKey,
          title: row.title,
          kind: row.kind,
          mime: row.mime,
          originalName: row.originalName,
          size: row.size,
          status: 'PENDING',
          updatedAt: new Date(),
        },
      });
      stat.inserted += 1;
    }

    const current = await deps.prisma.patientMedia.findFirst({
      where: { id: row.cloudId, organizationId },
    });
    if (current?.status === 'READY') {
      const head = await deps.storage.headObject(current.storageKey);
      if (head.exists && head.size === current.size) continue;
    }

    const resolved = byLocalId.get(row.localId);
    if (!resolved?.diskPath || !resolved.found) {
      mediaStats.failed += 1;
      continue;
    }
    const body = readFileSync(resolved.diskPath);
    await deps.storage.putObject(row.storageKey, body, row.mime || 'application/octet-stream');
    mediaStats.uploaded += 1;
    const head = await deps.storage.headObject(row.storageKey);
    if (!head.exists || head.size !== body.length) {
      mediaStats.failed += 1;
      continue;
    }
    await deps.prisma.patientMedia.updateMany({
      where: { id: row.cloudId, organizationId },
      data: { status: 'READY', size: body.length, updatedAt: new Date() },
    });
    mediaStats.verified += 1;
  }
}
