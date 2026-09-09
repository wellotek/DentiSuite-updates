-- Phase 5F: PatientMedia metadata (bytes live in object storage, not Postgres).

CREATE TYPE "PatientMediaStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

CREATE TABLE "PatientMedia" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "PatientMediaStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientMedia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatientMedia_organizationId_storageKey_key" ON "PatientMedia"("organizationId", "storageKey");
CREATE INDEX "PatientMedia_organizationId_patientId_idx" ON "PatientMedia"("organizationId", "patientId");
CREATE INDEX "PatientMedia_organizationId_id_idx" ON "PatientMedia"("organizationId", "id");
CREATE INDEX "PatientMedia_organizationId_status_idx" ON "PatientMedia"("organizationId", "status");

ALTER TABLE "PatientMedia" ADD CONSTRAINT "PatientMedia_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientMedia" ADD CONSTRAINT "PatientMedia_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
