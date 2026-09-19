import { describe, expect, it } from 'vitest'
import { estimateHydrateRequestCount } from '../lib/hydrateCost'

describe('phase4 hydrate request model', () => {
  it('reduces 100 patients from ~406 to ~10 requests', () => {
    const before = estimateHydrateRequestCount({ patientCount: 100, bulk: false })
    const after = estimateHydrateRequestCount({ patientCount: 100, bulk: true })
    expect(before.totalHttpRequests).toBe(406)
    expect(after.totalHttpRequests).toBe(10)
    expect(after.totalHttpRequests).toBeLessThan(30)
    expect(after.perPatientRequests).toBe(0)
  })

  it('stays flat as patient count grows', () => {
    const rows = [10, 50, 100, 500].map((n) => ({
      n,
      before: estimateHydrateRequestCount({ patientCount: n, bulk: false }).totalHttpRequests,
      after: estimateHydrateRequestCount({ patientCount: n, bulk: true }).totalHttpRequests,
    }))
    expect(rows.every((r) => r.after === 10)).toBe(true)
    expect(rows.find((r) => r.n === 500)?.before).toBe(2006)
  })
})
