const { app, safeStorage, net } = require('electron')
const fs = require('fs')
const path = require('path')
const { getInstallationId } = require('./installationId.cjs')
const {
  ACTIVATE_URL,
  VALIDATE_URL,
  REFRESH_URL,
  PRODUCT,
  VERSION,
  OFFLINE_GRACE_PERIOD_DAYS,
  FETCH_MS,
  REFRESH_WITHIN_HOURS,
} = require('./config.cjs')
const { signState, verifyState, offlineUntilFrom, graceValid, approachingDeadline } = require('./integrity.cjs')
const { MSG, mapHttpError, isNetworkError } = require('./errors.cjs')

let refreshAttempted = false

function licensePath() {
  return path.join(app.getPath('userData'), 'license.enc')
}

function nowIso(now = Date.now()) {
  return new Date(now).toISOString()
}

function publicStatus(screen, extra = {}) {
  return {
    activated: screen === 'ok',
    screen,
    message: extra.message || null,
    product: PRODUCT,
    version: VERSION,
    licenseId: extra.licenseId || null,
  }
}

function readRecord() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    const file = licensePath()
    if (!fs.existsSync(file)) return null
    const raw = safeStorage.decryptString(fs.readFileSync(file))
    return verifyState(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeRecord(state) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage unavailable')
  }
  const signed = signState(state)
  fs.mkdirSync(path.dirname(licensePath()), { recursive: true })
  fs.writeFileSync(licensePath(), safeStorage.encryptString(JSON.stringify(signed)))
  return signed
}

function stampRevoked(record) {
  return writeRecord({
    license_id: record.license_id,
    installation_id: record.installation_id,
    status: 'revoked',
    lastValidatedAt: record.lastValidatedAt || nowIso(),
    offlineUntil: record.offlineUntil || nowIso(),
    product: PRODUCT,
    version: VERSION,
    serverToken: record.serverToken,
  })
}

function stampActive(record, extras = {}) {
  const now = Date.now()
  return writeRecord({
    license_id: record.license_id,
    installation_id: record.installation_id,
    status: 'active',
    lastValidatedAt: nowIso(now),
    offlineUntil: offlineUntilFrom(now, OFFLINE_GRACE_PERIOD_DAYS),
    product: PRODUCT,
    version: VERSION,
    serverToken: extras.serverToken || record.serverToken || undefined,
  })
}

function pickServerToken(body) {
  if (!body || typeof body !== 'object') return undefined
  const token =
    body.access_token ||
    body.accessToken ||
    body.token ||
    body.license_token ||
    (body.data && (body.data.access_token || body.data.token))
  return typeof token === 'string' && token.trim() ? token.trim() : undefined
}

function authorizedValue(body) {
  if (!body || typeof body !== 'object') return undefined
  if (typeof body.authorized === 'boolean') return body.authorized
  if (body.data && typeof body.data.authorized === 'boolean') return body.data.authorized
  return undefined
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const request = net.request({ method: 'POST', url })
    request.setHeader('Content-Type', 'application/json')
    request.setHeader('Accept', 'application/json')
    const timer = setTimeout(() => {
      try {
        request.abort()
      } catch {
        /* ignore */
      }
      const error = new Error('timeout')
      error.code = 'ETIMEDOUT'
      reject(error)
    }, FETCH_MS)

    let chunks = ''
    request.on('response', (response) => {
      response.on('data', (data) => {
        chunks += data.toString('utf8')
      })
      response.on('end', () => {
        clearTimeout(timer)
        let json = {}
        try {
          json = chunks ? JSON.parse(chunks) : {}
        } catch {
          json = {}
        }
        resolve({ status: response.statusCode || 0, body: json })
      })
    })
    request.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    request.write(JSON.stringify(payload))
    request.end()
  })
}

async function callApi(url, payload) {
  try {
    return await postJson(url, payload)
  } catch (error) {
    if (isNetworkError(error)) return { status: 0, body: {}, network: true }
    return { status: 0, body: {}, network: true }
  }
}

async function refreshIfNeeded(record, force) {
  if (refreshAttempted) return record
  if (
    !force &&
    !approachingDeadline(record.offlineUntil, REFRESH_WITHIN_HOURS)
  ) {
    return record
  }
  refreshAttempted = true
  const installation_id = getInstallationId()
  const result = await callApi(REFRESH_URL, {
    license_id: record.license_id,
    installation_id,
  })
  if (result.network) return record
  const authorized = authorizedValue(result.body)
  if (result.status >= 200 && result.status < 300 && authorized !== false) {
    return stampActive(record, { serverToken: pickServerToken(result.body) })
  }
  if (authorized === false || result.status === 401 || result.status === 403) {
    stampRevoked(record)
  }
  return record
}

async function validateOnline(record) {
  const installation_id = getInstallationId()
  const result = await callApi(VALIDATE_URL, {
    license_id: record.license_id,
    installation_id,
  })
  if (result.network) return { kind: 'network' }
  const authorized = authorizedValue(result.body)
  if (result.status >= 200 && result.status < 300 && authorized === true) {
    const stamped = stampActive(record, { serverToken: pickServerToken(result.body) })
    const refreshed = await refreshIfNeeded(stamped, true)
    return { kind: 'authorized', record: refreshed }
  }
  if (authorized === false || result.status === 401 || result.status === 403) {
    stampRevoked(record)
    return { kind: 'unauthorized' }
  }
  if (result.status === 429 || result.status >= 500 || result.status === 408) {
    return { kind: 'network' }
  }
  return { kind: 'unauthorized' }
}

async function getLicenseStatus() {
  let installation_id
  try {
    installation_id = getInstallationId()
  } catch {
    return publicStatus('activate')
  }

  const record = readRecord()
  if (!record || record.installation_id !== installation_id) {
    return publicStatus('activate')
  }
  if (record.status === 'revoked') {
    return publicStatus('blocked', { message: MSG.revoked, licenseId: record.license_id })
  }

  if (graceValid(record.offlineUntil)) {
    if (approachingDeadline(record.offlineUntil, REFRESH_WITHIN_HOURS)) {
      void refreshIfNeeded(record, false)
    }
    return publicStatus('ok', { licenseId: record.license_id })
  }

  const result = await validateOnline(record)
  if (result.kind === 'authorized') {
    return publicStatus('ok', { licenseId: result.record.license_id })
  }
  if (result.kind === 'network') {
    return publicStatus('offline', { message: MSG.online, licenseId: record.license_id })
  }
  return publicStatus('blocked', { message: MSG.revoked, licenseId: record.license_id })
}

async function retryLicense() {
  refreshAttempted = false
  const record = readRecord()
  if (!record) return publicStatus('activate')
  const result = await validateOnline(record)
  if (result.kind === 'authorized') {
    return publicStatus('ok', { licenseId: result.record.license_id })
  }
  if (result.kind === 'network') {
    if (record.status === 'active' && graceValid(record.offlineUntil)) {
      return publicStatus('ok', { licenseId: record.license_id })
    }
    if (record.status === 'revoked') {
      return publicStatus('blocked', { message: MSG.revoked, licenseId: record.license_id })
    }
    return publicStatus('offline', { message: MSG.online, licenseId: record.license_id })
  }
  return publicStatus('blocked', { message: MSG.revoked, licenseId: record.license_id })
}

async function activateLicense(licenseId, activationCode) {
  const license_id = String(licenseId || '').trim().toUpperCase()
  const activation_code = String(activationCode || '').trim().toUpperCase()
  if (!license_id || !activation_code) {
    return { ok: false, error: MSG.invalid }
  }

  let installation_id
  try {
    installation_id = getInstallationId()
  } catch {
    return { ok: false, error: MSG.network }
  }

  const result = await callApi(ACTIVATE_URL, {
    license_id,
    activation_code,
    installation_id,
    product: PRODUCT,
    version: VERSION,
  })

  if (result.network) {
    return { ok: false, error: MSG.network }
  }

  const authorized = authorizedValue(result.body)
  if (authorized === false) {
    return { ok: false, error: mapHttpError(result.status, result.body, MSG.revoked) }
  }
  if (result.status < 200 || result.status >= 300) {
    return { ok: false, error: mapHttpError(result.status, result.body, MSG.invalid) }
  }

  try {
    const stored = stampActive(
      {
        license_id,
        installation_id,
        serverToken: pickServerToken(result.body),
      },
      { serverToken: pickServerToken(result.body) },
    )
    refreshAttempted = false
    void refreshIfNeeded(stored, true)
    return { ok: true, status: publicStatus('ok', { licenseId: stored.license_id }) }
  } catch {
    return { ok: false, error: MSG.network }
  }
}

module.exports = {
  getLicenseStatus,
  activateLicense,
  retryLicense,
}
