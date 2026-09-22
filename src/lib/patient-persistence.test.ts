import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migrateClinic, saveClinic } from './storage'
import { seedClinic } from '../data/seed'
import type { ClinicState, Patient } from '../types'

const MARKER = 'TEST-DENTISUITE-PERSISTENCE'

function makePatient(suffix: string, overrides: Partial<Patient> = {}): Patient {
  return {
    id: `p-persist-${suffix}`,
    firstName: MARKER,
    lastName: suffix,
    phone: `0555${suffix.slice(-4).padStart(4, '0')}`,
    age: 30,
    birthDate: '1996-01-15',
    address: 'Adresse test persistence',
    antecedents: 'Aucun',
    hasAllergies: false,
    teeth: {},
    ...overrides,
  }
}

describe('patient persistence (Legacy store)', () => {
  beforeEach(() => {
    localStorage.clear()
    // Force browser/localStorage path (no Electron bridge in unit tests).
    ;(window as unknown as { dentisuite?: unknown }).dentisuite = undefined
  })

  it('does not replace an empty-but-valid clinic with seed demo patients', () => {
    const emptyCabinet: ClinicState = {
      ...seedClinic,
      patients: [],
      appointments: [],
      prescriptions: [],
    }
    const migrated = migrateClinic(emptyCabinet)
    expect(migrated.patients).toEqual([])
    expect(migrated.patients.some((p) => p.id === 'p1')).toBe(false)
  })

  it('round-trips 3 marker patients through save → reload (simulate restart)', async () => {
    const patients = [
      makePatient('A'),
      makePatient('B'),
      makePatient('C'),
    ]
    const clinic: ClinicState = {
      ...seedClinic,
      patients,
      appointments: [],
    }

    await saveClinic(clinic)

    // Simulate full restart: wipe in-memory and reload from durable store.
    const raw = JSON.parse(localStorage.getItem('dentisuite.clinic') || 'null')
    expect(raw).toBeTruthy()
    expect(raw.patients).toHaveLength(3)

    const reloaded = migrateClinic(raw)
    const found = reloaded.patients.filter((p) => p.firstName === MARKER)
    expect(found).toHaveLength(3)
    expect(found.map((p) => p.lastName).sort()).toEqual(['A', 'B', 'C'])
  })

  it('keeps patient field edits after save → reload', async () => {
    const patient = makePatient('EDIT', {
      phone: '0500000001',
      address: 'Avant',
      antecedents: 'Diabète',
    })
    await saveClinic({ ...seedClinic, patients: [patient], appointments: [] })

    const edited: Patient = {
      ...patient,
      lastName: 'EDITED',
      phone: '0500000099',
      address: 'Après modification',
      antecedents: 'HTA',
    }
    await saveClinic({ ...seedClinic, patients: [edited], appointments: [] })

    const reloaded = migrateClinic(JSON.parse(localStorage.getItem('dentisuite.clinic') || 'null'))
    const p = reloaded.patients.find((x) => x.id === patient.id)
    expect(p?.lastName).toBe('EDITED')
    expect(p?.phone).toBe('0500000099')
    expect(p?.address).toBe('Après modification')
    expect(p?.antecedents).toBe('HTA')
  })

  it('keeps appointment linked to patient after save → reload', async () => {
    const patient = makePatient('RDV')
    const appointment = {
      id: 'a-persist-1',
      date: '2026-09-22',
      time: '10:00',
      durationMin: 30,
      patientId: patient.id,
      patientName: `${MARKER} RDV`,
      patientPhone: patient.phone,
      motif: 'Contrôle',
      practitioner: 'Dr Test',
      dentistId: 'd1',
      status: 'confirme' as const,
      category: 'consultation' as const,
    }
    await saveClinic({
      ...seedClinic,
      patients: [patient],
      appointments: [appointment],
    })

    const reloaded = migrateClinic(JSON.parse(localStorage.getItem('dentisuite.clinic') || 'null'))
    expect(reloaded.patients.some((p) => p.id === patient.id)).toBe(true)
    const apt = reloaded.appointments.find((a) => a.id === appointment.id)
    expect(apt?.patientId).toBe(patient.id)
    expect(apt?.patientName).toContain(MARKER)
  })

  it('throws when Electron clinic:set reports failure (no false success)', async () => {
    ;(window as unknown as { dentisuite: unknown }).dentisuite = {
      setClinic: vi.fn(async () => ({
        ok: false,
        code: 'CLOUD_MODE',
        message: 'Legacy clinic JSON is read-only in Cloud mode',
      })),
      getClinic: vi.fn(async () => null),
    }

    await expect(
      saveClinic({ ...seedClinic, patients: [makePatient('FAIL')] }),
    ).rejects.toThrow(/CLOUD_MODE|clinic:set/)
  })
})
