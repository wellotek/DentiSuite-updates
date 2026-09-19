/**
 * Phase 8C — Cloud Patients list + create + update (Main).
 * Tenant comes from session/membership — never from renderer orgId.
 * Dedicated list/create/update IPC preferred. Generic allowlisted DELETE via cloud:request.
 */
'use strict'

const { cloudFetch, CloudApiError } = require('./api-proxy.cjs')
const { stripSecrets } = require('./redact.cjs')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PATIENT_ID_PATH = /^\/patients\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i

/**
 * Generic cloud:request path: force dedicated IPC for patient create/update.
 * Soft-archive DELETE /patients/:id remains allowlisted (Phase 1).
 * Nested clinical routes (/patients/:id/consultations, …) are not blocked here.
 * @param {string} method
 * @param {string} path
 */
function assertPatientsReadOnly(method, path) {
  const m = String(method || 'GET').toUpperCase()
  const p = String(path || '').split('?')[0]
  if (m === 'POST' && /^\/patients\/?$/.test(p)) {
    throw new CloudApiError(
      'FORBIDDEN',
      'POST /patients only allowed via cloud:patients:create (Phase 8C)',
      403,
    )
  }
  if (m === 'PATCH' && PATIENT_ID_PATH.test(p)) {
    throw new CloudApiError(
      'FORBIDDEN',
      'PATCH /patients only allowed via cloud:patients:update (Phase 8C)',
      403,
    )
  }
  if (m === 'PUT' && (/^\/patients\/?$/.test(p) || PATIENT_ID_PATH.test(p))) {
    throw new CloudApiError('FORBIDDEN', 'Cloud Patients PUT blocked', 403)
  }
}

/**
 * @param {{ search?: string, page?: number, limit?: number }} query
 */
function normalizeListQuery(query) {
  const search = String(query?.search ?? '').trim().slice(0, 200)
  let page = Number(query?.page ?? 1)
  let limit = Number(query?.limit ?? 50)
  if (!Number.isFinite(page) || page < 1) page = 1
  if (!Number.isFinite(limit) || limit < 1) limit = 50
  if (limit > 100) limit = 100
  return { search, page, limit }
}

/**
 * @param {unknown} id
 */
function normalizePatientId(id) {
  const s = String(id ?? '').trim()
  if (!UUID_RE.test(s)) {
    throw new CloudApiError('VALIDATION', 'patient id (UUID) required', 400)
  }
  return s
}

/**
 * Map API PublicPatient → UI CloudPatient (only real API fields).
 * @param {unknown} raw
 */
function mapCloudPatient(raw) {
  if (!raw || typeof raw !== 'object') return null
  const p = /** @type {Record<string, unknown>} */ (raw)
  if (typeof p.id !== 'string' || typeof p.firstName !== 'string' || typeof p.lastName !== 'string') {
    return null
  }
  return stripSecrets({
    id: p.id,
    organizationId: typeof p.organizationId === 'string' ? p.organizationId : '',
    firstName: p.firstName,
    lastName: p.lastName,
    phone: typeof p.phone === 'string' ? p.phone : '',
    age: typeof p.age === 'number' ? p.age : 0,
    address: typeof p.address === 'string' ? p.address : '',
    antecedents: typeof p.antecedents === 'string' ? p.antecedents : '',
    hasAllergies: Boolean(p.hasAllergies),
    dentistId: typeof p.dentistId === 'string' ? p.dentistId : null,
    notes: typeof p.notes === 'string' ? p.notes : null,
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : null,
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : null,
  })
}

function discardTenantHints(raw) {
  void raw.organizationId
  void raw.orgId
  void raw.userId
  void raw.membershipId
  void raw.token
}

/**
 * Normalize + validate create payload for IPC (mirrors API required fields).
 * @param {unknown} payload
 */
function normalizeCreateInput(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new CloudApiError('VALIDATION', 'Patient payload required', 400)
  }
  const raw = /** @type {Record<string, unknown>} */ (payload)
  discardTenantHints(raw)
  void raw.id

  const firstName = String(raw.firstName ?? '').trim()
  const lastName = String(raw.lastName ?? '').trim()
  const phone = String(raw.phone ?? '').trim()
  const ageNum = Number(raw.age)

  if (!firstName || firstName.length > 100) {
    throw new CloudApiError('VALIDATION', 'firstName required (1–100)', 400)
  }
  if (!lastName || lastName.length > 100) {
    throw new CloudApiError('VALIDATION', 'lastName required (1–100)', 400)
  }
  if (!phone || phone.length > 40) {
    throw new CloudApiError('VALIDATION', 'phone required (1–40)', 400)
  }
  if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 150) {
    throw new CloudApiError('VALIDATION', 'age must be an integer 0–150', 400)
  }

  const address = String(raw.address ?? '').trim().slice(0, 500)
  const antecedents = String(raw.antecedents ?? '').trim().slice(0, 5000)
  const hasAllergies = Boolean(raw.hasAllergies)
  let dentistId = null
  if (raw.dentistId != null && String(raw.dentistId).trim() !== '') {
    dentistId = String(raw.dentistId).trim().slice(0, 100)
  }
  let notes = null
  if (raw.notes != null && String(raw.notes).trim() !== '') {
    notes = String(raw.notes).trim().slice(0, 5000)
  }

  const body = {
    firstName,
    lastName,
    phone,
    age: ageNum,
    address,
    antecedents,
    hasAllergies,
    dentistId,
    notes,
  }
  if (raw.teeth && typeof raw.teeth === 'object' && !Array.isArray(raw.teeth)) {
    body.teeth = raw.teeth
  }
  return body
}

/**
 * Partial update body — at least one field required (API refine).
 * Strips orgId / id from body (id comes from path only).
 * @param {unknown} payload
 */
function normalizeUpdateInput(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new CloudApiError('VALIDATION', 'Patient update payload required', 400)
  }
  const raw = /** @type {Record<string, unknown>} */ (payload)
  discardTenantHints(raw)
  // id may be present for convenience but must not go in PATCH body as override
  void raw.id

  /** @type {Record<string, unknown>} */
  const body = {}

  if (raw.firstName !== undefined) {
    const firstName = String(raw.firstName).trim()
    if (!firstName || firstName.length > 100) {
      throw new CloudApiError('VALIDATION', 'firstName invalid (1–100)', 400)
    }
    body.firstName = firstName
  }
  if (raw.lastName !== undefined) {
    const lastName = String(raw.lastName).trim()
    if (!lastName || lastName.length > 100) {
      throw new CloudApiError('VALIDATION', 'lastName invalid (1–100)', 400)
    }
    body.lastName = lastName
  }
  if (raw.phone !== undefined) {
    const phone = String(raw.phone).trim()
    if (!phone || phone.length > 40) {
      throw new CloudApiError('VALIDATION', 'phone invalid (1–40)', 400)
    }
    body.phone = phone
  }
  if (raw.age !== undefined) {
    const ageNum = Number(raw.age)
    if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 150) {
      throw new CloudApiError('VALIDATION', 'age must be an integer 0–150', 400)
    }
    body.age = ageNum
  }
  if (raw.address !== undefined) {
    body.address = String(raw.address ?? '').trim().slice(0, 500)
  }
  if (raw.antecedents !== undefined) {
    body.antecedents = String(raw.antecedents ?? '').trim().slice(0, 5000)
  }
  if (raw.hasAllergies !== undefined) {
    body.hasAllergies = Boolean(raw.hasAllergies)
  }
  if (raw.dentistId !== undefined) {
    if (raw.dentistId == null || String(raw.dentistId).trim() === '') {
      body.dentistId = null
    } else {
      body.dentistId = String(raw.dentistId).trim().slice(0, 100)
    }
  }
  if (raw.notes !== undefined) {
    if (raw.notes == null || String(raw.notes).trim() === '') {
      body.notes = null
    } else {
      body.notes = String(raw.notes).trim().slice(0, 5000)
    }
  }
  if (raw.teeth !== undefined) {
    if (raw.teeth && typeof raw.teeth === 'object' && !Array.isArray(raw.teeth)) {
      body.teeth = raw.teeth
    } else {
      throw new CloudApiError('VALIDATION', 'teeth must be an object', 400)
    }
  }

  if (Object.keys(body).length === 0) {
    throw new CloudApiError('VALIDATION', 'At least one updatable field is required', 400)
  }
  return body
}

/**
 * @param {{ search?: string, page?: number, limit?: number }} [query]
 * @param {{ organizationIdHint?: unknown }} [opts]
 */
async function listPatients(query = {}, opts = {}) {
  void opts.organizationIdHint

  const normalized = normalizeListQuery(query)
  assertPatientsReadOnly('GET', '/patients')

  const result = await cloudFetch({
    method: 'GET',
    path: '/patients',
    query: normalized,
    auth: true,
  })

  const data = result.data || {}
  const rawItems = Array.isArray(data.items) ? data.items : []
  const items = rawItems.map(mapCloudPatient).filter(Boolean)

  return stripSecrets({
    items,
    page: typeof data.page === 'number' ? data.page : normalized.page,
    limit: typeof data.limit === 'number' ? data.limit : normalized.limit,
    total: typeof data.total === 'number' ? data.total : items.length,
    totalPages: typeof data.totalPages === 'number' ? data.totalPages : 1,
  })
}

/**
 * Phase 8B — create patient via POST /patients (dedicated path only).
 * @param {unknown} payload
 * @param {{ organizationIdHint?: unknown }} [opts]
 */
async function createPatient(payload, opts = {}) {
  void opts.organizationIdHint
  const body = normalizeCreateInput(payload)

  const result = await cloudFetch({
    method: 'POST',
    path: '/patients',
    body,
    auth: true,
  })

  const data = result.data || {}
  const patient = mapCloudPatient(data.patient)
  if (!patient) {
    throw new CloudApiError('SERVER', 'Invalid create patient response', result.status || 500)
  }
  return stripSecrets({ patient, status: result.status || 201 })
}

/**
 * Phase 8C — update patient via PATCH /patients/:id (dedicated path only).
 * @param {string} patientId
 * @param {unknown} payload
 * @param {{ organizationIdHint?: unknown }} [opts]
 */
async function updatePatient(patientId, payload, opts = {}) {
  void opts.organizationIdHint
  const id = normalizePatientId(patientId)
  const body = normalizeUpdateInput(payload)

  const result = await cloudFetch({
    method: 'PATCH',
    path: `/patients/${id}`,
    body,
    auth: true,
  })

  const data = result.data || {}
  const patient = mapCloudPatient(data.patient)
  if (!patient) {
    throw new CloudApiError('SERVER', 'Invalid update patient response', result.status || 500)
  }
  return stripSecrets({ patient, status: result.status || 200 })
}

module.exports = {
  listPatients,
  createPatient,
  updatePatient,
  mapCloudPatient,
  normalizeListQuery,
  normalizeCreateInput,
  normalizeUpdateInput,
  normalizePatientId,
  assertPatientsReadOnly,
}
