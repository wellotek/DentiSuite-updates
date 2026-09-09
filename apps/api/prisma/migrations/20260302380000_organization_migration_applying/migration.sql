-- Phase 6B: APPLYING status for in-flight staging APPLY.
-- PostgreSQL appends enum values; PGlite applies this as a standalone statement.

ALTER TYPE "OrganizationMigrationStatus" ADD VALUE 'APPLYING';
