import { describe, expect, it } from 'vitest'
import { CLINIC_SCHEMA_VERSION } from '../data/seed'
import { searchClinic } from './globalSearch'
import { paginateSlice } from '../components/ui/ListPagination'
import { translate } from '../i18n/messages'
import type { ClinicState } from '../types'
import { openFromPatient, readPatientNavState, withPatientReturn } from './patientNav'

function emptyClinic(): ClinicState {
  return {
    schemaVersion: CLINIC_SCHEMA_VERSION,
    patients: [
      {
        id: 'p1',
        firstName: 'Jean',
        lastName: 'Dupont',
        phone: '0555000001',
        age: 42,
        birthDate: '1984-03-15',
        address: '',
        antecedents: '',
        hasAllergies: false,
        teeth: {},
      },
      {
        id: 'p2',
        firstName: 'Sara',
        lastName: 'Benali',
        phone: '0555000002',
        age: 30,
        address: '',
        antecedents: '',
        hasAllergies: false,
        teeth: {},
        archivedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    appointments: [
      {
        id: 'a1',
        date: '2026-09-15',
        time: '10:00',
        durationMin: 30,
        patientId: 'p1',
        patientName: 'Jean Dupont',
        patientPhone: '0555000001',
        motif: 'Controle',
        practitioner: '',
        status: 'confirme',
        category: 'controle',
      },
    ],
    prostheses: [
      {
        id: 'pr1',
        type: 'Couronne',
        tooth: '16',
        patientId: 'p1',
        patientName: 'Jean Dupont',
        lab: 'Labo A',
        sentAt: '2026-09-01',
        status: 'fabrication',
      },
    ],
    invoices: [
      {
        id: 'inv1',
        patientId: 'p1',
        patientName: 'Jean Dupont',
        label: 'FAC-0084 Soins',
        amount: 5000,
        paid: true,
        date: '2026-09-10',
      },
    ],
    treatments: [],
        dentists: [
      {
        id: 'd1',
        firstName: 'Amine',
        lastName: 'Khelifa',
        specialty: 'Omnipratique',
        color: '#0ea5e9',
        photo: '',
      },
    ],
    settings: {
      name: 'Test',
      address: '',
      phone: '',
      email: '',
      logo: '',
      adminPhoto: '',
      locale: 'fr',
      timezone: 'Africa/Algiers',
      dateFormat: 'long',
      timeFormat: '24h',
    },
    actCatalog: [],
    medicationCatalog: [
      {
        id: 'm1',
        name: 'Amoxicilline',
        dci: 'amoxicillin',
        dosage: '1g',
        form: 'cp',
        status: 'active',
        source: 'test',
        lastVerifiedAt: '2026-01-01',
      },
    ],
    stockItems: [],
    sessions: [],
    mediaFiles: [],
    prescriptions: [
      {
        id: 'rx1',
        patientId: 'p1',
        patientName: 'Jean Dupont',
        date: '2026-09-12',
        title: 'RX-1024',
        lines: [{ id: 'l1', drug: 'Amoxicilline', posology: '2/j', duration: '7j', notes: '' }],
        advice: '',
        dentistName: 'Dr Test',
      },
    ],
  }
}

describe('phase2 patientNav', () => {
  it('builds and reads patient return context without inventing one', () => {
    const state = openFromPatient('p1', 'Retour')
    expect(state.fromPatientId).toBe('p1')
    expect(state.returnTo).toBe('/patients/p1')
    expect(readPatientNavState({ state, key: '', pathname: '/ordonnances', search: '', hash: '' } as never)).toEqual(
      state,
    )
    expect(readPatientNavState({ state: null, key: '', pathname: '/', search: '', hash: '' } as never)).toEqual({})
    expect(withPatientReturn('p1', '/agenda').returnTo).toBe('/agenda')
  })
})

describe('phase2 globalSearch', () => {
  it('finds patients invoices prescriptions and excludes archived', () => {
    const clinic = emptyClinic()
    const hits = searchClinic(clinic, 'dupont')
    expect(hits.some((h) => h.kind === 'patient' && h.to === '/patients/p1')).toBe(true)
    expect(hits.some((h) => h.kind === 'invoice')).toBe(true)
    expect(hits.some((h) => h.kind === 'prescription')).toBe(true)
    expect(hits.some((h) => h.id.includes('p2'))).toBe(false)

    const apt = searchClinic(clinic, 'controle')
    expect(apt.some((h) => h.kind === 'appointment')).toBe(true)

    const med = searchClinic(clinic, 'amox')
    expect(med.some((h) => h.kind === 'medication')).toBe(true)
  })
})

describe('phase2 pagination', () => {
  it('slices without losing source data', () => {
    const items = Array.from({ length: 120 }, (_, i) => i + 1)
    expect(paginateSlice(items, 1, 50)).toHaveLength(50)
    expect(paginateSlice(items, 3, 50)).toEqual([101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120])
    expect(items).toHaveLength(120)
  })
})

describe('phase2 i18n', () => {
  it('covers FR and AR UX keys', () => {
    expect(translate('fr', 'search.placeholder')).toContain('DentiSuite')
    expect(translate('ar', 'search.placeholder')).toContain('DentiSuite')
    expect(translate('fr', 'toast.patientArchived')).toBeTruthy()
    expect(translate('ar', 'nav.backToPatient')).toBeTruthy()
    expect(translate('fr', 'ui.pagination.of')).toBe('sur')
  })
})
