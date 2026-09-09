-- Phase 5C: ClinicalSession (local PatientSession) + Treatment.
-- Sibling under Patient. Hard delete. No Dentist / Invoice / Prescription FKs.

CREATE TABLE "ClinicalSession" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "teeth" JSONB NOT NULL DEFAULT '[]',
    "acts" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "prescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClinicalSession_organizationId_patientId_idx" ON "ClinicalSession"("organizationId", "patientId");
CREATE INDEX "ClinicalSession_organizationId_date_idx" ON "ClinicalSession"("organizationId", "date");
CREATE INDEX "ClinicalSession_organizationId_id_idx" ON "ClinicalSession"("organizationId", "id");

ALTER TABLE "ClinicalSession" ADD CONSTRAINT "ClinicalSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalSession" ADD CONSTRAINT "ClinicalSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Treatment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "tooth" TEXT NOT NULL,
    "act" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "careStatus" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "actId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Treatment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Treatment_organizationId_patientId_idx" ON "Treatment"("organizationId", "patientId");
CREATE INDEX "Treatment_organizationId_date_idx" ON "Treatment"("organizationId", "date");
CREATE INDEX "Treatment_organizationId_id_idx" ON "Treatment"("organizationId", "id");

ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
