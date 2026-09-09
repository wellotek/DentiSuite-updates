import { describe, expect, it } from 'vitest'
import { migrateClinic } from '../lib/storage'
import { CLINIC_SCHEMA_VERSION } from '../data/seed'

describe('local store regression (Phase 7A / 8A)', () => {
  it('10. Legacy patient loading shape unchanged (no Cloud UUID fields required)', () => {
    const clinic = migrateClinic({
      schemaVersion: 8,
      patients: [
        {
          id: 'p1700000000000',
          firstName: 'Local',
          lastName: 'Legacy',
          phone: '0555',
          age: 40,
          address: '',
          antecedents: '',
          hasAllergies: false,
          teeth: {},
        },
      ],
      appointments: [],
      treatments: [],
      invoices: [],
      dentists: [],
      prostheses: [],
      stockItems: [],
      sessions: [],
      mediaFiles: [],
      prescriptions: [],
    })
    expect(clinic.patients[0]?.id).toMatch(/^p/)
    expect(clinic.patients[0]).not.toHaveProperty('organizationId')
  })

  it('migrateClinic preserves patients and schemaVersion', () => {
    const clinic = migrateClinic({
      schemaVersion: 8,
      patients: [
        {
          id: 'p1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          phone: '0555000000',
          age: 36,
          address: '',
          antecedents: 'Aucun',
          hasAllergies: false,
          teeth: {},
        },
      ],
      appointments: [],
      treatments: [],
      invoices: [],
      dentists: [],
      prostheses: [],
      stockItems: [],
      sessions: [],
      mediaFiles: [],
      prescriptions: [],
    })
    expect(clinic.schemaVersion).toBe(CLINIC_SCHEMA_VERSION)
    expect(clinic.patients).toHaveLength(1)
    expect(clinic.patients[0]?.firstName).toBe('Ada')
  })

  it('does not invent organizationId on clinic state', () => {
    const clinic = migrateClinic({
      schemaVersion: 8,
      patients: [
        {
          id: 'p1',
          firstName: 'A',
          lastName: 'B',
          phone: '1',
          age: 1,
          address: '',
          antecedents: '',
          hasAllergies: false,
          teeth: {},
        },
      ],
      appointments: [],
      treatments: [],
      invoices: [],
      dentists: [],
      prostheses: [],
      stockItems: [],
      sessions: [],
      mediaFiles: [
        {
          id: 'm1',
          patientId: 'p1',
          title: 'x',
          kind: 'image',
          mime: 'image/jpeg',
          originalName: 'x.jpg',
          filename: 'x.jpg',
          createdAt: '2026-01-01T00:00:00.000Z',
          size: 10,
        },
      ],
      prescriptions: [],
    })
    expect('organizationId' in clinic).toBe(false)
    expect(clinic.mediaFiles).toHaveLength(1)
  })
})
