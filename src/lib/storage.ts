import type {
  Appointment,
  ClinicSettings,
  ClinicState,
  Dentist,
  Patient,
  PatientMedia,
  PatientSession,
  StockItem,
  Treatment,
} from '../types'
import { CLINIC_SCHEMA_VERSION, seedClinic } from '../data/seed'
import { defaultActCatalog } from '../data/acts'
import { patientHasAllergies } from '../data/teeth'
import { inferCategory, toISODate } from './agenda'
import { toDZD } from './money'
import { dentistName } from './dentists'
import { applyBrandingToSettings, loadBrandingAssets } from './brandingStorage'

const LOCAL_CLINIC = 'dentisuite.clinic'

const hasBridge = () => typeof window !== 'undefined' && Boolean(window.dentisuite)

type RawPatient = Partial<Patient> & Pick<Patient, 'id' | 'firstName' | 'lastName'>

type LooseAppointment = Partial<Appointment> & {
  id: string
  time: string
  patientId: string
  patientName: string
}

type LooseClinic = Partial<ClinicState> & {
  patients?: RawPatient[]
  treatments?: Array<Partial<Treatment> & Pick<Treatment, 'id' | 'patientId' | 'date' | 'tooth' | 'act' | 'cost'>>
  appointments?: LooseAppointment[]
  invoices?: ClinicState['invoices']
  dentists?: Dentist[]
  settings?: Partial<ClinicSettings>
  actCatalog?: ClinicState['actCatalog']
  medicationCatalog?: ClinicState['medicationCatalog']
  stockItems?: StockItem[]
  sessions?: PatientSession[]
  mediaFiles?: PatientMedia[]
  prescriptions?: ClinicState['prescriptions']
}

function migratePatient(raw: RawPatient, fallback?: Patient): Patient {
  const antecedents = raw.antecedents ?? fallback?.antecedents ?? 'Aucun'
  const hasAllergies =
    raw.hasAllergies ?? fallback?.hasAllergies ?? patientHasAllergies(antecedents, false)
  const seededTeeth = fallback?.teeth ?? {}
  const teeth = raw.teeth && Object.keys(raw.teeth).length > 0 ? raw.teeth : seededTeeth

  return {
    id: raw.id,
    firstName: raw.firstName,
    lastName: raw.lastName,
    phone: raw.phone ?? fallback?.phone ?? '',
    age: raw.age ?? fallback?.age ?? 0,
    birthDate: raw.birthDate ?? fallback?.birthDate ?? null,
    archivedAt: raw.archivedAt ?? fallback?.archivedAt ?? null,
    archivedBy: raw.archivedBy ?? fallback?.archivedBy ?? null,
    updatedAt: raw.updatedAt ?? fallback?.updatedAt,
    address: raw.address ?? fallback?.address ?? '',
    antecedents,
    hasAllergies,
    dentistId: raw.dentistId ?? fallback?.dentistId,
    teeth,
    notes: raw.notes ?? fallback?.notes,
  }
}

function matchDentistId(practitioner: string | undefined, dentists: Dentist[]) {
  if (!practitioner) return undefined
  const lower = practitioner.toLowerCase()
  return dentists.find((d) => lower.includes(d.lastName.toLowerCase()))?.id
}

function migrateAppointment(raw: LooseAppointment, patients: Patient[], dentists: Dentist[]): Appointment {
  const phone =
    raw.patientPhone ??
    patients.find((p) => p.id === raw.patientId)?.phone ??
    ''
  const dentistId = raw.dentistId ?? matchDentistId(raw.practitioner, dentists)
  const dentist = dentists.find((d) => d.id === dentistId)
  return {
    id: raw.id,
    date: raw.date ?? toISODate(new Date()),
    time: raw.time,
    durationMin: raw.durationMin ?? 30,
    patientId: raw.patientId,
    patientName: raw.patientName,
    patientPhone: phone,
    motif: raw.motif ?? 'Consultation',
    practitioner: dentist ? dentistName(dentist) : (raw.practitioner ?? ''),
    dentistId,
    status: raw.status ?? 'confirme',
    category: raw.category ?? inferCategory(raw.motif ?? ''),
  }
}

export function migrateClinic(raw: LooseClinic | null | undefined): ClinicState {
  if (!raw?.patients?.length) return seedClinic

  const seedById = new Map(seedClinic.patients.map((p) => [p.id, p]))
  const patients = raw.patients.map((p) => migratePatient(p, seedById.get(p.id)))
  const previousVersion = raw.schemaVersion ?? 0

  const treatmentsSource =
    raw.treatments ?? (previousVersion >= 2 ? [] : seedClinic.treatments)
  const treatments = treatmentsSource.map((t) => ({
    id: t.id,
    patientId: t.patientId,
    date: t.date,
    tooth: t.tooth,
    act: t.act,
    code: t.code ?? '',
    cost: previousVersion < 3 ? toDZD(t.cost) : t.cost,
    comment: t.comment ?? '',
    careStatus: t.careStatus ?? 'fait',
    paymentStatus: t.paymentStatus ?? 'en_attente',
    actId: t.actId,
  }))

  const invoices = (raw.invoices ?? seedClinic.invoices).map((inv) => ({
    ...inv,
    amount: previousVersion < 3 ? toDZD(inv.amount) : inv.amount,
    treatmentId: inv.treatmentId,
  }))

  const dentists = raw.dentists?.length ? raw.dentists : seedClinic.dentists
  const settings: ClinicSettings = { ...seedClinic.settings, ...raw.settings }
  const actCatalog = raw.actCatalog?.length ? raw.actCatalog : defaultActCatalog

  const firstApt = raw.appointments?.[0]
  const appointments =
    previousVersion < 3 || !firstApt?.date
      ? seedClinic.appointments
      : raw.appointments!.map((a) => migrateAppointment(a, patients, dentists))

  return {
    schemaVersion: CLINIC_SCHEMA_VERSION,
    patients,
    appointments,
    prostheses: (raw.prostheses ?? seedClinic.prostheses).map((item) => ({
      ...item,
      expectedAt: item.expectedAt ?? '',
      notes: item.notes ?? '',
      status: item.status === 'annulee' || item.status === 'envoye' || item.status === 'fabrication' || item.status === 'recu' || item.status === 'pose'
        ? item.status
        : 'fabrication',
    })),
    invoices,
    treatments,
    dentists,
    settings,
    actCatalog,
    medicationCatalog: Array.isArray(raw.medicationCatalog) ? raw.medicationCatalog : [],
    stockItems: Array.isArray(raw.stockItems) ? raw.stockItems : seedClinic.stockItems,
    sessions: Array.isArray(raw.sessions) ? raw.sessions : seedClinic.sessions,
    mediaFiles: Array.isArray(raw.mediaFiles) ? raw.mediaFiles : [],
    prescriptions: Array.isArray(raw.prescriptions) ? raw.prescriptions : seedClinic.prescriptions,
  }
}

export async function loadClinic(): Promise<ClinicState> {
  let raw: LooseClinic | null = null
  if (hasBridge()) {
    raw = await window.dentisuite!.getClinic()
  } else {
    try {
      const stored = localStorage.getItem(LOCAL_CLINIC)
      if (stored) raw = JSON.parse(stored) as LooseClinic
    } catch {
      raw = null
    }
  }

  const clinic = migrateClinic(raw)
  const branding = await loadBrandingAssets()
  clinic.settings = applyBrandingToSettings(clinic.settings, branding)
  const needsWrite = !raw || raw.schemaVersion !== CLINIC_SCHEMA_VERSION
  if (needsWrite) await saveClinic(clinic)
  return clinic
}

export async function saveClinic(clinic: ClinicState) {
  if (hasBridge()) {
    await window.dentisuite!.setClinic(clinic)
    return
  }
  localStorage.setItem(LOCAL_CLINIC, JSON.stringify(clinic))
}
