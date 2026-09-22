export type ProsthesisStatus = 'envoye' | 'fabrication' | 'recu' | 'pose' | 'annulee'

export type AppointmentStatus = 'confirme' | 'en_salle' | 'termine' | 'annule'

export type AppointmentCategory =
  | 'urgence'
  | 'consultation'
  | 'controle'
  | 'soin'
  | 'extraction'
  | 'prothese'

export type ToothStatus =
  | 'saine'
  | 'carie'
  | 'a_traiter'
  | 'traitee'
  | 'obturation'
  | 'couronne'
  | 'extraction'
  | 'implant'
  | 'facette'
  | 'a_surveiller'

export type CareStatus = 'a_faire' | 'fait'

export type ActCategory = 'consultation' | 'soin' | 'prothese' | 'chirurgie' | 'radio'

export interface ActItem {
  id: string
  code: string
  name: string
  category: ActCategory
  tariff: number
  favorite: boolean
  toothStatus: ToothStatus
}

export type Locale = 'fr' | 'ar'
export type DateFormat = 'long' | 'short' | 'iso'
export type TimeFormat = '24h' | '12h'

export type PaymentStatus = 'paye' | 'en_attente' | 'partiel'

export interface ToothRecord {
  number: string
  status: ToothStatus
  note?: string
}

export interface Dentist {
  id: string
  firstName: string
  lastName: string
  specialty: string
  photo: string
  color: string
}

export interface ClinicSettings {
  name: string
  address: string
  phone: string
  email: string
  logo: string
  adminPhoto: string
  dateFormat: DateFormat
  timeFormat: TimeFormat
  timezone: string
  locale: Locale
}

export interface Patient {
  id: string
  firstName: string
  lastName: string
  phone: string
  /** Stored age (legacy / fallback). Prefer birthDate when present. */
  age: number
  /** ISO date YYYY-MM-DD — source of truth for age when set. */
  birthDate?: string | null
  address: string
  antecedents: string
  hasAllergies: boolean
  dentistId?: string
  teeth: Record<string, ToothRecord>
  notes?: string
  /** ISO timestamp from Cloud — used for optimistic concurrency. */
  updatedAt?: string
  /** Soft-archive timestamp (Cloud + Legacy). Active lists exclude archived. */
  archivedAt?: string | null
  archivedBy?: string | null
}

export type MedicationStatus = 'active' | 'inactive'

export type MedicationFamily =
  | 'antibiotique'
  | 'antalgique'
  | 'anti-inflammatoire'
  | 'antiseptique'
  | 'anesthesique'
  | 'antifongique'
  | 'antiviral'
  | 'corticoide'
  | 'pediatrie'
  | 'autre'

/** Reference catalog entry — never mutated by a prescription. */
export interface MedicationItem {
  id: string
  name: string
  dci: string
  dosage: string
  form: string
  /** Conditionnement (ex. B/10) — info nomenclature, pas une posologie. */
  packaging?: string
  laboratory?: string
  /** Code produit nomenclature (ex. 01 A 003). */
  officialCode?: string
  /** N° d’enregistrement officiel. */
  registrationNumber?: string
  route?: string
  family?: MedicationFamily | string
  market?: string
  status: MedicationStatus
  source: string
  /** Version de la nomenclature (ex. Août 2026). */
  sourceVersion?: string
  importedAt?: string
  /** official = MIPH ; custom = ajout cabinet. */
  origin?: 'official' | 'custom'
  lastVerifiedAt: string
}

export interface Treatment {
  id: string
  patientId: string
  date: string
  tooth: string
  act: string
  code: string
  cost: number
  comment: string
  careStatus: CareStatus
  paymentStatus: PaymentStatus
  actId?: string
}

export interface Appointment {
  id: string
  date: string
  time: string
  durationMin: number
  patientId: string
  patientName: string
  patientPhone: string
  motif: string
  practitioner: string
  dentistId?: string
  status: AppointmentStatus
  category: AppointmentCategory
}

export interface Prosthesis {
  id: string
  type: string
  tooth: string
  patientId: string
  patientName: string
  lab: string
  sentAt: string
  expectedAt?: string
  notes?: string
  status: ProsthesisStatus
}

export type ProsthesisDraft = Omit<Prosthesis, 'id'>

export interface Invoice {
  id: string
  patientId?: string
  patientName: string
  label: string
  amount: number
  paid: boolean
  date: string
  treatmentId?: string
}

export type InvoiceDraft = Omit<Invoice, 'id' | 'treatmentId'>

export type StockCategory = 'consommable' | 'prothese' | 'hygiene' | 'medicament'

export type StockAlert = 'ok' | 'low' | 'expiring' | 'expired'

export interface StockItem {
  id: string
  code: string
  name: string
  category: StockCategory
  quantity: number
  minQuantity: number
  unitPrice: number
  addedAt: string
  expiryDate: string
  supplier: string
}

export type StockItemDraft = Omit<StockItem, 'id'>

export interface PatientSession {
  id: string
  patientId: string
  date: string
  time: string
  teeth: string[]
  acts: string
  notes: string
  prescription: string
}

export type MediaKind = 'image' | 'dicom'

export interface PatientMedia {
  id: string
  patientId: string
  title: string
  kind: MediaKind
  mime: string
  originalName: string
  filename: string
  dataUrl?: string
  thumbnailUrl?: string
  createdAt: string
  size: number
}

export type PatientSessionDraft = Omit<PatientSession, 'id'>
export type PatientMediaDraft = Omit<PatientMedia, 'id'>

export interface PrescriptionLine {
  id: string
  drug: string
  posology: string
  duration: string
  notes: string
  /** Catalog reference id at selection time (optional; snapshot, not a live FK). */
  medicationId?: string
  dci?: string
  form?: string
  dosage?: string
  quantity?: string
}

export interface Prescription {
  id: string
  patientId?: string
  patientName: string
  /** Snapshot at prescription time (YYYY-MM-DD). */
  patientBirthDate?: string | null
  /** Snapshot age at prescription time. */
  patientAge?: number | null
  date: string
  title: string
  templateId?: string
  lines: PrescriptionLine[]
  advice: string
  dentistId?: string
  dentistName: string
}

export type PrescriptionDraft = Omit<Prescription, 'id'>

export interface ClinicState {
  schemaVersion: number
  patients: Patient[]
  appointments: Appointment[]
  prostheses: Prosthesis[]
  invoices: Invoice[]
  treatments: Treatment[]
  dentists: Dentist[]
  settings: ClinicSettings
  actCatalog: ActItem[]
  /** Clinic overrides + custom meds (merged with global seed). */
  medicationCatalog: MedicationItem[]
  /** Favoris médicaments par compte/praticien (clé = userId Cloud ou "legacy"). */
  medicationFavoritesByUser?: Record<string, string[]>
  stockItems: StockItem[]
  sessions: PatientSession[]
  mediaFiles: PatientMedia[]
  prescriptions: Prescription[]
}

export interface LicenseStatus {
  activated: boolean
  screen: 'ok' | 'activate' | 'offline' | 'blocked'
  message: string | null
  product: string
  version: string
  licenseId: string | null
}

export interface DentiSuiteAPI {
  getLicenseStatus?: () => Promise<LicenseStatus>
  activateLicense?: (
    licenseId: string,
    activationCode: string,
  ) => Promise<{ ok: boolean; error?: string; status?: LicenseStatus }>
  retryLicense?: () => Promise<LicenseStatus>
  getClinic: () => Promise<ClinicState | null>
  setClinic: (clinic: ClinicState) => Promise<void | { ok?: boolean; code?: string; message?: string }>
  getBranding?: () => Promise<{ logo: string; adminPhoto: string }>
  setBranding?: (branding: { logo: string; adminPhoto: string }) => Promise<{ ok?: boolean }>
  saveMedia?: (input: {
    patientId: string
    fileId: string
    name: string
    dataBase64: string
  }) => Promise<string | { ok: boolean; filename?: string; error?: string }>
  readMedia?: (input: { patientId: string; filename: string }) => Promise<string | null>
  deleteMedia?: (input: { patientId: string; filename: string }) => Promise<void>
  /** Cloud product config (APP_MODE CLOUD|LEGACY) — token never returned to renderer */
  cloudConfig?: () => Promise<{
    appMode?: 'CLOUD' | 'LEGACY'
    probeEnabled: boolean
    apiBaseUrl: string
    cloudMode: boolean
  }>
  cloudHasSession?: () => Promise<{
    probeEnabled: boolean
    hasSession: boolean
    encryptionAvailable?: boolean
    appMode?: string
  }>
  cloudLogin?: (
    email: string,
    password: string,
  ) => Promise<
    | {
        ok: true
        authenticated?: boolean
        state?: string
        user?: unknown
        organization?: unknown
        membership?: unknown
        role?: unknown
        permissions?: unknown
        context?: unknown
      }
    | { ok: false; code: string; message: string; status: number }
  >
  cloudBootstrapOrganization?: (payload: {
    licenseKey: string
    organizationName: string
    adminEmail: string
    adminPassword: string
    adminName: string
    phone?: string
    city?: string
  }) => Promise<
    | {
        ok: true
        authenticated?: boolean
        state?: string
        user?: unknown
        organization?: unknown
        membership?: unknown
        role?: unknown
        permissions?: unknown
        context?: unknown
      }
    | { ok: false; code: string; message: string; status: number }
  >
  cloudOnboardingStatus?: (licenseKey: string) => Promise<
    | { ok: true; licenseKey: string; registered: boolean; organizationName: string | null }
    | { ok: false; code: string; message: string; status: number }
  >
  cloudLogout?: () => Promise<
    | { ok: true; apiRevoked?: boolean; state?: string; context?: unknown }
    | { ok: false; code: string; message: string; status: number }
  >
  cloudRestore?: () => Promise<
    | { ok: true; context: unknown }
    | { ok: false; code: string; message: string; status: number }
  >
  cloudState?: () => Promise<{ ok: true; context: unknown }>
  cloudRequest?: (input: {
    method?: string
    path: string
    query?: Record<string, string | number | undefined | null>
    body?: unknown
    auth?: boolean
  }) => Promise<
    | { ok: true; status: number; data: unknown; state?: string }
    | { ok: false; code: string; message: string; status: number; state?: string }
  >
  /** Phase 8A — Patients Cloud read-only list (token stays in Main). */
  cloudPatientsList?: (query?: {
    search?: string
    page?: number
    limit?: number
  }) => Promise<
    | { ok: true; status: number; data: unknown; state?: string }
    | { ok: false; code: string; message: string; status: number; state?: string }
  >
  /** Phase 8B — Patients Cloud create (token stays in Main; no orgId). */
  cloudPatientsCreate?: (input: {
    firstName: string
    lastName: string
    phone: string
    age: number
    birthDate?: string | null
    address?: string
    antecedents?: string
    hasAllergies?: boolean
    dentistId?: string | null
    notes?: string | null
  }) => Promise<
    | { ok: true; status: number; data: unknown; state?: string }
    | { ok: false; code: string; message: string; status: number; state?: string }
  >
  /** Phase 8C — Patients Cloud update (token stays in Main; no orgId). */
  cloudPatientsUpdate?: (input: {
    id: string
    firstName?: string
    lastName?: string
    phone?: string
    age?: number
    birthDate?: string | null
    address?: string
    antecedents?: string
    hasAllergies?: boolean
    dentistId?: string | null
    notes?: string | null
  }) => Promise<
    | { ok: true; status: number; data: unknown; state?: string }
    | { ok: false; code: string; message: string; status: number; state?: string }
  >
  /** Auto-update (electron-updater). */
  updateGetStatus?: () => Promise<{
    status: string
    currentVersion: string
    availableVersion: string | null
    downloadPercent?: number
    error?: string | null
    packaged?: boolean
  }>
  updateCheck?: (options?: { silent?: boolean }) => Promise<{
    status: string
    currentVersion: string
    availableVersion: string | null
    downloadPercent?: number
    error?: string | null
    packaged?: boolean
  }>
  updateDownload?: () => Promise<{
    status: string
    currentVersion: string
    availableVersion: string | null
    downloadPercent?: number
    error?: string | null
  }>
  updateInstall?: () => Promise<{ ok: boolean; error?: string }>
  onUpdateStatus?: (
    handler: (payload: {
      status: string
      currentVersion: string
      availableVersion: string | null
      downloadPercent?: number
      error?: string | null
    }) => void,
  ) => () => void
}

export type PatientDraft = Omit<Patient, 'id' | 'teeth'>
export type DentistDraft = Omit<Dentist, 'id'>
export type AppointmentDraft = Omit<Appointment, 'id'>

declare global {
  interface Window {
    dentisuite?: DentiSuiteAPI
  }
}
