/**
 * @vitest-environment node
 */
import { createRequire } from 'node:module'
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function mockSafeStorage() {
  return {
    available: true,
    isEncryptionAvailable() {
      return this.available
    },
    encryptString(value: string) {
      return Buffer.from(`enc:${value}`, 'utf8')
    },
    decryptString(buf: Buffer) {
      const text = buf.toString('utf8')
      if (!text.startsWith('enc:')) throw new Error('bad blob')
      return text.slice(4)
    },
  }
}

describe('redact', () => {
  const { stripSecrets, redactString, containsSecretLeak } = require(
    path.join(root, 'electron/cloud/redact.cjs'),
  )

  it('strips token password authorization keys', () => {
    const out = stripSecrets({
      token: 'secret-token-value',
      password: 'hunter2',
      authorization: 'Bearer abc',
      user: { email: 'a@b.c' },
    })
    expect(out.token).toBeUndefined()
    expect(out.password).toBeUndefined()
    expect(out.authorization).toBeUndefined()
    expect(out.user.email).toBe('a@b.c')
    expect(containsSecretLeak(out)).toBe(false)
  })

  it('redacts Bearer in strings', () => {
    expect(redactString('Authorization: Bearer abcdefghijkl')).toContain('[REDACTED]')
    expect(redactString('Authorization: Bearer abcdefghijkl')).not.toContain('abcdefghijkl')
  })
})

describe('createSessionStore', () => {
  const { createSessionStore } = require(path.join(root, 'electron/cloud/session.cjs'))

  it('writes encrypted session and never plaintext token file', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ds-sess-'))
    const safeStorage = mockSafeStorage()
    const store = createSessionStore({
      safeStorage,
      getUserDataPath: () => dir,
    })
    store.writeSession({ token: 'raw-token-xyz', email: 'a@b.c', expiresAt: null })
    expect(store.getToken()).toBe('raw-token-xyz')
    expect(store.hasSession()).toBe(true)
    const file = store.sessionPath()
    expect(existsSync(file)).toBe(true)
    const disk = require('node:fs').readFileSync(file, 'utf8')
    expect(disk).toContain('enc:')
    expect(disk).not.toBe('raw-token-xyz')
  })

  it('refuses plaintext when safeStorage unavailable', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ds-sess-'))
    const safeStorage = mockSafeStorage()
    safeStorage.available = false
    const store = createSessionStore({
      safeStorage,
      getUserDataPath: () => dir,
    })
    expect(() => store.writeSession({ token: 'raw-token-xyz' })).toThrow(/safeStorage unavailable/)
    expect(existsSync(store.sessionPath())).toBe(false)
  })

  it('treats missing file as no session', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ds-sess-'))
    const store = createSessionStore({
      safeStorage: mockSafeStorage(),
      getUserDataPath: () => dir,
    })
    expect(store.readSessionResult().reason).toBe('missing')
    expect(store.hasSession()).toBe(false)
  })

  it('treats malformed blob as malformed and clear removes it', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ds-sess-'))
    const store = createSessionStore({
      safeStorage: mockSafeStorage(),
      getUserDataPath: () => dir,
    })
    writeFileSync(store.sessionPath(), 'not-encrypted')
    expect(store.readSessionResult().reason).toBe('malformed')
    store.clearSession()
    expect(existsSync(store.sessionPath())).toBe(false)
    expect(store.getToken()).toBeNull()
  })
})
