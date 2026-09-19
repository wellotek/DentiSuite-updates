/**
 * @vitest-environment node
 * Phase 5 — Electron allowlist + backup hardening (root suite).
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateClinicBackup } from './clinicBackup'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('phase 5 electron allowlist', () => {
  it('allows bulk hydrate GETs and blocks generic patient POST/PATCH', () => {
    const allowPath = path.join(root, 'electron/cloud/allowlist.cjs')
    delete require.cache[require.resolve(allowPath)]
    const { assertCloudPathAllowed } = require(allowPath)
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

    expect(() => assertCloudPathAllowed('GET', '/consultations')).not.toThrow()
    expect(() => assertCloudPathAllowed('GET', '/treatments')).not.toThrow()
    expect(() => assertCloudPathAllowed('GET', '/prescriptions')).not.toThrow()
    expect(() => assertCloudPathAllowed('GET', '/media')).not.toThrow()
    expect(() => assertCloudPathAllowed('POST', '/patients')).toThrow()
    expect(() => assertCloudPathAllowed('PATCH', `/patients/${id}`)).toThrow()
    expect(() => assertCloudPathAllowed('DELETE', `/patients/${id}`)).not.toThrow()
    expect(() => assertCloudPathAllowed('POST', `/patients/${id}/restore`)).not.toThrow()
  })
})

describe('phase 5 backup validation', () => {
  it('rejects arrays and missing patients', () => {
    expect(validateClinicBackup([]).ok).toBe(false)
    expect(
      validateClinicBackup({
        format: 'dentisuite-clinic-backup',
        formatVersion: 1,
        clinic: { patients: null },
      }).ok,
    ).toBe(false)
  })
})
