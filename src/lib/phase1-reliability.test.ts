import { describe, expect, it, beforeEach } from 'vitest'
import { clearDraft, loadDraft, saveDraft, shouldOfferDraft } from './drafts'
import {
  buildClinicBackup,
  clinicFromBackup,
  validateClinicBackup,
} from './clinicBackup'
import { seedClinic } from '../data/seed'
import { applyMedicationToLine, mergeMedicationCatalog } from './medications'
import { newPrescriptionLine } from './prescriptions'

describe('clinic backup', () => {
  it('round-trips clinic patients through validate + migrate', () => {
    const payload = buildClinicBackup(seedClinic, {
      appVersion: '3.4.0',
      mode: 'LEGACY',
    })
    const validated = validateClinicBackup(payload)
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    const clinic = clinicFromBackup(validated.data)
    expect(clinic.patients.length).toBe(seedClinic.patients.length)
    expect(clinic.schemaVersion).toBeGreaterThanOrEqual(8)
  })

  it('rejects unknown format', () => {
    expect(validateClinicBackup({ format: 'other' }).ok).toBe(false)
  })
})

describe('drafts', () => {
  beforeEach(() => {
    clearDraft('session', 'p1')
  })

  it('saves and restores draft without treating it as saved record', () => {
    saveDraft('session', 'p1', { notes: 'brouillon' }, '2020-01-01T00:00:00.000Z')
    const d = loadDraft<{ notes: string }>('session', 'p1')
    expect(d?.data.notes).toBe('brouillon')
    expect(d?.kind).toBe('session')
  })

  it('refuses offer when server moved ahead of draft base', () => {
    saveDraft('session', 'p1', { notes: 'x' }, '2020-01-01T00:00:00.000Z')
    const d = loadDraft('session', 'p1')
    expect(shouldOfferDraft(d, '2024-01-01T00:00:00.000Z')).toBe(false)
    expect(shouldOfferDraft(d, '2019-01-01T00:00:00.000Z')).toBe(true)
  })
})

describe('prescription historical snapshot', () => {
  it('catalog change does not mutate an existing line snapshot', () => {
    const catalog = mergeMedicationCatalog([])
    const med = catalog.find((m) => /amox/i.test(m.name))!
    const line = applyMedicationToLine(newPrescriptionLine(), med)
    const frozen = { ...line }
    // Simulate catalog rename — line must stay as captured
    const mutatedCatalog = mergeMedicationCatalog([
      { ...med, name: 'RENAMED_DRUG', dosage: '999 mg' },
    ])
    const after = mutatedCatalog.find((m) => m.id === med.id)!
    expect(after.name).toBe('RENAMED_DRUG')
    expect(frozen.drug).toContain(med.name)
    expect(frozen.drug).not.toContain('RENAMED')
    expect(frozen.dosage).toBe(med.dosage)
  })
})
