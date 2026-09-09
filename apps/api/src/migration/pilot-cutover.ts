export type CutoverChecklistItem = {
  step: number;
  title: string;
  executeInThisPhase: false;
  blockedUntilFutureApply: boolean;
};

/** Operator checklist only. This phase does not run any step. */
export const PILOT_CUTOVER_CHECKLIST: CutoverChecklistItem[] = [
  { step: 1, title: 'Stop/close local DentiSuite', executeInThisPhase: false, blockedUntilFutureApply: false },
  { step: 2, title: 'Create final backup (JSON copy + media copy)', executeInThisPhase: false, blockedUntilFutureApply: false },
  { step: 3, title: 'Verify backup hash (JSON SHA256 + media manifest)', executeInThisPhase: false, blockedUntilFutureApply: false },
  { step: 4, title: 'Run final dry-run against the backup copy', executeInThisPhase: false, blockedUntilFutureApply: false },
  { step: 5, title: 'Review pilot-readiness-report.json', executeInThisPhase: false, blockedUntilFutureApply: false },
  { step: 6, title: 'Approve (operator + production confirmation flags)', executeInThisPhase: false, blockedUntilFutureApply: true },
  { step: 7, title: 'Run future APPLY', executeInThisPhase: false, blockedUntilFutureApply: true },
  { step: 8, title: 'Verify counts', executeInThisPhase: false, blockedUntilFutureApply: true },
  { step: 9, title: 'Verify relations', executeInThisPhase: false, blockedUntilFutureApply: true },
  { step: 10, title: 'Verify content', executeInThisPhase: false, blockedUntilFutureApply: true },
  { step: 11, title: 'Verify media', executeInThisPhase: false, blockedUntilFutureApply: true },
  { step: 12, title: 'Keep local backup', executeInThisPhase: false, blockedUntilFutureApply: true },
  { step: 13, title: 'Only after verification consider Cloud cutover', executeInThisPhase: false, blockedUntilFutureApply: true },
];

export const PILOT_ROLLBACK_PLAN = {
  localSourceAuthoritativeUntilCutover: true,
  productionMigrationDoesNotDeleteLocalSource: true,
  failedMigrationLeavesLocalSourceUsable: true,
  cloudOrganizationCanBeIsolated: true,
  destructiveProductionRollbackCommand: false,
  notes: [
    'Local JSON + media remain the cabinet of record until an operator later enables Cloud Mode.',
    'Migration never deletes or rewrites the source copy or live AppData.',
    'If a future APPLY fails, keep using the local backup; do not cut over Electron.',
    'If Cloud rows exist after a future APPLY, isolate the Organization (DISABLED) — do not run a generic delete.',
    'Staging migrate:rollback is STAGING-gated and is not a production tool.',
  ],
} as const;
