import { describe, expect, it, beforeEach } from 'vitest'
import { migrateClinic, saveClinic } from './storage'
import { seedClinic } from '../data/seed'
import { mapCloudTreatmentToStore } from '../cloud/clinicMirror'
import { CloudClientError, cloudErrorLabel, mapCloudFailure } from '../cloud/errors'
import type { ClinicState, Treatment } from '../types'

const PATIENT_ID = 'p-test-soins'
const MARKER = 'TEST-DENTISUITE-SOINS'

function makeTreatment(suffix: string, overrides: Partial<Treatment> = {}): Treatment {
  return {
    id: `t-soins-${suffix}`,
    patientId: PATIENT_ID,
    date: '2026-09-23',
    tooth: suffix,
    act: `${MARKER} ${suffix}`,
    code: `TS${suffix}`,
    cost: 1000,
    comment: `Soin test ${suffix}`,
    careStatus: 'a_faire',
    paymentStatus: 'en_attente',
    ...overrides,
  }
}

function clinicWithTreatments(treatments: Treatment[]): ClinicState {
  return {
    ...seedClinic,
    patients: [
      {
        id: PATIENT_ID,
        firstName: MARKER,
        lastName: 'Audit',
        phone: '0555000000',
        age: 40,
        address: '',
        antecedents: 'Aucun',
        hasAllergies: false,
        teeth: {},
      },
    ],
    treatments,
    appointments: [],
  }
}

describe('treatment persistence (Legacy store)', () => {
  beforeEach(() => {
    localStorage.clear()
    ;(window as unknown as { dentisuite?: unknown }).dentisuite = undefined
  })

  it('round-trips 3 TEST-DENTISUITE-SOINS treatments through save → reload', async () => {
    const treatments = [makeTreatment('1'), makeTreatment('2'), makeTreatment('3')]
    await saveClinic(clinicWithTreatments(treatments))

    const raw = JSON.parse(localStorage.getItem('dentisuite.clinic') || 'null')
    expect(raw.treatments).toHaveLength(3)
    const reloaded = migrateClinic(raw)
    const found = reloaded.treatments.filter((t) => t.patientId === PATIENT_ID)
    expect(found).toHaveLength(3)
    expect(found.map((t) => t.act).sort()).toEqual([
      `${MARKER} 1`,
      `${MARKER} 2`,
      `${MARKER} 3`,
    ])
  })

  it('keeps a treatment edit after save → reload', async () => {
    const original = makeTreatment('1', { comment: 'Avant', careStatus: 'a_faire' })
    await saveClinic(clinicWithTreatments([original]))

    const edited = { ...original, comment: 'Après modification', careStatus: 'fait' as const }
    await saveClinic(clinicWithTreatments([edited]))

    const reloaded = migrateClinic(JSON.parse(localStorage.getItem('dentisuite.clinic') || 'null'))
    const line = reloaded.treatments.find((t) => t.id === original.id)
    expect(line?.comment).toBe('Après modification')
    expect(line?.careStatus).toBe('fait')
    expect(line?.patientId).toBe(PATIENT_ID)
  })
})

describe('Cloud treatment mapping', () => {
  it('keeps the server UUID and patientId (no local t- prefix rewrite)', () => {
    const mapped = mapCloudTreatmentToStore({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      organizationId: 'org-1',
      patientId: PATIENT_ID,
      date: '2026-09-23',
      tooth: '16',
      act: `${MARKER} 1`,
      code: 'TS1',
      cost: 2500,
      comment: 'Soin test 1',
      careStatus: 'a_faire',
      paymentStatus: 'en_attente',
    })
    expect(mapped.id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(mapped.patientId).toBe(PATIENT_ID)
    expect(mapped.id.startsWith('t')).toBe(false)
  })

  it('maps API failures to explicit errors (no silent success)', () => {
    const cases = [
      { status: 401, kind: 'unauthorized' },
      { status: 403, kind: 'forbidden' },
      { status: 404, kind: 'not_found' },
      { status: 409, kind: 'conflict' },
      { status: 500, kind: 'server' },
      { code: 'TIMEOUT', status: 0, kind: 'network' },
    ] as const
    for (const c of cases) {
      const err = mapCloudFailure({
        code: 'code' in c ? c.code : undefined,
        status: c.status,
        message: 'fail',
      })
      expect(err).toBeInstanceOf(CloudClientError)
      expect(err.kind).toBe(c.kind)
      expect(cloudErrorLabel(err).length).toBeGreaterThan(0)
    }
  })
})
