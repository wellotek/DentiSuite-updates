/**
 * In-memory ClinicState mirror for CLOUD mode.
 * Maps Railway API payloads → Legacy UI types (Zustand only — never saveClinic).
 */
import { seedClinic } from '../data/seed'
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
import { listConsultations, listTreatments, type CloudConsultation, type CloudTreatment } from './modules/clinical'
import { listDentists, type CloudDentist } from './modules/dentists'
import { listMedia, type CloudMedia } from './modules/media'
import { listCloudPatients, type CloudPatient } from './modules/patients'
import { listPrescriptions, type CloudPrescription } from './modules/prescriptions'
import { listProstheses, type CloudProsthesis } from './modules/prostheses'
import { listStock, type CloudStockItem } from './modules/stock'
import { useAppStore } from '../store/useAppStore'

export function mapCloudPatientToStore(p: CloudPatient): Patient {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.phone,
    age: p.age,
    address: p.address || '',
    antecedents: p.antecedents || 'Aucun',
    hasAllergies: Boolean(p.hasAllergies),
    dentistId: p.dentistId || undefined,
    teeth: {},
    notes: p.notes || undefined,
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
    patientName,
    date: rx.date,
    title: rx.title || 'Ordonnance',
    lines: (rx.lines || []).map((l) => ({
      id: l.id,
      drug: l.drug,
      posology: l.posology,
      duration: l.duration,
      notes: l.notes || '',
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

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R[]>): Promise<R[]> {
  const out: R[] = []
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      const chunk = await fn(items[idx]!)
      out.push(...chunk)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) || 1 }, () => worker()))
  return out
}

export async function fetchClinicMirror(options?: {
  organizationName?: string
  phone?: string
  city?: string
}): Promise<ClinicState> {
  /** API list schemas cap limit at 100 — higher values 400 and abort the whole hydrate. */
  const lim = 100

  async function safeList<T>(label: string, fn: () => Promise<{ items: T[] }>): Promise<T[]> {
    try {
      const res = await fn()
      return res.items || []
    } catch (err) {
      console.warn(`[clinicMirror] ${label} skipped:`, err)
      return []
    }
  }

  const [patientItems, appointmentItems, dentistItems, invoiceItems, stockItems, prosthesisItems] =
    await Promise.all([
      safeList('patients', () => listCloudPatients({ page: 1, limit: lim })),
      safeList('appointments', () => listAppointments({ page: 1, limit: lim })),
      safeList('dentists', () => listDentists({ page: 1, limit: lim })),
      safeList('invoices', () => listInvoices({ page: 1, limit: lim })),
      safeList('stock', () => listStock({ page: 1, limit: lim })),
      safeList('prostheses', () => listProstheses({ page: 1, limit: lim })),
    ])

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

  const patientIds = patients.map((p) => p.id)
  const treatments = await mapPool(patientIds, 4, async (patientId) => {
    try {
      const list = await listTreatments(patientId, { limit: lim })
      return list.items.map(mapCloudTreatmentToStore)
    } catch {
      return []
    }
  })
  const sessions = await mapPool(patientIds, 4, async (patientId) => {
    try {
      const list = await listConsultations(patientId, { limit: lim })
      return list.items.map(mapCloudConsultationToSession)
    } catch {
      return []
    }
  })
  const prescriptions = await mapPool(patientIds, 4, async (patientId) => {
    try {
      const list = await listPrescriptions(patientId, { limit: lim })
      const pname = nameById.get(patientId) || ''
      return list.items.map((rx) => mapCloudPrescriptionToStore(rx, pname))
    } catch {
      return []
    }
  })
  const mediaFiles = await mapPool(patientIds, 4, async (patientId) => {
    try {
      const list = await listMedia(patientId, { limit: lim })
      return list.items.map(mapCloudMediaToStore)
    } catch {
      return []
    }
  })

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
  }
}

/** Replace in-memory clinic (Cloud mode). Never touches local JSON. */
export function applyClinicMirror(clinic: ClinicState) {
  useAppStore.getState().replaceClinicMirror(clinic)
}

export async function hydrateClinicMirror(options?: {
  organizationName?: string
  phone?: string
  city?: string
}) {
  const clinic = await fetchClinicMirror(options)
  applyClinicMirror(clinic)
  return clinic
}
