const crypto = require('crypto')

const STATE_FIELDS = [
  'license_id',
  'installation_id',
  'status',
  'lastValidatedAt',
  'offlineUntil',
  'product',
  'version',
]

function hmacKey(installationId) {
  return crypto.createHash('sha256').update(`dentisuite-v8-local-integrity|${installationId}`).digest()
}

function canonical(state) {
  const obj = {}
  for (const key of STATE_FIELDS) obj[key] = state[key] ?? null
  return JSON.stringify(obj)
}

function signState(state) {
  const payload = {}
  for (const key of STATE_FIELDS) payload[key] = state[key] ?? null
  payload.v = 1
  payload.integrity = crypto.createHmac('sha256', hmacKey(payload.installation_id)).update(canonical(payload)).digest('hex')
  if (state.serverToken) payload.serverToken = state.serverToken
  return payload
}

function verifyState(record) {
  if (!record || record.v !== 1 || !record.integrity || !record.installation_id) return null
  let expected
  let actual
  try {
    expected = Buffer.from(
      crypto.createHmac('sha256', hmacKey(record.installation_id)).update(canonical(record)).digest('hex'),
      'hex',
    )
    actual = Buffer.from(String(record.integrity), 'hex')
  } catch {
    return null
  }
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null
  if (record.status !== 'active' && record.status !== 'revoked') return null
  if (!record.license_id || !record.installation_id) return null
  if (record.status === 'active' && (!record.offlineUntil || !record.lastValidatedAt)) return null
  return record
}

function offlineUntilFrom(now = Date.now(), days) {
  return new Date(now + days * 24 * 60 * 60 * 1000).toISOString()
}

function graceValid(offlineUntil, now = Date.now()) {
  const t = Date.parse(offlineUntil)
  return Number.isFinite(t) && now < t
}

function approachingDeadline(offlineUntil, hours, now = Date.now()) {
  const t = Date.parse(offlineUntil)
  if (!Number.isFinite(t)) return false
  const remaining = t - now
  return remaining > 0 && remaining <= hours * 60 * 60 * 1000
}

module.exports = {
  STATE_FIELDS,
  signState,
  verifyState,
  offlineUntilFrom,
  graceValid,
  approachingDeadline,
}
