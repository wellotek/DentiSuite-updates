import type { PrismaClient } from '@prisma/client';
import type { ObjectStorage } from '../media/storage.js';
import { ApplyGateError, assertApplyGates, assertStagingTargetOrganization, type ApplyGateInput } from './apply-gate.js';

/**
 * Staging-only rollback: delete migrated clinical rows for one Organization.
 * Not exposed on the public HTTP API.
 */
export async function rollbackStagingMigration(opts: {
  prisma: PrismaClient;
  storage: ObjectStorage;
  organizationId: string;
  gates: ApplyGateInput;
}): Promise<{ deleted: Record<string, number> }> {
  assertApplyGates(opts.gates);
  const org = await opts.prisma.organization.findUnique({
    where: { id: opts.organizationId },
  });
  if (!org) {
    throw new ApplyGateError('Target organization does not exist.');
  }
  assertStagingTargetOrganization(org);

  const media = await opts.prisma.patientMedia.findMany({
    where: { organizationId: opts.organizationId },
    select: { storageKey: true },
  });
  for (const row of media) {
    try {
      await opts.storage.deleteObject(row.storageKey);
    } catch {
      /* staging best-effort object delete */
    }
  }

  const organizationId = opts.organizationId;
  const deleted = {
    prosthesis: (await opts.prisma.prosthesis.deleteMany({ where: { organizationId } })).count,
    stockItem: (await opts.prisma.stockItem.deleteMany({ where: { organizationId } })).count,
    invoice: (await opts.prisma.invoice.deleteMany({ where: { organizationId } })).count,
    patientMedia: (await opts.prisma.patientMedia.deleteMany({ where: { organizationId } })).count,
    prescriptionItem: (await opts.prisma.prescriptionItem.deleteMany({ where: { organizationId } })).count,
    prescription: (await opts.prisma.prescription.deleteMany({ where: { organizationId } })).count,
    treatment: (await opts.prisma.treatment.deleteMany({ where: { organizationId } })).count,
    clinicalSession: (await opts.prisma.clinicalSession.deleteMany({ where: { organizationId } })).count,
    appointment: (await opts.prisma.appointment.deleteMany({ where: { organizationId } })).count,
    dentist: (await opts.prisma.dentist.deleteMany({ where: { organizationId } })).count,
    patient: (await opts.prisma.patient.deleteMany({ where: { organizationId } })).count,
  };

  await opts.prisma.organizationMigration.updateMany({
    where: { organizationId },
    data: { status: 'ABANDONED', updatedAt: new Date() },
  });

  return { deleted };
}
