/**
 * Analytical model of Cloud clinic hydrate request cost.
 *
 * Phase 4 (bulk):
 * - 10 org-scoped paginated families run in parallel
 * - cost ≈ 10 * avgPagesPerFamily (independent of patient count N)
 *
 * Phase 3 (legacy N+1, for comparison):
 * - 6 org lists + 4N per-patient lists
 */

export type HydrateCostInput = {
  patientCount: number
  /** Average pages needed for each org-level list (default 1). */
  orgListPages?: number
  /** Average pages per patient resource family (legacy N+1 only). */
  perPatientPages?: number
  concurrency?: number
  /** Use Phase 4 bulk model (default true). */
  bulk?: boolean
}

export type HydrateCostEstimate = {
  patientCount: number
  orgLevelRequests: number
  perPatientRequests: number
  totalHttpRequests: number
  estimatedSequentialRounds: number
  formula: string
  mode: 'bulk' | 'n+1'
}

const BULK_ORG_FAMILIES = 10

export function estimateHydrateRequestCount(input: HydrateCostInput): HydrateCostEstimate {
  const n = Math.max(0, Math.floor(input.patientCount))
  const orgPages = Math.max(1, input.orgListPages ?? 1)
  const perPages = Math.max(1, input.perPatientPages ?? 1)
  const concurrency = Math.max(1, input.concurrency ?? 4)
  const bulk = input.bulk !== false

  if (bulk) {
    const orgLevelRequests = BULK_ORG_FAMILIES * orgPages
    return {
      patientCount: n,
      orgLevelRequests,
      perPatientRequests: 0,
      totalHttpRequests: orgLevelRequests,
      estimatedSequentialRounds: 1,
      formula: `${BULK_ORG_FAMILIES}*orgPages (parallel bulk; independent of N)`,
      mode: 'bulk',
    }
  }

  const orgLevelRequests = 6 * orgPages
  const perPatientRequests = n * 4 * perPages
  const totalHttpRequests = orgLevelRequests + perPatientRequests
  const roundsPerFamily = n === 0 ? 0 : Math.ceil(n / concurrency)
  const estimatedSequentialRounds = roundsPerFamily * 4

  return {
    patientCount: n,
    orgLevelRequests,
    perPatientRequests,
    totalHttpRequests,
    estimatedSequentialRounds,
    formula: `6*orgPages + N*4*perPatientPages (concurrency=${concurrency} per family)`,
    mode: 'n+1',
  }
}
