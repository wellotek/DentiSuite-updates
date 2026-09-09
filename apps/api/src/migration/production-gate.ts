import { ApplyGateError } from './apply-gate.js';

export type ProductionGateInput = {
  migrationMode?: string;
  migrationConfirm?: string;
  migrationProductionApproval?: string;
  migrationEnv?: string;
  targetOrganizationId?: string;
};

/**
 * Production APPLY confirmation gates. Execution remains disabled (Phase 6D).
 * No defaults: every flag must be present and exact.
 */
export function assertProductionGates(input: ProductionGateInput): void {
  if (input.migrationMode !== 'APPLY') {
    throw new ApplyGateError('migrate:apply requires MIGRATION_MODE=APPLY');
  }
  if (input.migrationConfirm !== 'YES') {
    throw new ApplyGateError('migrate:apply requires MIGRATION_CONFIRM=YES');
  }
  if (input.migrationProductionApproval !== 'YES') {
    throw new ApplyGateError('Production APPLY requires MIGRATION_PRODUCTION_APPROVAL=YES');
  }
  if (input.migrationEnv !== 'PRODUCTION') {
    throw new ApplyGateError('Production APPLY requires MIGRATION_ENV=PRODUCTION');
  }
  if (!input.targetOrganizationId) {
    throw new ApplyGateError('Production APPLY requires TARGET_ORGANIZATION_ID');
  }
}

export function productionGatesFromEnv(env: NodeJS.ProcessEnv): ProductionGateInput {
  return {
    migrationMode: env.MIGRATION_MODE,
    migrationConfirm: env.MIGRATION_CONFIRM,
    migrationProductionApproval: env.MIGRATION_PRODUCTION_APPROVAL,
    migrationEnv: env.MIGRATION_ENV,
    targetOrganizationId: env.TARGET_ORGANIZATION_ID ?? env.DENTISUITE_MIGRATION_ORGANIZATION_ID,
  };
}

/**
 * Phase 6F.3: production APPLY execution enabled for the first controlled pilot.
 * Still requires exact production gates + allowlists + backup evidence.
 */
export const PRODUCTION_APPLY_EXECUTION_ENABLED = true;

export function assertProductionExecutionDisabled(): never {
  throw new ApplyGateError(
    'Production APPLY execution is disabled. Phase 6E is pilot readiness only; no production cabinet is migrated.',
  );
}
