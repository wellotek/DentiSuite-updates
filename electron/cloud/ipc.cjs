/**
 * Phase 7B — Cloud IPC (token never exposed to renderer).
 */
'use strict'

const { ipcMain } = require('electron')
const { getCloudConfig, isCloudEnabled } = require('./config.cjs')
const { isEncryptionAvailable } = require('./session.cjs')
const { cloudFetch, toIpcError } = require('./api-proxy.cjs')
const sessionManager = require('./session-manager.cjs')
const { stripSecrets } = require('./redact.cjs')
const {
  listPatients,
  createPatient,
  updatePatient,
  assertPatientsReadOnly,
} = require('./patients.cjs')
const { assertCloudPathAllowed, scrubCloudBody } = require('./allowlist.cjs')

function assertProbeEnabled() {
  if (!isCloudEnabled()) {
    const err = new Error('Cloud mode disabled (set DENTISUITE_APP_MODE=CLOUD)')
    err.code = 'PROBE_DISABLED'
    throw err
  }
}

function toDisabledOrIpcError(error) {
  if (error && error.code === 'PROBE_DISABLED') {
    return {
      ok: false,
      code: 'PROBE_DISABLED',
      message: error.message,
      status: 0,
    }
  }
  return toIpcError(error)
}

function registerCloudIpc() {
  ipcMain.handle('cloud:config', () => getCloudConfig())

  ipcMain.handle('cloud:hasSession', () => {
    if (!isCloudEnabled()) return { probeEnabled: false, hasSession: false, appMode: 'LEGACY' }
    return {
      probeEnabled: true,
      hasSession: sessionManager.hasSession(),
      encryptionAvailable: isEncryptionAvailable(),
      state: sessionManager.getState().state,
      appMode: 'CLOUD',
    }
  })

  ipcMain.handle('cloud:state', () => {
    if (!isCloudEnabled()) {
      return { ok: true, context: { state: 'UNAUTHENTICATED', status: 'none', authenticated: false } }
    }
    return { ok: true, context: sessionManager.getState() }
  })

  ipcMain.handle('cloud:login', async (_event, payload) => {
    try {
      assertProbeEnabled()
      const email = payload && String(payload.email || '').trim()
      const password = payload && String(payload.password || '')
      if (!email || !password) {
        return { ok: false, code: 'VALIDATION', message: 'Email and password required', status: 400 }
      }
      const context = await sessionManager.login(email, password)
      return stripSecrets({
        ok: true,
        authenticated: true,
        state: context.state,
        user: context.user,
        organization: context.organization,
        membership: context.membership,
        role: context.role,
        permissions: context.permissions,
        context,
      })
    } catch (error) {
      return toDisabledOrIpcError(error)
    }
  })

  ipcMain.handle('cloud:bootstrapOrganization', async (_event, payload) => {
    try {
      assertProbeEnabled()
      const context = await sessionManager.bootstrapOrganization(payload || {})
      return stripSecrets({
        ok: true,
        authenticated: true,
        state: context.state,
        user: context.user,
        organization: context.organization,
        membership: context.membership,
        role: context.role,
        permissions: context.permissions,
        context,
      })
    } catch (error) {
      return toDisabledOrIpcError(error)
    }
  })

  ipcMain.handle('cloud:onboardingStatus', async (_event, payload) => {
    try {
      assertProbeEnabled()
      const licenseKey = payload && String(payload.licenseKey || '').trim()
      const status = await sessionManager.getOnboardingStatus(licenseKey)
      return stripSecrets({ ok: true, ...status })
    } catch (error) {
      return toDisabledOrIpcError(error)
    }
  })

  ipcMain.handle('cloud:logout', async () => {
    try {
      assertProbeEnabled()
      const result = await sessionManager.logout()
      return stripSecrets({ ok: true, ...result })
    } catch (error) {
      sessionManager.clear()
      if (error && error.code === 'PROBE_DISABLED') {
        return toDisabledOrIpcError(error)
      }
      return stripSecrets({
        ok: true,
        apiRevoked: false,
        localCleared: true,
        state: 'UNAUTHENTICATED',
        context: sessionManager.getState(),
      })
    }
  })

  ipcMain.handle('cloud:restore', async () => {
    try {
      assertProbeEnabled()
      const context = await sessionManager.restore()
      return stripSecrets({ ok: true, context })
    } catch (error) {
      return toDisabledOrIpcError(error)
    }
  })

  /** Phase 8A — dedicated patients list (no orgId from renderer). */
  ipcMain.handle('cloud:patients:list', async (_event, payload) => {
    try {
      assertProbeEnabled()
      // Discard any client orgId / organizationId — tenant is session-only.
      const list = await listPatients({
        search: payload && payload.search,
        page: payload && payload.page,
        limit: payload && payload.limit,
      })
      return stripSecrets({
        ok: true,
        status: 200,
        data: list,
        state: sessionManager.getState().state,
      })
    } catch (error) {
      const mapped = toDisabledOrIpcError(error)
      if (mapped.code === 'SESSION_EXPIRED') {
        return { ...mapped, state: 'SESSION_EXPIRED' }
      }
      return mapped
    }
  })

  /** Phase 8B — create patient (POST only via this IPC; org from session). */
  ipcMain.handle('cloud:patients:create', async (_event, payload) => {
    try {
      assertProbeEnabled()
      const created = await createPatient(payload || {})
      return stripSecrets({
        ok: true,
        status: created.status || 201,
        data: { patient: created.patient },
        state: sessionManager.getState().state,
      })
    } catch (error) {
      const mapped = toDisabledOrIpcError(error)
      if (mapped.code === 'SESSION_EXPIRED') {
        return { ...mapped, state: 'SESSION_EXPIRED' }
      }
      return mapped
    }
  })

  /** Phase 8C — update patient (PATCH only via this IPC; org from session). */
  ipcMain.handle('cloud:patients:update', async (_event, payload) => {
    try {
      assertProbeEnabled()
      const patientId = payload && payload.id
      const patch = payload && typeof payload === 'object' ? { ...payload } : {}
      delete patch.id
      delete patch.organizationId
      delete patch.orgId
      const updated = await updatePatient(patientId, patch)
      return stripSecrets({
        ok: true,
        status: updated.status || 200,
        data: { patient: updated.patient },
        state: sessionManager.getState().state,
      })
    } catch (error) {
      const mapped = toDisabledOrIpcError(error)
      if (mapped.code === 'SESSION_EXPIRED') {
        return { ...mapped, state: 'SESSION_EXPIRED' }
      }
      return mapped
    }
  })

  ipcMain.handle('cloud:request', async (_event, payload) => {
    try {
      assertProbeEnabled()
      const method = payload && payload.method
      const reqPath = payload && payload.path
      if (!reqPath || typeof reqPath !== 'string') {
        return { ok: false, code: 'VALIDATION', message: 'path required', status: 400 }
      }
      // Allowlisted business API only (patients dedicated IPC still preferred for create/update).
      assertCloudPathAllowed(method || 'GET', reqPath)
      assertPatientsReadOnly(method || 'GET', reqPath)
      const result = await cloudFetch({
        method: method || 'GET',
        path: reqPath,
        query: payload.query,
        body: scrubCloudBody(payload.body),
        auth: payload.auth !== false,
      })
      return stripSecrets({
        ok: true,
        status: result.status,
        data: result.data,
        state: sessionManager.getState().state,
      })
    } catch (error) {
      const mapped = toDisabledOrIpcError(error)
      if (mapped.code === 'SESSION_EXPIRED') {
        return { ...mapped, state: 'SESSION_EXPIRED' }
      }
      return mapped
    }
  })
}

module.exports = { registerCloudIpc }
