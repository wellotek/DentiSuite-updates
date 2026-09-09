-- Phase 6D: production migration process states (not used to execute production APPLY).
-- PostgreSQL appends enum values; PGlite applies each statement separately.

ALTER TYPE "OrganizationMigrationStatus" ADD VALUE 'READY_FOR_APPROVAL';
ALTER TYPE "OrganizationMigrationStatus" ADD VALUE 'APPROVED';
ALTER TYPE "OrganizationMigrationStatus" ADD VALUE 'VERIFYING';
