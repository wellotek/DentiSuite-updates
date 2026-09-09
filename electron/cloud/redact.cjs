/**
 * Phase 7B — never log or IPC-return secrets (token, password, Authorization).
 */
'use strict'

const SECRET_KEY = /^(token|accessToken|refreshToken|idToken|password|authorization|bearer|secret|serverToken|apiKey|cookie)$/i

function redactString(value) {
  if (typeof value !== 'string') return value
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/(authorization\s*[:=]\s*)(\S+)/gi, '$1[REDACTED]')
}

function stripSecrets(value, depth = 0) {
  if (value == null || depth > 10) return value
  if (typeof value === 'string') return redactString(value)
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => stripSecrets(item, depth + 1))
  const out = {}
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) continue
    out[key] = stripSecrets(nested, depth + 1)
  }
  return out
}

function containsSecretLeak(value) {
  if (value == null) return false
  if (typeof value === 'string') {
    return /Bearer\s+\S{8,}/i.test(value) || /"token"\s*:/i.test(value)
  }
  if (typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(containsSecretLeak)
  return Object.entries(value).some(([key, nested]) => SECRET_KEY.test(key) || containsSecretLeak(nested))
}

module.exports = {
  redactString,
  stripSecrets,
  containsSecretLeak,
}
