/**
 * Organization-scoped migration process status.
 *
 * Stored on OrganizationMigration (1:1 with Organization), never on
 * Patient / Invoice / other clinical rows.
 *
 * Staging APPLY writes DRY_RUN → APPLYING → MIGRATED → VERIFIED.
 * Production APPLY execution is disabled (Phase 6D); extra states exist
 * for the operator runbook / future gated production path.
 */
export const ORGANIZATION_MIGRATION_STATUSES = [
  'NOT_STARTED',
  'DRY_RUN',
  'READY_FOR_APPROVAL',
  'APPROVED',
  'APPLYING',
  'MIGRATED',
  'VERIFYING',
  'VERIFIED',
  'FAILED',
  'ABANDONED',
] as const;

export type OrganizationMigrationStatus = (typeof ORGANIZATION_MIGRATION_STATUSES)[number];

export const MIGRATION_STATUS_SEMANTICS: Record<OrganizationMigrationStatus, string> = {
  NOT_STARTED: 'No migration process row / never applied.',
  DRY_RUN: 'Dry-run recorded (staging APPLY) or last successful dry-run.',
  READY_FOR_APPROVAL: 'Production dry-run clean; waiting for operator approval (not auto-applied).',
  APPROVED: 'Operator approved a future production APPLY (execution still gated).',
  APPLYING: 'APPLY writes in progress (not VERIFIED).',
  MIGRATED: 'APPLY writes finished; verification not yet passed.',
  VERIFYING: 'Post-APPLY verification running.',
  VERIFIED: 'Post-APPLY count/reference/content checks passed.',
  FAILED: 'APPLY or verify failed; source JSON/media untouched.',
  ABANDONED: 'Import discarded (staging rollback) or production abandoned operationally.',
};

export const VERIFY_ALLOWED_STATUSES: OrganizationMigrationStatus[] = [
  'MIGRATED',
  'VERIFYING',
  'VERIFIED',
];
