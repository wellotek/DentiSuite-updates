import { describe, expect, it } from 'vitest'
import { seedMedications, CUSTOM_MEDICATION_SOURCE } from '../data/medications'
import { MIPH_NOMENCLATURE_META } from '../data/miphNomenclatureMeta'
import {
  applyMedicationToLine,
  applyOfficialMedicationImport,
  mergeMedicationCatalog,
  normalizeMedicationQuery,
  searchMedications,
} from './medications'
import { newPrescriptionLine } from './prescriptions'

describe('medication catalog (MIPH)', () => {
  const catalog = mergeMedicationCatalog([])

  it('imports official MIPH nomenclature', () => {
    expect(MIPH_NOMENCLATURE_META.sourceVersion).toBe('Août 2026')
    expect(seedMedications.length).toBe(MIPH_NOMENCLATURE_META.entryCount)
    expect(seedMedications.length).toBeGreaterThan(5000)
    expect(catalog.every((m) => m.source && m.lastVerifiedAt)).toBe(true)
    expect(catalog.every((m) => m.origin === 'official')).toBe(true)
  })

  it('searches by commercial name from first letters', () => {
    const byName = searchMedications(catalog, 'amo')
    expect(byName.length).toBeGreaterThan(0)
    expect(byName.some((m) => /amox/i.test(m.name) || /amox/i.test(m.dci))).toBe(true)
  })

  it('searches by DCI case-insensitively', () => {
    const lower = searchMedications(catalog, 'amoxicilline')
    const upper = searchMedications(catalog, 'AMOXICILLINE')
    const mixed = searchMedications(catalog, 'Amox')
    expect(lower.length).toBeGreaterThan(0)
    expect(upper.map((m) => m.id).sort()).toEqual(lower.map((m) => m.id).sort())
    expect(mixed.some((m) => /amox/i.test(m.dci) || /amox/i.test(m.name))).toBe(true)
  })

  it('searches by form and dosage and tolerates accents', () => {
    expect(normalizeMedicationQuery('Paracétamol')).toBe(normalizeMedicationQuery('PARACETAMOL'))
    const byForm = searchMedications(catalog, 'gelule')
    expect(byForm.some((m) => /g[eé]lule/i.test(m.form) || /gelule/i.test(normalizeMedicationQuery(m.form)))).toBe(
      true,
    )
  })

  it('respects inactive status', () => {
    const inactive = { ...catalog[0], status: 'inactive' as const }
    const merged = mergeMedicationCatalog([inactive])
    expect(searchMedications(merged, inactive.name.slice(0, 3)).find((m) => m.id === inactive.id)).toBeUndefined()
  })

  it('snapshots onto prescription line without posology and without mutating catalog', () => {
    const med = catalog.find((m) => /amox/i.test(m.name) || /amox/i.test(m.dci))!
    const before = { ...med }
    const line = applyMedicationToLine(newPrescriptionLine(), med)
    expect(line.medicationId).toBe(med.id)
    expect(line.drug).toContain(med.name)
    expect(line.dosage).toBe(med.dosage)
    expect(line.form).toBe(med.form)
    expect(line.dci).toBe(med.dci)
    expect(line.posology).toBe('')
    expect(line.duration).toBe('')
    expect(med).toEqual(before)
  })

  it('keeps custom medications distinct from official entries', () => {
    const custom = {
      id: 'med-custom-test',
      name: 'Produit Cabinet Test',
      dci: 'Testum',
      dosage: '100 mg',
      form: 'Comprimé',
      status: 'active' as const,
      origin: 'custom' as const,
      source: CUSTOM_MEDICATION_SOURCE,
      lastVerifiedAt: '2026-09-22',
    }
    const merged = mergeMedicationCatalog([custom])
    expect(merged.find((m) => m.id === custom.id)?.origin).toBe('custom')
    const hits = searchMedications(merged, 'Produit Cabinet')
    expect(hits.some((m) => m.id === custom.id)).toBe(true)
  })

  it('reimport soft-disables missing official without deleting custom', () => {
    const custom = {
      id: 'med-custom-keep',
      name: 'Perso',
      dci: 'Perso',
      dosage: '1',
      form: 'Cp',
      status: 'active' as const,
      origin: 'custom' as const,
      source: CUSTOM_MEDICATION_SOURCE,
      lastVerifiedAt: '2026-09-22',
    }
    const previousOfficial = catalog.slice(0, 3)
    const nextOfficial = catalog.slice(0, 2)
    const clinic = [...previousOfficial, custom]
    const result = applyOfficialMedicationImport(clinic, nextOfficial)
    expect(result.find((m) => m.id === custom.id)?.status).toBe('active')
    expect(result.find((m) => m.id === previousOfficial[2].id)?.status).toBe('inactive')
    expect(result.find((m) => m.id === nextOfficial[0].id)?.status).toBe('active')
  })

  it('boosts favorites in search ranking', () => {
    const hits = searchMedications(catalog, 'amox', 30)
    expect(hits.length).toBeGreaterThan(5)
    const favId = hits[hits.length - 1].id
    const beforeIdx = hits.findIndex((m) => m.id === favId)
    const boosted = searchMedications(catalog, 'amox', 30, { favoriteIds: [favId] })
    const afterIdx = boosted.findIndex((m) => m.id === favId)
    expect(afterIdx).toBeGreaterThanOrEqual(0)
    expect(afterIdx).toBeLessThan(beforeIdx)
  })
})
