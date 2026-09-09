import { CloudClientError, mapCloudFailure } from './errors'
import type {
  CloudPatient,
  CloudPatientCreateInput,
  CloudPatientList,
  CloudPatientUpdateInput,
} from './types'

export type ListCloudPatientsQuery = {
  search?: string
  page?: number
  limit?: number
}

export type CloudPatientsLoadState =
  | 'IDLE'
  | 'LOADING'
  | 'SUCCESS'
  | 'EMPTY'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'API_ERROR'

export type CloudPatientCreateState =
  | 'IDLE'
  | 'SUBMITTING'
  | 'SUCCESS'
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN'
  | 'SESSION_EXPIRED'
  | 'API_ERROR'

export type CloudPatientUpdateState =
  | 'IDLE'
  | 'LOADING'
  | 'SUBMITTING'
  | 'SUCCESS'
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'API_ERROR'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function bridge() {
  return typeof window !== 'undefined' ? window.dentisuite : undefined
}

function normalizeList(data: Partial<CloudPatientList> | null | undefined): CloudPatientList {
  const items = Array.isArray(data?.items) ? (data!.items as CloudPatient[]) : []
  return {
    items,
    page: typeof data?.page === 'number' ? data.page : 1,
    limit: typeof data?.limit === 'number' ? data.limit : 50,
    total: typeof data?.total === 'number' ? data.total : items.length,
    totalPages: typeof data?.totalPages === 'number' ? data.totalPages : 0,
  }
}

/**
 * Assert response never carries secrets (defense in depth for UI/tests).
 */
export function assertNoSecretsInPatientsPayload(payload: unknown): void {
  const raw = JSON.stringify(payload ?? {})
  if (/"token"\s*:/i.test(raw) || /Bearer\s+\S+/i.test(raw) || /Authorization/i.test(raw)) {
    throw new CloudClientError('unknown', 'SECRET_LEAK', 'Cloud patients response contained secrets', 0)
  }
}

/**
 * Map CloudClientError → explicit UI load state (Phase 8A).
 */
export function patientsLoadStateFromError(err: unknown): CloudPatientsLoadState {
  if (!(err instanceof CloudClientError)) return 'API_ERROR'
  if (err.kind === 'expired' || err.kind === 'unauthorized') return 'SESSION_EXPIRED'
  if (err.kind === 'credentials' || err.kind === 'disabled') return 'UNAUTHENTICATED'
  if (err.kind === 'forbidden') return 'FORBIDDEN'
  return 'API_ERROR'
}

export function patientsCreateStateFromError(err: unknown): CloudPatientCreateState {
  if (!(err instanceof CloudClientError)) return 'API_ERROR'
  if (err.kind === 'expired' || err.kind === 'unauthorized') return 'SESSION_EXPIRED'
  if (err.kind === 'forbidden') return 'FORBIDDEN'
  if (err.kind === 'validation') return 'VALIDATION_ERROR'
  return 'API_ERROR'
}

export function patientsUpdateStateFromError(err: unknown): CloudPatientUpdateState {
  if (!(err instanceof CloudClientError)) return 'API_ERROR'
  if (err.kind === 'expired' || err.kind === 'unauthorized') return 'SESSION_EXPIRED'
  if (err.kind === 'forbidden') return 'FORBIDDEN'
  if (err.kind === 'not_found') return 'NOT_FOUND'
  if (err.kind === 'validation') return 'VALIDATION_ERROR'
  return 'API_ERROR'
}

/** Client-side validation aligned with API createPatientSchema (backend remains authority). */
export function validateCloudPatientCreate(
  input: Partial<CloudPatientCreateInput>,
): { ok: true; data: CloudPatientCreateInput } | { ok: false; message: string } {
  const firstName = String(input.firstName ?? '').trim()
  const lastName = String(input.lastName ?? '').trim()
  const phone = String(input.phone ?? '').trim()
  const age = Number(input.age)

  if (!firstName || firstName.length > 100) return { ok: false, message: 'Prénom requis (1–100)' }
  if (!lastName || lastName.length > 100) return { ok: false, message: 'Nom requis (1–100)' }
  if (!phone || phone.length > 40) return { ok: false, message: 'Téléphone requis (1–40)' }
  if (!Number.isInteger(age) || age < 0 || age > 150) {
    return { ok: false, message: 'Âge requis (entier 0–150)' }
  }

  return {
    ok: true,
    data: {
      firstName,
      lastName,
      phone,
      age,
      address: String(input.address ?? '').trim().slice(0, 500),
      antecedents: String(input.antecedents ?? '').trim().slice(0, 5000),
      hasAllergies: Boolean(input.hasAllergies),
      dentistId:
        input.dentistId != null && String(input.dentistId).trim() !== ''
          ? String(input.dentistId).trim().slice(0, 100)
          : null,
      notes:
        input.notes != null && String(input.notes).trim() !== ''
          ? String(input.notes).trim().slice(0, 5000)
          : null,
    },
  }
}

/**
 * Cloud patients list (Phase 8A). Never sends organizationId.
 */
export async function listCloudPatients(
  query: ListCloudPatientsQuery = {},
): Promise<CloudPatientList> {
  const api = bridge()
  const safeQuery = {
    search: query.search ?? '',
    page: query.page ?? 1,
    limit: query.limit ?? 50,
  }

  if (api?.cloudPatientsList) {
    const result = await api.cloudPatientsList(safeQuery)
    if (!result || result.ok !== true) {
      throw mapCloudFailure(result || { code: 'UNKNOWN', message: 'Cloud patients list failed' })
    }
    assertNoSecretsInPatientsPayload(result)
    return normalizeList(result.data as CloudPatientList)
  }

  if (!api?.cloudRequest) {
    throw new CloudClientError('disabled', 'NO_BRIDGE', 'Cloud IPC bridge unavailable', 0)
  }

  const result = (await api.cloudRequest({
    method: 'GET',
    path: '/patients',
    query: safeQuery,
  })) as
    | { ok: true; status: number; data: unknown }
    | { ok: false; code: string; message: string; status: number }

  if (!result || result.ok !== true) {
    throw mapCloudFailure(result || { code: 'UNKNOWN', message: 'Cloud patients list failed' })
  }
  assertNoSecretsInPatientsPayload(result)
  return normalizeList(result.data as CloudPatientList)
}

/**
 * Phase 8B — create Cloud patient via dedicated IPC only.
 * Never sends organizationId.
 */
export async function createCloudPatient(input: CloudPatientCreateInput): Promise<CloudPatient> {
  const validated = validateCloudPatientCreate(input)
  if (!validated.ok) {
    throw new CloudClientError('validation', 'VALIDATION', validated.message, 400)
  }

  // Hard strip any orgId if caller smuggled it on the object.
  const safeBody: CloudPatientCreateInput = {
    firstName: validated.data.firstName,
    lastName: validated.data.lastName,
    phone: validated.data.phone,
    age: validated.data.age,
    address: validated.data.address,
    antecedents: validated.data.antecedents,
    hasAllergies: validated.data.hasAllergies,
    dentistId: validated.data.dentistId,
    notes: validated.data.notes,
  }

  const api = bridge()
  if (!api?.cloudPatientsCreate) {
    throw new CloudClientError(
      'disabled',
      'NO_BRIDGE',
      'Cloud patients create IPC unavailable',
      0,
    )
  }

  const result = await api.cloudPatientsCreate(safeBody)
  if (!result || result.ok !== true) {
    throw mapCloudFailure(result || { code: 'UNKNOWN', message: 'Cloud patient create failed' })
  }
  assertNoSecretsInPatientsPayload(result)
  const data = result.data as { patient?: CloudPatient }
  if (!data?.patient?.id) {
    throw new CloudClientError('server', 'SERVER', 'Create response missing patient', 500)
  }
  return data.patient
}

/** Client-side validation for update (partial). Backend remains authority. */
export function validateCloudPatientUpdate(
  input: Partial<CloudPatientUpdateInput> & { id?: string },
): { ok: true; data: CloudPatientUpdateInput } | { ok: false; message: string } {
  const id = String(input.id ?? '').trim()
  if (!UUID_RE.test(id)) return { ok: false, message: 'Identifiant patient (UUID) requis' }

  const data: CloudPatientUpdateInput = { id }
  let hasField = false

  if (input.firstName !== undefined) {
    const firstName = String(input.firstName).trim()
    if (!firstName || firstName.length > 100) return { ok: false, message: 'Prénom invalide (1–100)' }
    data.firstName = firstName
    hasField = true
  }
  if (input.lastName !== undefined) {
    const lastName = String(input.lastName).trim()
    if (!lastName || lastName.length > 100) return { ok: false, message: 'Nom invalide (1–100)' }
    data.lastName = lastName
    hasField = true
  }
  if (input.phone !== undefined) {
    const phone = String(input.phone).trim()
    if (!phone || phone.length > 40) return { ok: false, message: 'Téléphone invalide (1–40)' }
    data.phone = phone
    hasField = true
  }
  if (input.age !== undefined) {
    const age = Number(input.age)
    if (!Number.isInteger(age) || age < 0 || age > 150) {
      return { ok: false, message: 'Âge invalide (entier 0–150)' }
    }
    data.age = age
    hasField = true
  }
  if (input.address !== undefined) {
    data.address = String(input.address ?? '').trim().slice(0, 500)
    hasField = true
  }
  if (input.antecedents !== undefined) {
    data.antecedents = String(input.antecedents ?? '').trim().slice(0, 5000)
    hasField = true
  }
  if (input.hasAllergies !== undefined) {
    data.hasAllergies = Boolean(input.hasAllergies)
    hasField = true
  }
  if (input.dentistId !== undefined) {
    data.dentistId =
      input.dentistId != null && String(input.dentistId).trim() !== ''
        ? String(input.dentistId).trim().slice(0, 100)
        : null
    hasField = true
  }
  if (input.notes !== undefined) {
    data.notes =
      input.notes != null && String(input.notes).trim() !== ''
        ? String(input.notes).trim().slice(0, 5000)
        : null
    hasField = true
  }

  if (!hasField) return { ok: false, message: 'Au moins un champ à modifier est requis' }
  return { ok: true, data }
}

/**
 * Phase 8C — update Cloud patient via dedicated IPC only.
 * Never sends organizationId. No delete.
 */
export async function updateCloudPatient(input: CloudPatientUpdateInput): Promise<CloudPatient> {
  const validated = validateCloudPatientUpdate(input)
  if (!validated.ok) {
    throw new CloudClientError('validation', 'VALIDATION', validated.message, 400)
  }

  const { id, ...patch } = validated.data
  const safeBody = { id, ...patch }

  const api = bridge()
  if (!api?.cloudPatientsUpdate) {
    throw new CloudClientError(
      'disabled',
      'NO_BRIDGE',
      'Cloud patients update IPC unavailable',
      0,
    )
  }

  const result = await api.cloudPatientsUpdate(safeBody)
  if (!result || result.ok !== true) {
    throw mapCloudFailure(result || { code: 'UNKNOWN', message: 'Cloud patient update failed' })
  }
  assertNoSecretsInPatientsPayload(result)
  const data = result.data as { patient?: CloudPatient }
  if (!data?.patient?.id) {
    throw new CloudClientError('server', 'SERVER', 'Update response missing patient', 500)
  }
  return data.patient
}
