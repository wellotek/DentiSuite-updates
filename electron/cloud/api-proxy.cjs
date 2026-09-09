/**
 * Phase 7B — Cloud API client in Main (Bearer stays in Main).
 */
'use strict'

const { net } = require('electron')
const { getApiBaseUrl } = require('./config.cjs')
const sessionStore = require('./session.cjs')
const { stripSecrets, redactString } = require('./redact.cjs')
const { getInstallationId } = require('../license/installationId.cjs')

const DEFAULT_TIMEOUT_MS = 20_000

class CloudApiError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} [status]
   * @param {unknown} [body]
   */
  constructor(code, message, status, body) {
    super(redactString(message))
    this.name = 'CloudApiError'
    this.code = code
    this.status = status ?? 0
    this.body = stripSecrets(body ?? null)
  }
}

function buildUrl(path, query) {
  const base = getApiBaseUrl()
  const normalized = path.startsWith('/') ? path : `/${path}`
  const url = new URL(normalized, `${base}/`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

function getInstallationIdSafe() {
  try {
    return getInstallationId()
  } catch {
    return 'electron-unknown'
  }
}

/**
 * @param {{
 *   method?: string
 *   path: string
 *   query?: Record<string, string | number | undefined | null>
 *   body?: unknown
 *   auth?: boolean
 *   timeoutMs?: number
 *   captureToken?: boolean
 * }} opts
 */
async function cloudFetch(opts) {
  const method = (opts.method || 'GET').toUpperCase()
  const url = buildUrl(opts.path, opts.query)
  const headers = {
    Accept: 'application/json',
  }
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const useAuth = opts.auth !== false
  if (useAuth) {
    const token = sessionStore.getToken()
    if (!token) {
      throw new CloudApiError('UNAUTHORIZED', 'Cloud session required', 401)
    }
    headers.Authorization = `Bearer ${token}`
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await net.fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
  } catch (error) {
    const aborted = error && error.name === 'AbortError'
    throw new CloudApiError(
      aborted ? 'TIMEOUT' : 'NETWORK',
      aborted ? 'Cloud API timeout' : 'Cloud API unreachable',
      0,
    )
  } finally {
    clearTimeout(timer)
  }

  const text = await response.text()
  let json = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }
  }

  if (response.status === 401) {
    if (useAuth) {
      sessionStore.clearSession()
      throw new CloudApiError(
        'SESSION_EXPIRED',
        (json && json.error && json.error.message) || 'Session expired or invalid',
        401,
        json,
      )
    }
    throw new CloudApiError(
      'INVALID_CREDENTIALS',
      (json && json.error && json.error.message) || 'Invalid credentials',
      401,
      json,
    )
  }
  if (response.status === 403) {
    throw new CloudApiError(
      'FORBIDDEN',
      (json && json.error && json.error.message) || 'Permission denied',
      403,
      json,
    )
  }
  if (response.status === 404) {
    throw new CloudApiError(
      'NOT_FOUND',
      (json && json.error && json.error.message) || 'Not found',
      404,
      json,
    )
  }
  if (response.status >= 500) {
    throw new CloudApiError(
      'SERVER',
      (json && json.error && json.error.message) || 'Cloud server error',
      response.status,
      json,
    )
  }
  if (!response.ok) {
    const apiCode =
      json && json.error && typeof json.error.code === 'string' && json.error.code
        ? json.error.code
        : response.status === 409
          ? 'CONFLICT'
          : response.status === 400 || response.status === 422
            ? 'VALIDATION'
            : 'HTTP'
    throw new CloudApiError(
      apiCode,
      (json && json.error && json.error.message) || `HTTP ${response.status}`,
      response.status,
      json,
    )
  }

  const capturedToken =
    opts.captureToken && json && typeof json.token === 'string' ? json.token : null
  const capturedExpires = opts.captureToken ? json?.expiresAt ?? null : null
  const capturedUser = opts.captureToken ? json?.user ?? null : null

  return {
    status: response.status,
    data: stripSecrets(json),
    capturedToken,
    capturedExpires,
    capturedUser,
  }
}

function cloudApi() {
  return {
    request: cloudFetch,
    get: (path, query) => cloudFetch({ method: 'GET', path, query }),
    post: (path, body) => cloudFetch({ method: 'POST', path, body }),
    patch: (path, body) => cloudFetch({ method: 'PATCH', path, body }),
    delete: (path) => cloudFetch({ method: 'DELETE', path }),
  }
}

function toIpcError(error) {
  return stripSecrets({
    ok: false,
    code: (error && error.code) || 'UNKNOWN',
    message: redactString(error instanceof Error ? error.message : String(error)),
    status: (error && error.status) || 0,
  })
}

module.exports = {
  CloudApiError,
  cloudFetch,
  cloudApi,
  toIpcError,
  buildUrl,
  getInstallationIdSafe,
}
