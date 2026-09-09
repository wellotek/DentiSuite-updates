-- Phase 5D: Prescription + PrescriptionItem (local clinic.prescriptions).
-- Distinct from ClinicalSession.prescription free-text. Hard delete. No Dentist/Session FK.

CREATE TABLE "Prescription" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "patientName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "templateId" TEXT,
    "advice" TEXT NOT NULL DEFAULT '',
    "dentistId" TEXT,
    "dentistName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Prescription_organizationId_patientId_idx" ON "Prescription"("organizationId", "patientId");
CREATE INDEX "Prescription_organizationId_date_idx" ON "Prescription"("organizationId", "date");
CREATE INDEX "Prescription_organizationId_id_idx" ON "Prescription"("organizationId", "id");

ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PrescriptionItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "drug" TEXT NOT NULL,
    "posology" TEXT NOT NULL DEFAULT '',
    "duration" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrescriptionItem_organizationId_prescriptionId_idx" ON "PrescriptionItem"("organizationId", "prescriptionId");
CREATE INDEX "PrescriptionItem_prescriptionId_sortOrder_idx" ON "PrescriptionItem"("prescriptionId", "sortOrder");

ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
