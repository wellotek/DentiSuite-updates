import { describe, expect, it, vi, beforeEach } from 'vitest'
import { readCloudConfig, isCloudModeActive } from './bridge'

describe('app mode bridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('maps probeEnabled compat to CLOUD appMode', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudConfig: async () => ({
        probeEnabled: true,
        apiBaseUrl: 'http://127.0.0.1:3001',
        cloudMode: true,
        appMode: 'CLOUD' as const,
      }),
      cloudRequest: async () => ({ ok: true as const, status: 200, data: {} }),
    }
    const cfg = await readCloudConfig()
    expect(cfg.appMode).toBe('CLOUD')
    expect(cfg.cloudMode).toBe(true)
    expect(await isCloudModeActive()).toBe(true)
  })

  it('keeps LEGACY when cloud disabled', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudConfig: async () => ({
        probeEnabled: false,
        apiBaseUrl: 'http://127.0.0.1:3001',
        cloudMode: false,
        appMode: 'LEGACY' as const,
      }),
      cloudRequest: async () => ({ ok: true as const, status: 200, data: {} }),
    }
    const cfg = await readCloudConfig()
    expect(cfg.appMode).toBe('LEGACY')
    expect(await isCloudModeActive()).toBe(false)
  })
})
