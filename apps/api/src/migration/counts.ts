import type { PrismaClient } from '@prisma/client';

export async function countOrg(
  prisma: PrismaClient,
  organizationId: string,
): Promise<Record<string, number>> {
  const [
    dentist,
    patient,
    appointment,
    clinicalSession,
    treatment,
    prescription,
    prescriptionItem,
    invoice,
    stockItem,
    prosthesis,
    patientMedia,
    user,
    organization,
    membership,
  ] = await Promise.all([
    prisma.dentist.count({ where: { organizationId } }),
    prisma.patient.count({ where: { organizationId } }),
    prisma.appointment.count({ where: { organizationId } }),
    prisma.clinicalSession.count({ where: { organizationId } }),
    prisma.treatment.count({ where: { organizationId } }),
    prisma.prescription.count({ where: { organizationId } }),
    prisma.prescriptionItem.count({ where: { organizationId } }),
    prisma.invoice.count({ where: { organizationId } }),
    prisma.stockItem.count({ where: { organizationId } }),
    prisma.prosthesis.count({ where: { organizationId } }),
    prisma.patientMedia.count({ where: { organizationId } }),
    prisma.user.count(),
    prisma.organization.count(),
    prisma.membership.count({ where: { organizationId } }),
  ]);
  return {
    dentist,
    patient,
    appointment,
    clinicalSession,
    treatment,
    prescription,
    prescriptionItem,
    invoice,
    stockItem,
    prosthesis,
    patientMedia,
    user,
    organization,
    membership,
  };
}
