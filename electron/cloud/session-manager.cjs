/**
 * Phase 7B — CloudSessionManager (Main only).
 * login / logout / restore / getState. Token never leaves this process.
 */
'use strict'

const sessionStore = require('./session.cjs')
const { cloudFetch, CloudApiError, getInstallationIdSafe } = require('./api-proxy.cjs')
const { stripSecrets } = require('./redact.cjs')

const AUTH = {
  AUTHENTICATING: 'AUTHENTICATING',
  AUTHENTICATED: 'AUTHENTICATED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  AUTH_ERROR: 'AUTH_ERROR',
}

/** @type {string} */
let authState = AUTH.UNAUTHENTICATED
/** @type {Record<string, unknown> | null} */
let lastPublicContext = null

function publicUser(user) {
  if (!user || typeof user !== 'object') return null
  return stripSecrets({
    id: user.id,
    email: user.email,
    status: user.status,
  })
}

function publicContext(raw) {
  const organization = raw.organization
    ? stripSecrets({
        id: raw.organization.id,
        name: raw.organization.name,
        slug: raw.organization.slug,
        status: raw.organization.status,
      })
    : null
  const membership = raw.membership
    ? stripSecrets({
        id: raw.membership.id,
        userId: raw.membership.userId,
        organizationId: raw.membership.organizationId,
        role: raw.membership.role,
        status: raw.membership.status,
      })
    : null
  const permissions = raw.permissions
    ? {
        organizationId: raw.permissions.organizationId ?? null,
        membershipId: raw.permissions.membershipId ?? null,
        role: raw.permissions.role ?? null,
        permissions: Array.isArray(raw.permissions.permissions)
          ? raw.permissions.permissions
          : [],
      }
    : null
  const role = membership?.role ?? permissions?.role ?? null
  return {
    state: authState,
    status: mapLegacyStatus(authState),
    authenticated: authState === AUTH.AUTHENTICATED,
    user: publicUser(raw.user),
    organization,
    membership,
    role,
    permissions,
  }
}

function mapLegacyStatus(state) {
  if (state === AUTH.AUTHENTICATED) return 'authenticated'
  if (state === AUTH.SESSION_EXPIRED) return 'expired'
  if (state === AUTH.AUTHENTICATING) return 'authenticating'
  if (state === AUTH.AUTH_ERROR) return 'error'
  return 'none'
}

function getState() {
  return (
    lastPublicContext || {
      state: authState,
      status: mapLegacyStatus(authState),
      authenticated: false,
      user: null,
      organization: null,
      membership: null,
      role: null,
      permissions: null,
    }
  )
}

function isAuthenticated() {
  return authState === AUTH.AUTHENTICATED && Boolean(sessionStore.getToken())
}

function clear() {
  sessionStore.clearSession()
  authState = AUTH.UNAUTHENTICATED
  lastPublicContext = publicContext({})
  return getState()
}

async function fetchSessionContext() {
  const me = await cloudFetch({ method: 'GET', path: '/auth/me', auth: true })
  let organization = null
  let membership = null
  let permissions = null
  try {
    const org = await cloudFetch({ method: 'GET', path: '/organization/me', auth: true })
    organization = org.data?.organization ?? null
  } catch (error) {
    if (error.code === 'SESSION_EXPIRED' || error.code === 'UNAUTHORIZED') throw error
    organization = null
  }
  try {
    const mem = await cloudFetch({
      method: 'GET',
      path: '/organization/me/membership',
      auth: true,
    })
    membership = mem.data?.membership ?? null
  } catch (error) {
    if (error.code === 'SESSION_EXPIRED' || error.code === 'UNAUTHORIZED') throw error
    membership = null
  }
  try {
    const perms = await cloudFetch({ method: 'GET', path: '/auth/permissions', auth: true })
    permissions = {
      organizationId: perms.data?.organizationId ?? null,
      membershipId: perms.data?.membershipId ?? null,
      role: perms.data?.role ?? null,
      permissions: perms.data?.permissions ?? [],
    }
  } catch (error) {
    if (error.code === 'SESSION_EXPIRED' || error.code === 'UNAUTHORIZED') throw error
    permissions = null
  }

  authState = AUTH.AUTHENTICATED
  lastPublicContext = publicContext({
    user: me.data?.user ?? null,
    organization,
    membership,
    permissions,
  })
  return getState()
}

async function persistCapturedSession(result, fallbackEmail) {
  if (!result.capturedToken) {
    authState = AUTH.AUTH_ERROR
    throw new CloudApiError('HTTP', 'Auth response missing token', result.status, result.data)
  }

  try {
    sessionStore.writeSession({
      token: result.capturedToken,
      expiresAt: result.capturedExpires ?? null,
      email: result.capturedUser?.email ?? fallbackEmail,
    })
  } catch (error) {
    sessionStore.clearSession()
    authState = AUTH.AUTH_ERROR
    if (error && error.code === 'SAFE_STORAGE') {
      throw new CloudApiError(
        'SAFE_STORAGE',
        'safeStorage unavailable — refusing to store session in plaintext',
        0,
      )
    }
    throw error
  }

  try {
    return await fetchSessionContext()
  } catch (error) {
    if (error.code === 'SESSION_EXPIRED' || error.code === 'UNAUTHORIZED') {
      authState = AUTH.SESSION_EXPIRED
      lastPublicContext = publicContext({})
    } else {
      authState = AUTH.AUTH_ERROR
    }
    throw error
  }
}

async function login(email, password) {
  authState = AUTH.AUTHENTICATING
  lastPublicContext = publicContext({})

  if (!sessionStore.isEncryptionAvailable()) {
    authState = AUTH.AUTH_ERROR
    const err = new CloudApiError(
      'SAFE_STORAGE',
      'safeStorage unavailable — refusing to store session in plaintext',
      0,
    )
    throw err
  }

  const result = await cloudFetch({
    method: 'POST',
    path: '/auth/login',
    auth: false,
    captureToken: true,
    body: {
      email,
      password,
      device: {
        deviceIdentifier: getInstallationIdSafe(),
        platform: process.platform,
        appVersion: '3.1.1',
      },
    },
  })

  return persistCapturedSession(result, email)
}

/**
 * Commercial onboarding — bootstrap org + admin, seal session like login.
 * @param {Record<string, unknown>} payload
 */
async function bootstrapOrganization(payload) {
  authState = AUTH.AUTHENTICATING
  lastPublicContext = publicContext({})

  if (!sessionStore.isEncryptionAvailable()) {
    authState = AUTH.AUTH_ERROR
    const err = new CloudApiError(
      'SAFE_STORAGE',
      'safeStorage unavailable — refusing to store session in plaintext',
      0,
    )
    throw err
  }

  const body = {
    licenseKey: payload && String(payload.licenseKey || '').trim(),
    organizationName: payload && String(payload.organizationName || '').trim(),
    adminEmail: payload && String(payload.adminEmail || '').trim(),
    adminPassword: payload && String(payload.adminPassword || ''),
    adminName: payload && String(payload.adminName || '').trim(),
    phone: payload && payload.phone != null ? String(payload.phone).trim() : undefined,
    city: payload && payload.city != null ? String(payload.city).trim() : undefined,
    device: {
      deviceIdentifier: getInstallationIdSafe(),
      platform: process.platform,
      appVersion: '3.1.1',
    },
  }

  if (!body.licenseKey || !body.organizationName || !body.adminEmail || !body.adminPassword || !body.adminName) {
    authState = AUTH.AUTH_ERROR
    throw new CloudApiError('VALIDATION', 'Missing bootstrap fields', 400)
  }

  const result = await cloudFetch({
    method: 'POST',
    path: '/auth/bootstrap-organization',
    auth: false,
    captureToken: true,
    body,
  })

  return persistCapturedSession(result, body.adminEmail)
}

/**
 * @param {string} licenseKey
 */
async function getOnboardingStatus(licenseKey) {
  const key = String(licenseKey || '').trim()
  if (!key) {
    throw new CloudApiError('VALIDATION', 'licenseKey required', 400)
  }
  const result = await cloudFetch({
    method: 'GET',
    path: '/auth/onboarding-status',
    auth: false,
    query: { licenseKey: key },
  })
  return {
    licenseKey: result.data?.licenseKey ?? key,
    registered: Boolean(result.data?.registered),
    organizationName: result.data?.organizationName ?? null,
  }
}

async function logout() {
  let apiRevoked = false
  if (sessionStore.getToken()) {
    try {
      await cloudFetch({ method: 'POST', path: '/auth/logout', auth: true })
      apiRevoked = true
    } catch {
      apiRevoked = false
    }
  }
  const state = clear()
  return { ok: true, apiRevoked, state: state.state, context: state }
}

async function restore() {
  authState = AUTH.AUTHENTICATING
  const read = sessionStore.readSessionResult()

  if (read.reason === 'missing') {
    authState = AUTH.UNAUTHENTICATED
    lastPublicContext = publicContext({})
    return getState()
  }

  if (read.reason === 'encryption_unavailable') {
    authState = AUTH.AUTH_ERROR
    lastPublicContext = publicContext({})
    const err = new CloudApiError(
      'SAFE_STORAGE',
      'safeStorage unavailable — cannot restore encrypted session',
      0,
    )
    throw err
  }

  if (read.reason === 'malformed') {
    sessionStore.clearSession()
    authState = AUTH.UNAUTHENTICATED
    lastPublicContext = publicContext({})
    return getState()
  }

  try {
    return await fetchSessionContext()
  } catch (error) {
    if (error.code === 'SESSION_EXPIRED' || error.code === 'UNAUTHORIZED') {
      authState = AUTH.SESSION_EXPIRED
      lastPublicContext = publicContext({})
      return getState()
    }
    authState = AUTH.AUTH_ERROR
    throw error
  }
}

function hasSession() {
  return sessionStore.hasSession()
}

module.exports = {
  AUTH,
  login,
  bootstrapOrganization,
  getOnboardingStatus,
  logout,
  restore,
  getState,
  clear,
  isAuthenticated,
  hasSession,
  publicContext,
}
