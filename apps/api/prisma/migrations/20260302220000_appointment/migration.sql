-- Phase 5B: Appointment clinical table (tenant-scoped).
-- Hard delete. Patient FK. No Dentist FK.

CREATE TABLE "Appointment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "practitioner" TEXT NOT NULL,
    "dentistId" TEXT,
    "status" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Appointment_organizationId_date_idx" ON "Appointment"("organizationId", "date");
CREATE INDEX "Appointment_organizationId_patientId_idx" ON "Appointment"("organizationId", "patientId");
CREATE INDEX "Appointment_organizationId_dentistId_idx" ON "Appointment"("organizationId", "dentistId");
CREATE INDEX "Appointment_organizationId_status_idx" ON "Appointment"("organizationId", "status");
CREATE INDEX "Appointment_organizationId_id_idx" ON "Appointment"("organizationId", "id");

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
