import { describe, expect, it } from 'vitest'
import { seedMedications } from '../data/medications'
import { applyMedicationToLine, mergeMedicationCatalog, searchMedications } from './medications'
import { newPrescriptionLine } from './prescriptions'

describe('medication catalog', () => {
  const catalog = mergeMedicationCatalog([])

  it('seeds a modest dental catalog', () => {
    expect(seedMedications.length).toBeGreaterThan(10)
    expect(catalog.every((m) => m.source && m.lastVerifiedAt)).toBe(true)
  })

  it('searches by commercial name and DCI', () => {
    const byName = searchMedications(catalog, 'amo')
    expect(byName.some((m) => /amox/i.test(m.name))).toBe(true)
    const byDci = searchMedications(catalog, 'paracétamol')
    expect(byDci.some((m) => /paracétamol/i.test(m.dci))).toBe(true)
  })

  it('respects inactive status', () => {
    const inactive = { ...catalog[0], status: 'inactive' as const }
    const merged = mergeMedicationCatalog([inactive])
    expect(searchMedications(merged, inactive.name.slice(0, 3)).find((m) => m.id === inactive.id)).toBeUndefined()
  })

  it('snapshots onto prescription line without mutating catalog', () => {
    const med = catalog.find((m) => /amox/i.test(m.name))!
    const before = { ...med }
    const line = applyMedicationToLine(newPrescriptionLine(), med)
    expect(line.medicationId).toBe(med.id)
    expect(line.drug).toContain(med.name)
    expect(line.dosage).toBe(med.dosage)
    expect(med).toEqual(before)
  })
})
