/**
 * In-memory ClinicState mirror for CLOUD mode.
 * Maps Railway API payloads → Legacy UI types (Zustand only — never saveClinic).
 */
import { seedClinic } from '../data/seed'
import { applyBrandingToSettings, loadBrandingAssets } from '../lib/brandingStorage'
import type {
  Appointment,
  AppointmentCategory,
  AppointmentStatus,
  ClinicState,
  Dentist,
  Invoice,
  Patient,
  PatientMedia,
  PatientSession,
  Prescription,
  Prosthesis,
  ProsthesisStatus,
  StockItem,
  Treatment,
  CareStatus,
  PaymentStatus,
} from '../types'
import { listAppointments, type CloudAppointment } from './modules/appointments'
import { listInvoices, type CloudInvoice } from './modules/billing'
import {
  listOrgConsultations,
  listOrgTreatments,
  listTreatments,
  type CloudConsultation,
  type CloudTreatment,
} from './modules/clinical'
import { listDentists, type CloudDentist } from './modules/dentists'
import { listOrgMedia, type CloudMedia } from './modules/media'
import { listCloudPatients, type CloudPatient } from './modules/patients'
import { listOrgPrescriptions, type CloudPrescription } from './modules/prescriptions'
import { listProstheses, type CloudProsthesis } from './modules/prostheses'
import { listStock, type CloudStockItem } from './modules/stock'
import { useAppStore } from '../store/useAppStore'
import { fetchAllPages } from './fetchAllPages'

export function mapCloudPatientToStore(p: CloudPatient): Patient {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.phone,
    age: p.age,
    birthDate: p.birthDate ?? null,
    address: p.address || '',
    antecedents: p.antecedents || 'Aucun',
    hasAllergies: Boolean(p.hasAllergies),
    dentistId: p.dentistId || undefined,
    teeth: {},
    notes: p.notes || undefined,
    updatedAt: p.updatedAt || undefined,
    archivedAt: p.archivedAt || p.deletedAt || undefined,
  }
}

export function mapCloudDentistToStore(d: CloudDentist): Dentist {
  return {
    id: d.id,
    firstName: d.firstName,
    lastName: d.lastName,
    specialty: d.specialty || 'Omnipratique',
    photo: d.photo || '',
    color: d.color || '#0e628e',
  }
}

export function mapCloudAppointmentToStore(a: CloudAppointment): Appointment {
  return {
    id: a.id,
    date: a.date,
    time: a.time,
    durationMin: a.durationMin || 30,
    patientId: a.patientId,
    patientName: a.patientName || '',
    patientPhone: '',
    motif: a.motif || '',
    practitioner: a.practitioner || '',
    dentistId: a.dentistId || undefined,
    status: (a.status as AppointmentStatus) || 'confirme',
    category: (a.category as AppointmentCategory) || 'consultation',
  }
}

export function mapCloudInvoiceToStore(inv: CloudInvoice, patientName = ''): Invoice {
  return {
    id: inv.id,
    patientId: inv.patientId,
    patientName,
    label: inv.label,
    amount: inv.amount,
    paid: Boolean(inv.paid),
    date: inv.date,
    treatmentId: inv.treatmentId || undefined,
  }
}

export function mapCloudStockToStore(s: CloudStockItem): StockItem {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    category: (s.category as StockItem['category']) || 'consommable',
    quantity: s.quantity,
    minQuantity: s.minQuantity,
    unitPrice: s.unitPrice,
    addedAt: s.addedAt || new Date().toISOString().slice(0, 10),
    expiryDate: s.expiryDate || '',
    supplier: s.supplier || '',
  }
}

export function mapCloudProsthesisToStore(p: CloudProsthesis): Prosthesis {
  return {
    id: p.id,
    type: p.type,
    tooth: p.tooth,
    patientId: p.patientId,
    patientName: p.patientName || '',
    lab: p.lab || '',
    sentAt: p.sentAt,
    expectedAt: p.expectedAt || undefined,
    notes: p.notes || undefined,
    status: (p.status as ProsthesisStatus) || 'en_cours',
  }
}

export function mapCloudTreatmentToStore(t: CloudTreatment): Treatment {
  return {
    id: t.id,
    patientId: t.patientId,
    date: t.date,
    tooth: t.tooth || '—',
    act: t.act,
    code: t.code || '',
    cost: t.cost || 0,
    comment: t.comment || '',
    careStatus: (t.careStatus as CareStatus) || 'planifie',
    paymentStatus: (t.paymentStatus as PaymentStatus) || 'non_paye',
  }
}

export function mapCloudConsultationToSession(c: CloudConsultation): PatientSession {
  return {
    id: c.id,
    patientId: c.patientId,
    date: c.date,
    time: c.time || '09:00',
    teeth: c.teeth || [],
    acts: c.acts || '',
    notes: c.notes || '',
    prescription: c.prescription || '',
  }
}

export function mapCloudPrescriptionToStore(
  rx: CloudPrescription,
  patientName: string,
): Prescription {
  return {
    id: rx.id,
    patientId: rx.patientId,
    patientName: rx.patientName || patientName,
    patientBirthDate: rx.patientBirthDate ?? null,
    patientAge: rx.patientAge ?? null,
    date: rx.date,
    title: rx.title || 'Ordonnance',
    lines: (rx.lines || []).map((l) => ({
      id: l.id,
      drug: l.drug,
      posology: l.posology,
      duration: l.duration,
      notes: l.notes || '',
      medicationId: l.medicationId || undefined,
      dci: l.dci || undefined,
      form: l.form || undefined,
      dosage: l.dosage || undefined,
      quantity: l.quantity || undefined,
    })),
    advice: rx.advice || '',
    dentistId: rx.dentistId || undefined,
    dentistName: rx.dentistName || '',
  }
}

export function mapCloudMediaToStore(m: CloudMedia): PatientMedia {
  return {
    id: m.id,
    patientId: m.patientId,
    title: m.title,
    kind: m.kind === 'dicom' ? 'dicom' : 'image',
    mime: m.mime,
    originalName: m.originalName,
    filename: m.originalName,
    createdAt: m.createdAt,
    size: m.size,
  }
}

export async function fetchClinicMirror(options?: {
  organizationName?: string
  phone?: string
  city?: string
}): Promise<ClinicState> {
  /** API list schemas cap limit at 100 — page through until complete. */
  const lim = 100

  async function safeAllPages<T extends { id?: string }>(
    label: string,
    fetchPage: (q: Record<string, string | number | undefined>) => Promise<{
      items: T[]
      totalPages?: number
      total?: number
    }>,
    baseQuery: Record<string, string | number | undefined> = {},
  ): Promise<T[]> {
    try {
      return await fetchAllPages(fetchPage, baseQuery, { limit: lim, label })
    } catch (err) {
      // Patients: never pretend the list is empty after a read failure.
      if (label === 'patients') throw err
      console.warn(`[clinicMirror] ${label} skipped:`, err)
      return []
    }
  }

  const [
    patientItems,
    appointmentItems,
    dentistItems,
    invoiceItems,
    stockItems,
    prosthesisItems,
    consultationItems,
    prescriptionItems,
    mediaItems,
  ] = await Promise.all([
    safeAllPages('patients', (q) => listCloudPatients(q)),
    safeAllPages('appointments', (q) => listAppointments(q)),
    safeAllPages('dentists', (q) => listDentists(q)),
    safeAllPages('invoices', (q) => listInvoices(q)),
    safeAllPages('stock', (q) => listStock(q)),
    safeAllPages('prostheses', (q) => listProstheses(q)),
    safeAllPages('consultations', (q) => listOrgConsultations(q)),
    safeAllPages('prescriptions', (q) => listOrgPrescriptions(q)),
    safeAllPages('media', (q) => listOrgMedia(q)),
  ])

  // Org GET /treatments is not on the API (404). Per-patient GET works and is fail-closed.
  let treatmentItems: CloudTreatment[]
  try {
    treatmentItems = await fetchAllPages((q) => listOrgTreatments(q), {}, { limit: lim, label: 'treatments' })
  } catch {
    const pages = await Promise.all(
      patientItems.map((p) =>
        fetchAllPages((q) => listTreatments(p.id, q), {}, { limit: lim, label: 'treatments' }),
      ),
    )
    treatmentItems = pages.flat()
  }

  const patients = patientItems.map(mapCloudPatientToStore)
  const nameById = new Map(patients.map((p) => [p.id, `${p.firstName} ${p.lastName}`]))

  const appointments = appointmentItems.map((a) => {
    const mapped = mapCloudAppointmentToStore(a)
    if (!mapped.patientName) mapped.patientName = nameById.get(a.patientId) || ''
    return mapped
  })

  const invoices = invoiceItems.map((inv) =>
    mapCloudInvoiceToStore(inv, nameById.get(inv.patientId) || ''),
  )

  const prostheses = prosthesisItems.map((p) => {
    const mapped = mapCloudProsthesisToStore(p)
    if (!mapped.patientName) mapped.patientName = nameById.get(p.patientId) || ''
    return mapped
  })

  const treatments = treatmentItems.map(mapCloudTreatmentToStore)
  const sessions = consultationItems.map(mapCloudConsultationToSession)
  const prescriptions = prescriptionItems.map((rx) =>
    mapCloudPrescriptionToStore(rx, nameById.get(rx.patientId) || ''),
  )
  /** Media metadata only (no binary bytes). */
  const mediaFiles = mediaItems.map(mapCloudMediaToStore)

  const orgName = options?.organizationName?.trim()
  const settings = {
    ...seedClinic.settings,
    name: orgName || seedClinic.settings.name,
    phone: options?.phone || seedClinic.settings.phone,
    address: options?.city
      ? `${options.city}`
      : seedClinic.settings.address,
  }

  return {
    schemaVersion: seedClinic.schemaVersion,
    patients,
    appointments,
    dentists: dentistItems.map(mapCloudDentistToStore),
    invoices,
    treatments,
    prostheses,
    stockItems: stockItems.map(mapCloudStockToStore),
    sessions,
    mediaFiles,
    prescriptions,
    settings,
    actCatalog: seedClinic.actCatalog,
    medicationCatalog: useAppStore.getState().clinic.medicationCatalog ?? [],
    medicationFavoritesByUser: useAppStore.getState().clinic.medicationFavoritesByUser ?? {},
  }
}

/** Replace in-memory clinic (Cloud mode). Never touches local JSON. */
export async function applyClinicMirror(clinic: ClinicState) {
  const branding = await loadBrandingAssets()
  useAppStore.getState().replaceClinicMirror({
    ...clinic,
    settings: applyBrandingToSettings(clinic.settings, branding),
  })
}

export async function hydrateClinicMirror(options?: {
  organizationName?: string
  phone?: string
  city?: string
}) {
  const clinic = await fetchClinicMirror(options)
  await applyClinicMirror(clinic)
  return clinic
}
