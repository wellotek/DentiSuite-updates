/**
 * @vitest-environment node
 */
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const modPath = path.join(root, 'electron/cloud/config.cjs')

function loadConfig() {
  delete require.cache[require.resolve(modPath)]
  return require(modPath)
}

describe('electron app mode config', () => {
  it('defaults to LEGACY when unpackaged and no env', () => {
    const prevMode = process.env.DENTISUITE_APP_MODE
    const prevProbe = process.env.DENTISUITE_CLOUD_PROBE
    delete process.env.DENTISUITE_APP_MODE
    delete process.env.DENTISUITE_CLOUD_PROBE
    const { getCloudConfig, getAppMode } = loadConfig()
    expect(getAppMode()).toBe('LEGACY')
    expect(getCloudConfig().cloudMode).toBe(false)
    expect(getCloudConfig().probeEnabled).toBe(false)
    expect(getCloudConfig().appMode).toBe('LEGACY')
    if (prevMode === undefined) delete process.env.DENTISUITE_APP_MODE
    else process.env.DENTISUITE_APP_MODE = prevMode
    if (prevProbe === undefined) delete process.env.DENTISUITE_CLOUD_PROBE
    else process.env.DENTISUITE_CLOUD_PROBE = prevProbe
    loadConfig()
  })

  it('enables CLOUD with DENTISUITE_APP_MODE=CLOUD', () => {
    const prevMode = process.env.DENTISUITE_APP_MODE
    const prevProbe = process.env.DENTISUITE_CLOUD_PROBE
    delete process.env.DENTISUITE_CLOUD_PROBE
    process.env.DENTISUITE_APP_MODE = 'CLOUD'
    const { getCloudConfig } = loadConfig()
    expect(getCloudConfig().appMode).toBe('CLOUD')
    expect(getCloudConfig().cloudMode).toBe(true)
    expect(getCloudConfig().probeEnabled).toBe(true)
    if (prevMode === undefined) delete process.env.DENTISUITE_APP_MODE
    else process.env.DENTISUITE_APP_MODE = prevMode
    if (prevProbe === undefined) delete process.env.DENTISUITE_CLOUD_PROBE
    else process.env.DENTISUITE_CLOUD_PROBE = prevProbe
    loadConfig()
  })

  it('treats DENTISUITE_CLOUD_PROBE=1 as CLOUD compat alias', () => {
    const prevMode = process.env.DENTISUITE_APP_MODE
    const prevProbe = process.env.DENTISUITE_CLOUD_PROBE
    delete process.env.DENTISUITE_APP_MODE
    process.env.DENTISUITE_CLOUD_PROBE = '1'
    const { getCloudConfig } = loadConfig()
    expect(getCloudConfig().cloudMode).toBe(true)
    expect(getCloudConfig().appMode).toBe('CLOUD')
    if (prevMode === undefined) delete process.env.DENTISUITE_APP_MODE
    else process.env.DENTISUITE_APP_MODE = prevMode
    if (prevProbe === undefined) delete process.env.DENTISUITE_CLOUD_PROBE
    else process.env.DENTISUITE_CLOUD_PROBE = prevProbe
    loadConfig()
  })

  it('LEGACY wins over probe when APP_MODE=LEGACY', () => {
    const prevMode = process.env.DENTISUITE_APP_MODE
    const prevProbe = process.env.DENTISUITE_CLOUD_PROBE
    process.env.DENTISUITE_APP_MODE = 'LEGACY'
    process.env.DENTISUITE_CLOUD_PROBE = '1'
    const { getCloudConfig } = loadConfig()
    expect(getCloudConfig().appMode).toBe('LEGACY')
    expect(getCloudConfig().cloudMode).toBe(false)
    if (prevMode === undefined) delete process.env.DENTISUITE_APP_MODE
    else process.env.DENTISUITE_APP_MODE = prevMode
    if (prevProbe === undefined) delete process.env.DENTISUITE_CLOUD_PROBE
    else process.env.DENTISUITE_CLOUD_PROBE = prevProbe
    loadConfig()
  })

  it('exposes production API constant for packaged clients', () => {
    const { PRODUCTION_API_BASE_URL, CANONICAL_API_BASE_URL } = loadConfig()
    expect(PRODUCTION_API_BASE_URL).toBe('https://dentisuite-api-production.up.railway.app')
    expect(CANONICAL_API_BASE_URL).toBe('https://api.dentisuite.xyz')
    expect(PRODUCTION_API_BASE_URL).not.toMatch(/127\.0\.0\.1|localhost/i)
    expect(PRODUCTION_API_BASE_URL.startsWith('https://')).toBe(true)
  })

  it('packaged cloud config source has no loopback API default', () => {
    const fs = require('node:fs')
    const src = fs.readFileSync(modPath, 'utf8')
    expect(src).not.toMatch(/127\.0\.0\.1/)
    expect(src).not.toMatch(/localhost/i)
  })
})
