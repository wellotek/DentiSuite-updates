/**
 * Dependency-safe planned insert order.
 *
 * Organization / User / Membership are bootstrap — never created from JSON.
 * ActCatalog and ClinicSettings are deferred.
 */
export const MIGRATION_PLAN_ORDER = [
  'dentist',
  'patient',
  'appointment',
  'clinicalSession',
  'treatment',
  'prescription',
  'invoice',
  'stockItem',
  'prosthesis',
  'patientMediaMetadata',
  'mediaObjects',
] as const;

export type MigrationPlanStep = (typeof MIGRATION_PLAN_ORDER)[number];
