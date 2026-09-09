-- Phase 5E: Dentist directory (local clinic.dentists).
-- No User FK. Clinical dentistId fields remain opaque strings (no FK).

CREATE TABLE "Dentist" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "photo" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dentist_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Dentist_organizationId_id_idx" ON "Dentist"("organizationId", "id");
CREATE INDEX "Dentist_organizationId_lastName_firstName_idx" ON "Dentist"("organizationId", "lastName", "firstName");
CREATE INDEX "Dentist_organizationId_specialty_idx" ON "Dentist"("organizationId", "specialty");

ALTER TABLE "Dentist" ADD CONSTRAINT "Dentist_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
