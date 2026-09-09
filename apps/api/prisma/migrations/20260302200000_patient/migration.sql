-- Phase 5A: Patient clinical table (tenant-scoped).
-- Hard delete. No soft-delete. No other clinical tables.

CREATE TABLE "Patient" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "antecedents" TEXT NOT NULL,
    "hasAllergies" BOOLEAN NOT NULL DEFAULT false,
    "dentistId" TEXT,
    "teeth" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Patient_organizationId_id_idx" ON "Patient"("organizationId", "id");
CREATE INDEX "Patient_organizationId_lastName_firstName_idx" ON "Patient"("organizationId", "lastName", "firstName");
CREATE INDEX "Patient_organizationId_phone_idx" ON "Patient"("organizationId", "phone");

ALTER TABLE "Patient" ADD CONSTRAINT "Patient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
