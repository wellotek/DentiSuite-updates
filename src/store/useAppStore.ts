import { create } from 'zustand'
import type {
  ActItem,
  AppointmentDraft,
  CareStatus,
  ClinicSettings,
  ClinicState,
  DentistDraft,
  Invoice,
  InvoiceDraft,
  PatientDraft,
  PatientMedia,
  PatientMediaDraft,
  PatientSessionDraft,
  PaymentStatus,
  Prescription,
  PrescriptionDraft,
  ProsthesisDraft,
  ProsthesisStatus,
  StockItemDraft,
  ToothStatus,
  Treatment,
} from '../types'
import { loadClinic, saveClinic } from '../lib/storage'
import { activateLicense as activateLicenseRequest, loadLicenseStatus, retryLicense as retryLicenseRequest } from '../lib/license'
import type { LicenseStatus } from '../types'
import { dentistName } from '../lib/dentists'
import { seedClinic } from '../data/seed'
import { toothStatusForCare } from '../data/acts'
import { toISODate } from '../lib/agenda'
import { isCloudClinicMode } from '../cloud/cloudClinicMode'
import { isCloudModeActive } from '../cloud/bridge'
import {
  createCloudPatient,
  deleteCloudPatient,
  updateCloudPatient,
} from '../cloud/modules/patients'
import {
  createAppointment as createCloudAppointment,
  deleteAppointment as deleteCloudAppointment,
  updateAppointment as updateCloudAppointment,
} from '../cloud/modules/appointments'
import {
  createDentist as createCloudDentist,
  deleteDentist as deleteCloudDentist,
  updateDentist as updateCloudDentist,
} from '../cloud/modules/dentists'
import {
  createInvoice as createCloudInvoice,
  deleteInvoice as deleteCloudInvoice,
  updateInvoice as updateCloudInvoice,
} from '../cloud/modules/billing'
import {
  createStockItem as createCloudStockItem,
  deleteStockItem as deleteCloudStockItem,
  updateStockItem as updateCloudStockItem,
} from '../cloud/modules/stock'
import {
  createProsthesis as createCloudProsthesis,
  updateProsthesis as updateCloudProsthesis,
} from '../cloud/modules/prostheses'
import {
  createPrescription as createCloudPrescription,
  updatePrescription as updateCloudPrescription,
} from '../cloud/modules/prescriptions'
import {
  createTreatment as createCloudTreatment,
  updateTreatment as updateCloudTreatmentApi,
  createConsultation as createCloudConsultation,
  updateConsultation as updateCloudConsultation,
} from '../cloud/modules/clinical'
import {
  completeMedia,
  createMediaUpload,
  deleteMedia as deleteCloudMedia,
  putToSignedUrl,
} from '../cloud/modules/media'
import {
  mapCloudAppointmentToStore,
  mapCloudConsultationToSession,
  mapCloudDentistToStore,
  mapCloudInvoiceToStore,
  mapCloudMediaToStore,
  mapCloudPatientToStore,
  mapCloudPrescriptionToStore,
  mapCloudProsthesisToStore,
  mapCloudStockToStore,
  mapCloudTreatmentToStore,
} from '../cloud/clinicMirror'

function invoiceLabel(line: Pick<Treatment, 'code' | 'act' | 'tooth'>) {
  return `${line.code ? `${line.code} · ` : ''}${line.act}${line.tooth && line.tooth !== '—' ? ` · dent ${line.tooth}` : ''}`
}

function matchesInvoice(inv: Invoice, treatmentId: string) {
  return inv.treatmentId === treatmentId || inv.id === `i-${treatmentId}` || inv.id === `i${treatmentId}`
}

function upsertTreatmentInvoice(invoices: Invoice[], line: Treatment, patientName: string): Invoice[] {
  const existing = invoices.find((inv) => matchesInvoice(inv, line.id))
  const nextInv: Invoice = {
    id: existing?.id ?? `i-${line.id}`,
    treatmentId: line.id,
    patientId: line.patientId,
    patientName: existing?.patientName || patientName,
    label: invoiceLabel(line),
    amount: line.cost,
    paid: existing?.paid ?? line.paymentStatus === 'paye',
    date: line.date,
  }
  if (existing) return invoices.map((inv) => (inv.id === existing.id ? nextInv : inv))
  return [nextInv, ...invoices]
}

function removeTreatmentInvoice(invoices: Invoice[], treatmentId: string) {
  return invoices.filter((inv) => !matchesInvoice(inv, treatmentId))
}

function patientDisplayName(clinic: ClinicState, patientId: string) {
  const patient = clinic.patients.find((p) => p.id === patientId)
  return patient ? `${patient.firstName} ${patient.lastName}` : ''
}

const emptyClinic = (): ClinicState => ({
  schemaVersion: 8,
  patients: [],
  appointments: [],
  prostheses: [],
  invoices: [],
  treatments: [],
  dentists: [],
  settings: seedClinic.settings,
  actCatalog: seedClinic.actCatalog,
  stockItems: [],
  sessions: [],
  mediaFiles: [],
  prescriptions: [],
})

interface AppStore {
  hydrated: boolean
  license: LicenseStatus
  clinic: ClinicState
  hydrate: () => Promise<void>
  activateLicense: (
    licenseId: string,
    activationCode: string,
  ) => Promise<{ ok: boolean; error?: string; status?: LicenseStatus }>
  applyLicenseStatus: (status: LicenseStatus) => void
  retryLicense: () => Promise<LicenseStatus>
  addPatient: (patient: PatientDraft) => string
  updatePatient: (id: string, patient: PatientDraft) => void
  deletePatient: (id: string) => void
  setToothStatus: (patientId: string, tooth: string, status: ToothStatus, note?: string) => void
  addTreatment: (treatment: Omit<Treatment, 'id'>, syncTooth?: boolean) => void
  updateTreatment: (id: string, patch: Partial<Treatment>) => void
  deleteTreatment: (id: string) => void
  applyCareAct: (input: {
    patientId: string
    patientName: string
    teeth: string[]
    act: ActItem
    careStatus: CareStatus
    comment?: string
    date?: string
    cost?: number
  }) => void
  toggleActFavorite: (actId: string) => void
  setTreatmentPayment: (id: string, status: PaymentStatus) => void
  updateProsthesisStatus: (id: string, status: ProsthesisStatus) => void
  addProsthesis: (draft: ProsthesisDraft) => void
  updateProsthesis: (id: string, patch: Partial<ProsthesisDraft>) => void
  deleteProsthesis: (id: string) => void
  addDentist: (draft: DentistDraft) => string
  updateDentist: (id: string, draft: DentistDraft) => void
  deleteDentist: (id: string) => void
  updateSettings: (patch: Partial<ClinicSettings>) => void
  addAppointment: (draft: AppointmentDraft) => void
  updateAppointment: (id: string, patch: Partial<AppointmentDraft>) => void
  deleteAppointment: (id: string) => void
  addInvoice: (draft: InvoiceDraft) => void
  updateInvoice: (id: string, patch: Partial<InvoiceDraft>) => void
  deleteInvoice: (id: string) => void
  addStockItem: (draft: StockItemDraft) => void
  updateStockItem: (id: string, patch: Partial<StockItemDraft>) => void
  deleteStockItem: (id: string) => void
  adjustStockQuantity: (id: string, delta: number) => void
  addSession: (draft: PatientSessionDraft) => void
  updateSession: (id: string, patch: Partial<PatientSessionDraft>) => void
  deleteSession: (id: string) => void
  addMedia: (draft: PatientMediaDraft) => void
  updateMedia: (id: string, patch: Partial<PatientMedia>) => void
  deleteMedia: (id: string) => void
  addPrescription: (draft: PrescriptionDraft) => Prescription
  updatePrescription: (id: string, patch: Partial<PrescriptionDraft>) => void
  deletePrescription: (id: string) => void
  /** Cloud mirror: replace clinic in memory without local JSON persist. */
  replaceClinicMirror: (clinic: ClinicState) => void
  /** Cloud-aware creates that return server UUID. */
  addPatientCloud: (patient: PatientDraft) => Promise<string>
  addDentistCloud: (draft: DentistDraft) => Promise<string>
  addAppointmentCloud: (draft: AppointmentDraft) => Promise<string>
}

export const useAppStore = create<AppStore>((set, get) => {
  const persist = (clinic: ClinicState) => {
    set({ clinic })
    // Cloud mirror lives in memory only — never dual-write local JSON.
    if (!isCloudClinicMode()) void saveClinic(clinic)
  }

  return {
    hydrated: false,
    license: {
      activated: false,
      screen: 'activate',
      message: null,
      product: 'DentiSuite',
      version: 'V8',
      licenseId: null,
    },
    clinic: emptyClinic(),

    hydrate: async () => {
      const license = await loadLicenseStatus()
      const cloud = await isCloudModeActive().catch(() => false)
      if (cloud) {
        set({
          hydrated: true,
          clinic: emptyClinic(),
          license: { ...license, activated: true, screen: 'ok' },
        })
        return
      }
      const clinic = await loadClinic()
      set({
        hydrated: true,
        clinic,
        license,
      })
    },

    replaceClinicMirror: (clinic) => {
      set({ clinic })
    },

    addPatientCloud: async (patient) => {
      const created = await createCloudPatient({
        firstName: patient.firstName,
        lastName: patient.lastName,
        phone: patient.phone,
        age: patient.age,
        address: patient.address || '',
        antecedents: patient.antecedents || 'Aucun',
        hasAllergies: Boolean(patient.hasAllergies),
        dentistId: patient.dentistId || null,
        notes: patient.notes || null,
      })
      const mapped = mapCloudPatientToStore(created)
      persist({ ...get().clinic, patients: [...get().clinic.patients, mapped] })
      return mapped.id
    },

    addDentistCloud: async (draft) => {
      const created = await createCloudDentist({
        firstName: draft.firstName,
        lastName: draft.lastName,
        specialty: draft.specialty,
        photo: draft.photo || null,
        color: draft.color,
      })
      const mapped = mapCloudDentistToStore(created)
      persist({ ...get().clinic, dentists: [...(get().clinic.dentists ?? []), mapped] })
      return mapped.id
    },

    addAppointmentCloud: async (draft) => {
      const created = await createCloudAppointment({
        date: draft.date,
        time: draft.time,
        durationMin: draft.durationMin,
        patientId: draft.patientId,
        motif: draft.motif,
        practitioner: draft.practitioner,
        dentistId: draft.dentistId || null,
        status: draft.status,
        category: draft.category,
      })
      const mapped = mapCloudAppointmentToStore(created)
      if (!mapped.patientName) mapped.patientName = draft.patientName
      if (!mapped.patientPhone) mapped.patientPhone = draft.patientPhone
      persist({ ...get().clinic, appointments: [...get().clinic.appointments, mapped] })
      return mapped.id
    },

    activateLicense: async (licenseId, activationCode) => {
      return activateLicenseRequest(licenseId, activationCode)
    },

    applyLicenseStatus: (status) => {
      set({ license: status })
    },

    retryLicense: async () => {
      const status = await retryLicenseRequest()
      set({ license: status })
      return status
    },

    addPatient: (patient) => {
      if (isCloudClinicMode()) {
        throw new Error('CLOUD_USE_addPatientCloud')
      }
      const id = `p${Date.now()}`
      persist({
        ...get().clinic,
        patients: [...get().clinic.patients, { ...patient, id, teeth: {} }],
      })
      return id
    },

    updatePatient: (id, patient) => {
      const clinic = get().clinic
      const previous = clinic.patients.find((p) => p.id === id)
      const oldName = previous ? `${previous.firstName} ${previous.lastName}` : ''
      const name = `${patient.firstName} ${patient.lastName}`
      persist({
        ...clinic,
        patients: clinic.patients.map((p) => (p.id === id ? { ...p, ...patient, id, teeth: p.teeth } : p)),
        appointments: clinic.appointments.map((a) =>
          a.patientId === id ? { ...a, patientName: name, patientPhone: patient.phone } : a,
        ),
        prostheses: clinic.prostheses.map((pr) => (pr.patientId === id ? { ...pr, patientName: name } : pr)),
        invoices: clinic.invoices.map((inv) =>
          inv.patientId === id || (!inv.patientId && inv.patientName === oldName)
            ? { ...inv, patientName: name, patientId: id }
            : inv,
        ),
        prescriptions: (clinic.prescriptions ?? []).map((rx) =>
          rx.patientId === id || (!rx.patientId && rx.patientName === oldName)
            ? { ...rx, patientName: name, patientId: id }
            : rx,
        ),
      })
      if (isCloudClinicMode()) {
        void updateCloudPatient({
          id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          phone: patient.phone,
          age: patient.age,
          address: patient.address || '',
          antecedents: patient.antecedents || 'Aucun',
          hasAllergies: Boolean(patient.hasAllergies),
          dentistId: patient.dentistId || null,
          notes: patient.notes || null,
        }).catch(() => undefined)
      }
    },

    deletePatient: (id) => {
      const clinic = get().clinic
      const previous = clinic.patients.find((p) => p.id === id)
      const name = previous ? `${previous.firstName} ${previous.lastName}` : ''
      persist({
        ...clinic,
        patients: clinic.patients.filter((p) => p.id !== id),
        appointments: clinic.appointments.filter((a) => a.patientId !== id),
        treatments: (clinic.treatments ?? []).filter((t) => t.patientId !== id),
        prostheses: clinic.prostheses.filter((pr) => pr.patientId !== id),
        sessions: (clinic.sessions ?? []).filter((s) => s.patientId !== id),
        mediaFiles: (clinic.mediaFiles ?? []).filter((m) => m.patientId !== id),
        invoices: clinic.invoices.filter((inv) =>
          inv.patientId ? inv.patientId !== id : inv.patientName !== name,
        ),
        prescriptions: (clinic.prescriptions ?? []).filter((rx) =>
          rx.patientId ? rx.patientId !== id : rx.patientName !== name,
        ),
      })
      if (isCloudClinicMode()) {
        void deleteCloudPatient(id).catch(() => undefined)
      }
    },

    setToothStatus: (patientId, tooth, status, note) => {
      persist({
        ...get().clinic,
        patients: get().clinic.patients.map((p) =>
          p.id !== patientId
            ? p
            : {
                ...p,
                teeth: {
                  ...(p.teeth ?? {}),
                  [tooth]: { number: tooth, status, note: note ?? p.teeth?.[tooth]?.note },
                },
              },
        ),
      })
    },

    addTreatment: (treatment, syncTooth = true) => {
      if (isCloudClinicMode()) {
        void createCloudTreatment(treatment.patientId, {
          date: treatment.date,
          tooth: treatment.tooth,
          act: treatment.act,
          code: treatment.code,
          cost: treatment.cost,
          comment: treatment.comment || null,
          careStatus: treatment.careStatus,
          paymentStatus: treatment.paymentStatus,
        })
          .then((created) => {
            const line = mapCloudTreatmentToStore(created)
            const clinic = get().clinic
            const next: ClinicState = {
              ...clinic,
              treatments: [line, ...(clinic.treatments ?? []).filter((t) => t.id !== line.id)],
            }
            if (line.careStatus === 'fait') {
              next.invoices = upsertTreatmentInvoice(
                clinic.invoices,
                line,
                patientDisplayName(clinic, line.patientId),
              )
            }
            persist(next)
          })
          .catch(() => undefined)
        return
      }
      const clinic = get().clinic
      const line: Treatment = {
        ...treatment,
        id: `t${Date.now()}`,
      }
      const next: ClinicState = {
        ...clinic,
        treatments: [line, ...(clinic.treatments ?? [])],
      }
      if (syncTooth && line.tooth && line.tooth !== '—') {
        const catalog = clinic.actCatalog.find((a) => a.id === line.actId || a.code === line.code)
        const status = catalog
          ? toothStatusForCare(catalog, line.careStatus)
          : line.careStatus === 'a_faire'
            ? 'a_traiter'
            : 'traitee'
        next.patients = next.patients.map((p) =>
          p.id !== line.patientId
            ? p
            : {
                ...p,
                teeth: {
                  ...(p.teeth ?? {}),
                  [line.tooth]: { number: line.tooth, status, note: p.teeth?.[line.tooth]?.note },
                },
              },
        )
      }
      if (line.careStatus === 'fait') {
        next.invoices = upsertTreatmentInvoice(clinic.invoices, line, patientDisplayName(clinic, line.patientId))
      }
      persist(next)
    },

    updateTreatment: (id, patch) => {
      const clinic = get().clinic
      const previous = clinic.treatments.find((t) => t.id === id)
      if (!previous) return
      const updated = { ...previous, ...patch }
      const next: ClinicState = {
        ...clinic,
        treatments: clinic.treatments.map((t) => (t.id === id ? updated : t)),
      }
      const name = patientDisplayName(clinic, updated.patientId)
      if (updated.careStatus === 'fait') {
        next.invoices = upsertTreatmentInvoice(clinic.invoices, updated, name)
      } else if (previous.careStatus === 'fait') {
        next.invoices = removeTreatmentInvoice(clinic.invoices, id)
      }
      if (previous.careStatus !== updated.careStatus && updated.tooth && updated.tooth !== '—') {
        const catalog = clinic.actCatalog.find((a) => a.id === updated.actId || a.code === updated.code)
        next.patients = next.patients.map((p) =>
          p.id !== updated.patientId
            ? p
            : {
                ...p,
                teeth: {
                  ...(p.teeth ?? {}),
                  [updated.tooth]: {
                    number: updated.tooth,
                    status: catalog
                      ? toothStatusForCare(catalog, updated.careStatus)
                      : updated.careStatus === 'a_faire'
                        ? 'a_traiter'
                        : 'traitee',
                    note: p.teeth?.[updated.tooth]?.note,
                  },
                },
              },
        )
      }
      persist(next)
      if (isCloudClinicMode()) {
        void updateCloudTreatmentApi(id, patch as Record<string, unknown>).catch(() => undefined)
      }
    },

    deleteTreatment: (id) => {
      const clinic = get().clinic
      persist({
        ...clinic,
        treatments: (clinic.treatments ?? []).filter((t) => t.id !== id),
        invoices: removeTreatmentInvoice(clinic.invoices, id),
      })
    },

    applyCareAct: ({ patientId, patientName, teeth, act, careStatus, comment = '', date, cost }) => {
      const clinic = get().clinic
      const targets = teeth.length ? teeth : ['—']
      const day = date ?? toISODate(new Date())
      const stamp = Date.now()
      const amount = Number.isFinite(cost) ? Math.max(0, Math.round(cost as number)) : act.tariff
      const created: Treatment[] = targets.map((tooth, index) => ({
        id: `t${stamp}${index}`,
        patientId,
        date: day,
        tooth,
        act: act.name,
        code: act.code,
        cost: amount,
        comment,
        careStatus,
        paymentStatus: 'en_attente',
        actId: act.id,
      }))
      let patients = clinic.patients
      for (const line of created) {
        if (line.tooth === '—') continue
        patients = patients.map((p) =>
          p.id !== patientId
            ? p
            : {
                ...p,
                teeth: {
                  ...(p.teeth ?? {}),
                  [line.tooth]: {
                    number: line.tooth,
                    status: toothStatusForCare(act, careStatus),
                    note: p.teeth?.[line.tooth]?.note,
                  },
                },
              },
        )
      }
      let invoices = clinic.invoices
      if (careStatus === 'fait') {
        for (const line of [...created].reverse()) {
          invoices = upsertTreatmentInvoice(invoices, line, patientName)
        }
      }
      persist({
        ...clinic,
        patients,
        treatments: [...created, ...(clinic.treatments ?? [])],
        invoices,
      })
    },

    toggleActFavorite: (actId) => {
      persist({
        ...get().clinic,
        actCatalog: get().clinic.actCatalog.map((a) =>
          a.id === actId ? { ...a, favorite: !a.favorite } : a,
        ),
      })
    },

    setTreatmentPayment: (id, status) => {
      persist({
        ...get().clinic,
        treatments: (get().clinic.treatments ?? []).map((t) =>
          t.id === id ? { ...t, paymentStatus: status } : t,
        ),
      })
    },

    updateProsthesisStatus: (id, status) => {
      persist({
        ...get().clinic,
        prostheses: get().clinic.prostheses.map((item) =>
          item.id === id ? { ...item, status } : item,
        ),
      })
    },

    addProsthesis: (draft) => {
      if (isCloudClinicMode()) {
        void createCloudProsthesis(draft.patientId, {
          type: draft.type,
          tooth: draft.tooth,
          lab: draft.lab,
          sentAt: draft.sentAt,
          expectedAt: draft.expectedAt || null,
          notes: draft.notes || null,
          status: draft.status,
        })
          .then((created) => {
            const mapped = mapCloudProsthesisToStore(created)
            if (!mapped.patientName) mapped.patientName = draft.patientName
            persist({
              ...get().clinic,
              prostheses: [mapped, ...(get().clinic.prostheses ?? []).filter((p) => p.id !== mapped.id)],
            })
          })
          .catch(() => undefined)
        return
      }
      persist({
        ...get().clinic,
        prostheses: [{ ...draft, id: `pr${Date.now()}` }, ...(get().clinic.prostheses ?? [])],
      })
    },

    updateProsthesis: (id, patch) => {
      persist({
        ...get().clinic,
        prostheses: (get().clinic.prostheses ?? []).map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      })
      if (isCloudClinicMode()) {
        void updateCloudProsthesis(id, patch as Record<string, unknown>).catch(() => undefined)
      }
    },

    deleteProsthesis: (id) => {
      persist({
        ...get().clinic,
        prostheses: (get().clinic.prostheses ?? []).filter((item) => item.id !== id),
      })
      // Cloud API has no prosthesis delete yet — local mirror only.
    },

    addDentist: (draft) => {
      if (isCloudClinicMode()) {
        throw new Error('CLOUD_USE_addDentistCloud')
      }
      const id = `d${Date.now()}`
      persist({
        ...get().clinic,
        dentists: [...(get().clinic.dentists ?? []), { ...draft, id }],
      })
      return id
    },

    updateDentist: (id, draft) => {
      const clinic = get().clinic
      const dentists = clinic.dentists.map((d) => (d.id === id ? { ...d, ...draft, id } : d))
      const dentist = dentists.find((d) => d.id === id)
      persist({
        ...clinic,
        dentists,
        appointments: clinic.appointments.map((a) =>
          a.dentistId === id && dentist ? { ...a, practitioner: dentistName(dentist) } : a,
        ),
      })
      if (isCloudClinicMode()) {
        void updateCloudDentist(id, {
          firstName: draft.firstName,
          lastName: draft.lastName,
          specialty: draft.specialty,
          photo: draft.photo || null,
          color: draft.color,
        }).catch(() => undefined)
      }
    },

    deleteDentist: (id) => {
      const clinic = get().clinic
      persist({
        ...clinic,
        dentists: clinic.dentists.filter((d) => d.id !== id),
        patients: clinic.patients.map((p) =>
          p.dentistId === id ? { ...p, dentistId: undefined } : p,
        ),
        appointments: clinic.appointments.map((a) =>
          a.dentistId === id ? { ...a, dentistId: undefined, practitioner: '' } : a,
        ),
      })
      if (isCloudClinicMode()) {
        void deleteCloudDentist(id).catch(() => undefined)
      }
    },

    updateSettings: (patch) => {
      persist({
        ...get().clinic,
        settings: { ...get().clinic.settings, ...patch },
      })
    },

    addAppointment: (draft) => {
      if (isCloudClinicMode()) {
        throw new Error('CLOUD_USE_addAppointmentCloud')
      }
      persist({
        ...get().clinic,
        appointments: [...get().clinic.appointments, { ...draft, id: `a${Date.now()}` }],
      })
    },

    updateAppointment: (id, patch) => {
      persist({
        ...get().clinic,
        appointments: get().clinic.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      })
      if (isCloudClinicMode()) {
        void updateCloudAppointment(id, patch as Record<string, unknown>).catch(() => undefined)
      }
    },

    deleteAppointment: (id) => {
      persist({
        ...get().clinic,
        appointments: get().clinic.appointments.filter((a) => a.id !== id),
      })
      if (isCloudClinicMode()) {
        void deleteCloudAppointment(id).catch(() => undefined)
      }
    },

    addInvoice: (draft) => {
      if (isCloudClinicMode()) {
        if (!draft.patientId) return
        void createCloudInvoice(draft.patientId, {
          label: draft.label,
          amount: draft.amount,
          paid: draft.paid,
          date: draft.date,
        })
          .then((created) => {
            const mapped = mapCloudInvoiceToStore(created, draft.patientName)
            persist({
              ...get().clinic,
              invoices: [mapped, ...(get().clinic.invoices ?? []).filter((i) => i.id !== mapped.id)],
            })
          })
          .catch(() => undefined)
        return
      }
      persist({
        ...get().clinic,
        invoices: [{ ...draft, id: `inv${Date.now()}` }, ...(get().clinic.invoices ?? [])],
      })
    },

    updateInvoice: (id, patch) => {
      persist({
        ...get().clinic,
        invoices: (get().clinic.invoices ?? []).map((inv) => (inv.id === id ? { ...inv, ...patch } : inv)),
      })
      if (isCloudClinicMode()) {
        void updateCloudInvoice(id, patch as Record<string, unknown>).catch(() => undefined)
      }
    },

    deleteInvoice: (id) => {
      persist({
        ...get().clinic,
        invoices: (get().clinic.invoices ?? []).filter((inv) => inv.id !== id),
      })
      if (isCloudClinicMode()) {
        void deleteCloudInvoice(id).catch(() => undefined)
      }
    },

    addStockItem: (draft) => {
      if (isCloudClinicMode()) {
        void createCloudStockItem({
          code: draft.code,
          name: draft.name,
          category: draft.category,
          quantity: draft.quantity,
          minQuantity: draft.minQuantity,
          unitPrice: draft.unitPrice,
          addedAt: draft.addedAt,
          expiryDate: draft.expiryDate || null,
          supplier: draft.supplier || null,
        })
          .then((created) => {
            const mapped = mapCloudStockToStore(created)
            persist({
              ...get().clinic,
              stockItems: [mapped, ...(get().clinic.stockItems ?? []).filter((s) => s.id !== mapped.id)],
            })
          })
          .catch(() => undefined)
        return
      }
      persist({
        ...get().clinic,
        stockItems: [{ ...draft, id: `st${Date.now()}` }, ...(get().clinic.stockItems ?? [])],
      })
    },

    updateStockItem: (id, patch) => {
      persist({
        ...get().clinic,
        stockItems: (get().clinic.stockItems ?? []).map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      })
      if (isCloudClinicMode()) {
        void updateCloudStockItem(id, patch as Record<string, unknown>).catch(() => undefined)
      }
    },

    deleteStockItem: (id) => {
      persist({
        ...get().clinic,
        stockItems: (get().clinic.stockItems ?? []).filter((item) => item.id !== id),
      })
      if (isCloudClinicMode()) {
        void deleteCloudStockItem(id).catch(() => undefined)
      }
    },

    adjustStockQuantity: (id, delta) => {
      const item = get().clinic.stockItems.find((s) => s.id === id)
      const nextQty = item ? Math.max(0, item.quantity + delta) : 0
      persist({
        ...get().clinic,
        stockItems: (get().clinic.stockItems ?? []).map((s) =>
          s.id === id ? { ...s, quantity: nextQty } : s,
        ),
      })
      if (isCloudClinicMode() && item) {
        void updateCloudStockItem(id, { quantity: nextQty }).catch(() => undefined)
      }
    },

    addSession: (draft) => {
      if (isCloudClinicMode()) {
        void createCloudConsultation(draft.patientId, {
          date: draft.date,
          time: draft.time,
          teeth: draft.teeth,
          acts: draft.acts,
          notes: draft.notes,
          prescription: draft.prescription || null,
        })
          .then((created) => {
            const mapped = mapCloudConsultationToSession(created)
            persist({
              ...get().clinic,
              sessions: [mapped, ...(get().clinic.sessions ?? []).filter((s) => s.id !== mapped.id)],
            })
          })
          .catch(() => undefined)
        return
      }
      persist({
        ...get().clinic,
        sessions: [{ ...draft, id: `ses${Date.now()}` }, ...(get().clinic.sessions ?? [])],
      })
    },

    updateSession: (id, patch) => {
      persist({
        ...get().clinic,
        sessions: (get().clinic.sessions ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
      })
      if (isCloudClinicMode()) {
        void updateCloudConsultation(id, patch as Record<string, unknown>).catch(() => undefined)
      }
    },

    deleteSession: (id) => {
      persist({
        ...get().clinic,
        sessions: (get().clinic.sessions ?? []).filter((s) => s.id !== id),
      })
    },

    addMedia: (draft) => {
      if (isCloudClinicMode()) {
        // Cloud media requires signed upload — keep local preview only until dedicated upload UI path.
        // Prefer CloudDocumentsPage / PatientImaging cloud path; still allow chart metadata when dataUrl absent.
        if (draft.dataUrl && typeof atob === 'function') {
          void (async () => {
            try {
              const binary = atob(draft.dataUrl!.split(',')[1] || '')
              const bytes = new Uint8Array(binary.length)
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
              const blob = new Blob([bytes], { type: draft.mime })
              const init = await createMediaUpload(draft.patientId, {
                title: draft.title,
                kind: draft.kind,
                mime: draft.mime,
                originalName: draft.originalName,
                size: draft.size || blob.size,
              })
              await putToSignedUrl(init.upload, blob)
              const completed = await completeMedia(init.media.id)
              const mapped = mapCloudMediaToStore(completed)
              persist({
                ...get().clinic,
                mediaFiles: [mapped, ...(get().clinic.mediaFiles ?? []).filter((m) => m.id !== mapped.id)],
              })
            } catch {
              /* keep offline preview */
            }
          })()
        }
        persist({
          ...get().clinic,
          mediaFiles: [
            { ...draft, id: `med${Date.now()}${Math.random().toString(36).slice(2, 5)}` },
            ...(get().clinic.mediaFiles ?? []),
          ],
        })
        return
      }
      persist({
        ...get().clinic,
        mediaFiles: [{ ...draft, id: `med${Date.now()}${Math.random().toString(36).slice(2, 5)}` }, ...(get().clinic.mediaFiles ?? [])],
      })
    },

    updateMedia: (id, patch) => {
      persist({
        ...get().clinic,
        mediaFiles: (get().clinic.mediaFiles ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
      })
    },

    deleteMedia: (id) => {
      persist({
        ...get().clinic,
        mediaFiles: (get().clinic.mediaFiles ?? []).filter((m) => m.id !== id),
      })
      if (isCloudClinicMode()) {
        void deleteCloudMedia(id).catch(() => undefined)
      }
    },

    addPrescription: (draft) => {
      if (isCloudClinicMode() && draft.patientId) {
        const temp: Prescription = { ...draft, id: `rx-pending-${Date.now()}` }
        persist({
          ...get().clinic,
          prescriptions: [temp, ...(get().clinic.prescriptions ?? [])],
        })
        void createCloudPrescription(draft.patientId, {
          date: draft.date,
          title: draft.title,
          dentistId: draft.dentistId || null,
          advice: draft.advice || null,
          lines: draft.lines,
        })
          .then((created) => {
            const mapped = mapCloudPrescriptionToStore(created, draft.patientName)
            persist({
              ...get().clinic,
              prescriptions: [
                mapped,
                ...(get().clinic.prescriptions ?? []).filter((rx) => rx.id !== temp.id && rx.id !== mapped.id),
              ],
            })
          })
          .catch(() => undefined)
        return temp
      }
      const item: Prescription = { ...draft, id: `rx${Date.now()}` }
      persist({
        ...get().clinic,
        prescriptions: [item, ...(get().clinic.prescriptions ?? [])],
      })
      return item
    },

    updatePrescription: (id, patch) => {
      persist({
        ...get().clinic,
        prescriptions: (get().clinic.prescriptions ?? []).map((rx) => (rx.id === id ? { ...rx, ...patch } : rx)),
      })
      if (isCloudClinicMode()) {
        void updateCloudPrescription(id, patch as Record<string, unknown>).catch(() => undefined)
      }
    },

    deletePrescription: (id) => {
      persist({
        ...get().clinic,
        prescriptions: (get().clinic.prescriptions ?? []).filter((rx) => rx.id !== id),
      })
    },
  }
})

export type { Dentist } from '../types'
