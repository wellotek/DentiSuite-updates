import type { PrismaClient } from '@prisma/client';
import { formatCalendarDate } from '../appointments/schemas.js';
import type { ObjectStorage } from '../media/storage.js';
import type { PlannedEntities } from './dry-run.js';
import { countOrg } from './counts.js';

export type VerificationResult = {
  ok: boolean;
  errors: string[];
  countParity: Record<string, { expected: number; actual: number; difference: number }>;
  samplesChecked: number;
  sessionPrescriptionSeparated: boolean;
  envoyePreserved: boolean;
};

function take<T>(items: T[], n: number): T[] {
  return items.slice(0, Math.min(n, items.length));
}

export async function verifyStagingApply(
  prisma: PrismaClient,
  organizationId: string,
  planned: PlannedEntities,
  storage: ObjectStorage,
): Promise<VerificationResult> {
  const errors: string[] = [];
  const actual = await countOrg(prisma, organizationId);
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
  const countParity: VerificationResult['countParity'] = {};
  for (const [key, exp] of Object.entries(expected)) {
    const act = actual[key] ?? 0;
    countParity[key] = { expected: exp, actual: act, difference: act - exp };
    if (act !== exp) {
      errors.push(`Count mismatch ${key}: expected ${exp} actual ${act}`);
    }
  }

  const dentistIds = new Set(
    (await prisma.dentist.findMany({ where: { organizationId }, select: { id: true } })).map((d) => d.id),
  );
  const patientIds = new Set(
    (await prisma.patient.findMany({ where: { organizationId }, select: { id: true } })).map((p) => p.id),
  );
  const treatmentIds = new Set(
    (await prisma.treatment.findMany({ where: { organizationId }, select: { id: true } })).map((t) => t.id),
  );

  const patients = await prisma.patient.findMany({ where: { organizationId } });
  for (const row of patients) {
    if (row.dentistId && !dentistIds.has(row.dentistId)) {
      errors.push(`Dangling Patient.dentistId ${row.dentistId}`);
    }
  }

  const appointments = await prisma.appointment.findMany({ where: { organizationId } });
  for (const row of appointments) {
    if (!patientIds.has(row.patientId)) errors.push(`Dangling Appointment.patientId ${row.patientId}`);
    if (row.dentistId && !dentistIds.has(row.dentistId)) {
      errors.push(`Dangling Appointment.dentistId ${row.dentistId}`);
    }
  }

  for (const row of await prisma.clinicalSession.findMany({ where: { organizationId } })) {
    if (!patientIds.has(row.patientId)) errors.push(`Dangling ClinicalSession.patientId ${row.patientId}`);
  }
  for (const row of await prisma.treatment.findMany({ where: { organizationId } })) {
    if (!patientIds.has(row.patientId)) errors.push(`Dangling Treatment.patientId ${row.patientId}`);
  }
  const prescriptions = await prisma.prescription.findMany({
    where: { organizationId },
    include: { lines: true },
  });
  for (const row of prescriptions) {
    if (!patientIds.has(row.patientId)) errors.push(`Dangling Prescription.patientId ${row.patientId}`);
    if (row.dentistId && !dentistIds.has(row.dentistId)) {
      errors.push(`Dangling Prescription.dentistId ${row.dentistId}`);
    }
  }
  const prescriptionIds = new Set(prescriptions.map((p) => p.id));
  for (const row of await prisma.prescriptionItem.findMany({ where: { organizationId } })) {
    if (!prescriptionIds.has(row.prescriptionId)) {
      errors.push(`Dangling PrescriptionItem.prescriptionId ${row.prescriptionId}`);
    }
  }
  for (const row of await prisma.invoice.findMany({ where: { organizationId } })) {
    if (!patientIds.has(row.patientId)) errors.push(`Dangling Invoice.patientId ${row.patientId}`);
    if (row.treatmentId && !treatmentIds.has(row.treatmentId)) {
      errors.push(`Dangling Invoice.treatmentId ${row.treatmentId}`);
    }
  }
  for (const row of await prisma.prosthesis.findMany({ where: { organizationId } })) {
    if (!patientIds.has(row.patientId)) errors.push(`Dangling Prosthesis.patientId ${row.patientId}`);
  }
  for (const row of await prisma.patientMedia.findMany({ where: { organizationId } })) {
    if (!patientIds.has(row.patientId)) errors.push(`Dangling PatientMedia.patientId ${row.patientId}`);
  }

  const foreign = await prisma.patient.count({
    where: { organizationId: { not: organizationId }, id: { in: [...patientIds] } },
  });
  if (foreign > 0) errors.push('Patient ids leaked across tenants');

  let samplesChecked = 0;
  for (const src of take(planned.patients, 5)) {
    const row = await prisma.patient.findFirst({ where: { id: src.cloudId, organizationId } });
    samplesChecked += 1;
    if (!row || row.firstName !== src.firstName || row.phone !== src.phone || row.dentistId !== src.dentistId) {
      errors.push(`Patient sample mismatch ${src.localId}`);
    }
  }
  for (const src of take(planned.appointments, 5)) {
    const row = await prisma.appointment.findFirst({ where: { id: src.cloudId, organizationId } });
    samplesChecked += 1;
    if (
      !row ||
      row.patientName !== src.patientName ||
      row.patientPhone !== src.patientPhone ||
      row.practitioner !== src.practitioner ||
      formatCalendarDate(row.date) !== src.date ||
      row.time !== src.time
    ) {
      errors.push(`Appointment snapshot mismatch ${src.localId}`);
    }
  }
  for (const src of take(planned.sessions, 5)) {
    const row = await prisma.clinicalSession.findFirst({ where: { id: src.cloudId, organizationId } });
    samplesChecked += 1;
    if (!row || row.prescription !== src.prescription) {
      errors.push(`ClinicalSession mismatch ${src.localId}`);
    }
  }
  for (const src of take(planned.treatments, 5)) {
    const row = await prisma.treatment.findFirst({ where: { id: src.cloudId, organizationId } });
    samplesChecked += 1;
    if (!row || row.act !== src.act || Number(row.cost) !== src.cost || row.actId !== src.actId) {
      errors.push(`Treatment mismatch ${src.localId}`);
    }
  }
  for (const src of take(planned.prescriptions, 5)) {
    const row = await prisma.prescription.findFirst({
      where: { id: src.cloudId, organizationId },
      include: { lines: true },
    });
    samplesChecked += 1;
    if (!row || row.patientName !== src.patientName || row.dentistName !== src.dentistName || row.lines.length !== src.lines.length) {
      errors.push(`Prescription mismatch ${src.localId}`);
    }
  }
  for (const src of take(planned.invoices, 5)) {
    const row = await prisma.invoice.findFirst({ where: { id: src.cloudId, organizationId } });
    samplesChecked += 1;
    if (!row || row.patientName !== src.patientName || row.amount !== src.amount || row.treatmentId !== src.treatmentId) {
      errors.push(`Invoice mismatch ${src.localId}`);
    }
  }
  for (const src of take(planned.dentists, 3)) {
    const row = await prisma.dentist.findFirst({ where: { id: src.cloudId, organizationId } });
    samplesChecked += 1;
    if (!row || row.lastName !== src.lastName) errors.push(`Dentist mismatch ${src.localId}`);
  }
  for (const src of take(planned.stock, 3)) {
    const row = await prisma.stockItem.findFirst({ where: { id: src.cloudId, organizationId } });
    samplesChecked += 1;
    if (!row || row.code !== src.code || row.unitPrice !== src.unitPrice) {
      errors.push(`Stock mismatch ${src.localId}`);
    }
  }
  for (const src of take(planned.prostheses, 3)) {
    const row = await prisma.prosthesis.findFirst({ where: { id: src.cloudId, organizationId } });
    samplesChecked += 1;
    if (!row || row.status !== src.status || row.patientName !== src.patientName) {
      errors.push(`Prosthesis mismatch ${src.localId}`);
    }
  }

  const freeText = planned.sessions.map((s) => s.prescription).filter((t) => t.trim().length > 0);
  let sessionPrescriptionSeparated = true;
  for (const text of freeText) {
    const leaked = prescriptions.some(
      (rx) => rx.title === text || rx.advice.includes(text) || rx.lines.some((l) => l.drug === text),
    );
    if (leaked) {
      sessionPrescriptionSeparated = false;
      errors.push('PatientSession.prescription was merged into Prescription rows');
    }
  }

  const envoye = planned.prostheses.filter((p) => p.status === 'envoye');
  let envoyePreserved = true;
  for (const src of envoye) {
    const row = await prisma.prosthesis.findFirst({ where: { id: src.cloudId, organizationId } });
    if (!row || row.status !== 'envoye') {
      envoyePreserved = false;
      errors.push(`Prosthesis ${src.localId} status was not preserved as envoye`);
    }
  }

  for (const src of planned.media) {
    const row = await prisma.patientMedia.findFirst({ where: { id: src.cloudId, organizationId } });
    samplesChecked += 1;
    if (!row || row.status !== 'READY') {
      errors.push(`Media ${src.localId} is not READY`);
      continue;
    }
    const head = await storage.headObject(row.storageKey);
    if (!head.exists || head.size !== row.size) {
      errors.push(`Media object missing or size mismatch ${src.localId}`);
      continue;
    }
    const downloaded = await storage.getObject(row.storageKey);
    if (!downloaded || downloaded.body.length !== row.size) {
      errors.push(`Media object bytes could not be retrieved ${src.localId}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    countParity,
    samplesChecked,
    sessionPrescriptionSeparated,
    envoyePreserved,
  };
}
