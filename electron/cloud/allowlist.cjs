/**
 * Phase FINAL — allowlisted Cloud API paths for Electron Main proxy.
 * Token stays in Main. orgId never trusted from renderer (API ignores it).
 */
'use strict'

const { CloudApiError } = require('./api-proxy.cjs')

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

/** @type {Array<{ methods: Set<string>, pattern: RegExp }>} */
const RULES = [
  // Patients — create/update via dedicated IPC only; DELETE = soft-archive
  { methods: new Set(['GET']), pattern: /^\/patients\/?$/ },
  { methods: new Set(['GET', 'DELETE']), pattern: new RegExp(`^/patients/${UUID}/?$`) },
  { methods: new Set(['POST']), pattern: new RegExp(`^/patients/${UUID}/restore/?$`) },
  { methods: new Set(['POST']), pattern: new RegExp(`^/patients/${UUID}/purge/?$`) },
  // Appointments
  { methods: new Set(['GET', 'POST']), pattern: /^\/appointments\/?$/ },
  { methods: new Set(['GET', 'PATCH', 'DELETE']), pattern: new RegExp(`^/appointments/${UUID}/?$`) },
  // Dentists
  { methods: new Set(['GET', 'POST']), pattern: /^\/dentists\/?$/ },
  { methods: new Set(['GET', 'PATCH', 'DELETE']), pattern: new RegExp(`^/dentists/${UUID}/?$`) },
  // Stock
  { methods: new Set(['GET', 'POST']), pattern: /^\/stock\/?$/ },
  { methods: new Set(['GET', 'PATCH', 'DELETE']), pattern: new RegExp(`^/stock/${UUID}/?$`) },
  // Clinical (nested + org bulk lists for Cloud hydrate)
  { methods: new Set(['GET']), pattern: /^\/consultations\/?$/ },
  { methods: new Set(['GET', 'POST']), pattern: new RegExp(`^/patients/${UUID}/consultations/?$`) },
  { methods: new Set(['GET', 'PATCH', 'DELETE']), pattern: new RegExp(`^/consultations/${UUID}/?$`) },
  { methods: new Set(['GET']), pattern: /^\/treatments\/?$/ },
  { methods: new Set(['GET', 'POST']), pattern: new RegExp(`^/patients/${UUID}/treatments/?$`) },
  { methods: new Set(['GET', 'PATCH', 'DELETE']), pattern: new RegExp(`^/treatments/${UUID}/?$`) },
  // Prescriptions
  { methods: new Set(['GET']), pattern: /^\/prescriptions\/?$/ },
  { methods: new Set(['GET', 'POST']), pattern: new RegExp(`^/patients/${UUID}/prescriptions/?$`) },
  { methods: new Set(['GET', 'PATCH', 'DELETE']), pattern: new RegExp(`^/prescriptions/${UUID}/?$`) },
  // Billing
  { methods: new Set(['GET']), pattern: /^\/invoices\/?$/ },
  { methods: new Set(['GET', 'POST']), pattern: new RegExp(`^/patients/${UUID}/invoices/?$`) },
  { methods: new Set(['GET', 'PATCH', 'DELETE']), pattern: new RegExp(`^/invoices/${UUID}/?$`) },
  // Prostheses
  { methods: new Set(['GET']), pattern: /^\/prostheses\/?$/ },
  { methods: new Set(['GET', 'POST']), pattern: new RegExp(`^/patients/${UUID}/prostheses/?$`) },
  { methods: new Set(['GET', 'PATCH', 'DELETE']), pattern: new RegExp(`^/prostheses/${UUID}/?$`) },
  // Media / documents
  { methods: new Set(['GET']), pattern: /^\/media\/?$/ },
  { methods: new Set(['GET', 'POST']), pattern: new RegExp(`^/patients/${UUID}/media/?$`) },
  { methods: new Set(['GET', 'DELETE']), pattern: new RegExp(`^/media/${UUID}/?$`) },
  { methods: new Set(['GET']), pattern: new RegExp(`^/media/${UUID}/url/?$`) },
  { methods: new Set(['POST']), pattern: new RegExp(`^/media/${UUID}/complete/?$`) },
  // Auth context helpers (already used by session)
  { methods: new Set(['GET']), pattern: /^\/auth\/me\/?$/ },
  { methods: new Set(['GET']), pattern: /^\/auth\/permissions\/?$/ },
  { methods: new Set(['POST']), pattern: /^\/auth\/logout\/?$/ },
  { methods: new Set(['POST']), pattern: /^\/auth\/bootstrap-organization\/?$/ },
  { methods: new Set(['GET']), pattern: /^\/auth\/onboarding-status\/?$/ },
  { methods: new Set(['GET']), pattern: /^\/organization\/?$/ },
  // Team (admin collaborators)
  { methods: new Set(['GET', 'POST']), pattern: /^\/team\/?$/ },
  { methods: new Set(['GET', 'PATCH', 'DELETE']), pattern: new RegExp(`^/team/${UUID}/?$`) },
]

/**
 * @param {string} method
 * @param {string} path
 */
function assertCloudPathAllowed(method, path) {
  const m = String(method || 'GET').toUpperCase()
  const p = String(path || '').split('?')[0]
  if (!p.startsWith('/')) {
    throw new CloudApiError('VALIDATION', 'path must start with /', 400)
  }
  const ok = RULES.some((rule) => rule.methods.has(m) && rule.pattern.test(p))
  if (!ok) {
    throw new CloudApiError(
      'FORBIDDEN',
      `Cloud API path not allowlisted: ${m} ${p}`,
      403,
    )
  }
}

/**
 * Strip tenant / secret keys from renderer-supplied body (defense in depth).
 * @param {unknown} body
 */
function scrubCloudBody(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) return body
  const out = { ...body }
  delete out.organizationId
  delete out.orgId
  delete out.userId
  delete out.membershipId
  delete out.token
  delete out.accessToken
  delete out.refreshToken
  delete out.Authorization
  delete out.authorization
  return out
}

module.exports = {
  assertCloudPathAllowed,
  scrubCloudBody,
  RULES,
}
