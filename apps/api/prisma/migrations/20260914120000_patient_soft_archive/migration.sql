-- Soft-archive patients (preserve clinical history)
ALTER TABLE "Patient" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Patient" ADD COLUMN "archivedBy" TEXT;

CREATE INDEX "Patient_organizationId_archivedAt_idx" ON "Patient"("organizationId", "archivedAt");
