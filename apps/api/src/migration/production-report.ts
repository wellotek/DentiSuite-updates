import type { DryRunResult } from './dry-run.js';
import { classifyOperatorReview } from './signoff.js';
import { OPEN_PRODUCT_DECISIONS } from './open-decisions.js';

export type ProductionPreflightReport = {
  metadata: {
    mode: 'PRODUCTION_PREFLIGHT';
    environment: 'PRODUCTION';
    executionEnabled: boolean;
    targetOrganizationId: string;
    databaseIdentity: string;
    storageIdentity: string;
    storageProvider: string;
    expectedMediaPrefix: string;
    sourceJsonHash: string;
    mediaManifestHash: string;
    mediaFileCount: number;
    backupTimestamp: string;
    intendedState: 'READY_FOR_APPROVAL';
    migrationState: 'NOT_STARTED' | 'READY_FOR_APPROVAL';
    organizationChecked: boolean;
    startedAt: string;
    finishedAt: string;
  };
  operatorConfirmation: {
    migrationMode: 'APPLY';
    migrationConfirm: true;
    migrationProductionApproval: true;
    migrationEnv: 'PRODUCTION';
  };
  dryRunOk: boolean;
  sourceCounts: DryRunResult['report']['counts'];
  plannedCounts: Record<string, number>;
  insertedCounts: Record<string, number>;
  skipped: DryRunResult['report']['skipped'];
  warnings: DryRunResult['report']['warnings'];
  errors: string[];
  mappingStatistics: DryRunResult['report']['mappings'];
  mediaStatistics: {
    source: number;
    planned: number;
    missing: number;
  };
  operatorReview: ReturnType<typeof classifyOperatorReview>;
  openProductDecisions: typeof OPEN_PRODUCT_DECISIONS;
  verification: null;
  ok: boolean;
};
