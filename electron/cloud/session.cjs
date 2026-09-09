/**
 * Phase 7B — encrypted cloud session file + in-memory token (Main only).
 * Never write tokens to clinic JSON / localStorage / Zustand / plaintext files.
 */
'use strict'

const fs = require('fs')
const path = require('path')

function createSessionStore(deps) {
  const getSafeStorage = () => deps.safeStorage
  const getUserDataPath = () => deps.getUserDataPath()
  let memoryToken = null
  let memoryMeta = { expiresAt: null, email: null }

  function sessionPath() {
    return path.join(getUserDataPath(), 'cloud-session.enc')
  }

  function isEncryptionAvailable() {
    try {
      return Boolean(getSafeStorage()?.isEncryptionAvailable())
    } catch {
      return false
    }
  }

  function clearMemory() {
    memoryToken = null
    memoryMeta = { expiresAt: null, email: null }
  }

  /**
   * @returns {{
   *   ok: boolean
   *   reason: 'ok' | 'missing' | 'encryption_unavailable' | 'malformed'
   *   session: { token: string, expiresAt: string | null, email: string | null } | null
   * }}
   */
  function readSessionResult() {
    const file = sessionPath()
    if (!fs.existsSync(file)) {
      clearMemory()
      return { ok: false, reason: 'missing', session: null }
    }
    if (!isEncryptionAvailable()) {
      return { ok: false, reason: 'encryption_unavailable', session: null }
    }
    try {
      const raw = getSafeStorage().decryptString(fs.readFileSync(file))
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed.token !== 'string' || !parsed.token) {
        return { ok: false, reason: 'malformed', session: null }
      }
      const session = {
        token: parsed.token,
        expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null,
        email: typeof parsed.email === 'string' ? parsed.email : null,
      }
      memoryToken = session.token
      memoryMeta = { expiresAt: session.expiresAt, email: session.email }
      return { ok: true, reason: 'ok', session }
    } catch {
      return { ok: false, reason: 'malformed', session: null }
    }
  }

  function readSession() {
    if (memoryToken) {
      return { token: memoryToken, expiresAt: memoryMeta.expiresAt, email: memoryMeta.email }
    }
    const result = readSessionResult()
    return result.session
  }

  function getToken() {
    if (memoryToken) return memoryToken
    return readSession()?.token ?? null
  }

  /**
   * @param {{ token: string, expiresAt?: string | null, email?: string | null }} session
   */
  function writeSession(session) {
    if (!isEncryptionAvailable()) {
      const err = new Error('safeStorage unavailable')
      err.code = 'SAFE_STORAGE'
      throw err
    }
    if (!session || typeof session.token !== 'string' || !session.token) {
      const err = new Error('invalid cloud session')
      err.code = 'INVALID_SESSION'
      throw err
    }
    const payload = JSON.stringify({
      token: session.token,
      expiresAt: session.expiresAt ?? null,
      email: session.email ?? null,
      savedAt: new Date().toISOString(),
    })
    fs.mkdirSync(path.dirname(sessionPath()), { recursive: true })
    fs.writeFileSync(sessionPath(), getSafeStorage().encryptString(payload))
    memoryToken = session.token
    memoryMeta = { expiresAt: session.expiresAt ?? null, email: session.email ?? null }
  }

  function clearSession() {
    clearMemory()
    try {
      const file = sessionPath()
      if (fs.existsSync(file)) fs.unlinkSync(file)
    } catch {
      /* ignore */
    }
  }

  function hasSession() {
    return Boolean(getToken())
  }

  return {
    sessionPath,
    isEncryptionAvailable,
    readSession,
    readSessionResult,
    writeSession,
    clearSession,
    hasSession,
    getToken,
  }
}

let defaultStore = null

function defaultDeps() {
  const { app, safeStorage } = require('electron')
  return {
    safeStorage,
    getUserDataPath: () => app.getPath('userData'),
  }
}

function store() {
  if (!defaultStore) defaultStore = createSessionStore(defaultDeps())
  return defaultStore
}

module.exports = {
  createSessionStore,
  sessionPath: (...args) => store().sessionPath(...args),
  isEncryptionAvailable: (...args) => store().isEncryptionAvailable(...args),
  readSession: (...args) => store().readSession(...args),
  readSessionResult: (...args) => store().readSessionResult(...args),
  writeSession: (...args) => store().writeSession(...args),
  clearSession: (...args) => store().clearSession(...args),
  hasSession: (...args) => store().hasSession(...args),
  getToken: (...args) => store().getToken(...args),
}
