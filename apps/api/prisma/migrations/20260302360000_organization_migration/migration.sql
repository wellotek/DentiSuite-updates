-- Phase 6A: Organization-scoped migration process status.
-- Dry-run never writes this table. APPLY is not implemented in 6A.

CREATE TYPE "OrganizationMigrationStatus" AS ENUM ('NOT_STARTED', 'DRY_RUN', 'MIGRATED', 'VERIFIED', 'FAILED', 'ABANDONED');

CREATE TABLE "OrganizationMigration" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "status" "OrganizationMigrationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "lastDryRunAt" TIMESTAMP(3),
    "lastAppliedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMigration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationMigration_organizationId_key" ON "OrganizationMigration"("organizationId");

ALTER TABLE "OrganizationMigration" ADD CONSTRAINT "OrganizationMigration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
