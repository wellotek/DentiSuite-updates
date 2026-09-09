import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CloudClientError, cloudErrorLabel, mapCloudFailure } from './errors'
import { listCloudPatients } from './patientsRepository'
import { loginCloud, logoutCloud, restoreCloudSession } from './session'

describe('mapCloudFailure', () => {
  it('maps 401 / UNAUTHORIZED', () => {
    const err = mapCloudFailure({ code: 'UNAUTHORIZED', message: 'gone', status: 401 })
    expect(err.kind).toBe('unauthorized')
    expect(cloudErrorLabel(err)).toMatch(/401/)
  })

  it('maps 403', () => {
    expect(mapCloudFailure({ code: 'FORBIDDEN', status: 403 }).kind).toBe('forbidden')
  })

  it('maps network', () => {
    expect(mapCloudFailure({ code: 'NETWORK', status: 0 }).kind).toBe('network')
  })

  it('maps server 5xx', () => {
    expect(mapCloudFailure({ code: 'SERVER', status: 502 }).kind).toBe('server')
  })

  it('maps conflict 409 without treating as network', () => {
    const err = mapCloudFailure({
      code: 'LICENSE_ALREADY_REGISTERED',
      message: 'already linked',
      status: 409,
    })
    expect(err.kind).toBe('conflict')
    expect(cloudErrorLabel(err)).toMatch(/already linked|Conflit/i)
  })

  it('maps license seat / expired as forbidden', () => {
    expect(mapCloudFailure({ code: 'LICENSE_SEAT_LIMIT', status: 403 }).kind).toBe('forbidden')
    expect(mapCloudFailure({ code: 'LICENSE_EXPIRED', status: 403 }).kind).toBe('forbidden')
  })

  it('maps validation 400', () => {
    expect(mapCloudFailure({ code: 'VALIDATION_ERROR', status: 400 }).kind).toBe('validation')
  })

  it('maps probe disabled', () => {
    expect(mapCloudFailure({ code: 'PROBE_DISABLED', message: 'off' }).kind).toBe('disabled')
  })

  it('maps invalid credentials separately from expiry', () => {
    expect(mapCloudFailure({ code: 'INVALID_CREDENTIALS', status: 401 }).kind).toBe('credentials')
    expect(mapCloudFailure({ code: 'SESSION_EXPIRED', status: 401 }).kind).toBe('expired')
  })

  it('maps safeStorage failure', () => {
    expect(mapCloudFailure({ code: 'SAFE_STORAGE' }).kind).toBe('storage')
  })
})
describe('listCloudPatients', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns items on 200', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudRequest: async () => ({
        ok: true as const,
        status: 200,
        data: {
          items: [
            {
              id: 'p1',
              organizationId: 'o1',
              firstName: 'A',
              lastName: 'B',
              phone: '1',
              age: 20,
              address: '',
              antecedents: '',
              hasAllergies: false,
              dentistId: null,
              notes: null,
            },
          ],
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
        },
      }),
    }
    const list = await listCloudPatients({ search: 'B' })
    expect(list.total).toBe(1)
    expect(list.items[0]?.lastName).toBe('B')
  })

  it('maps empty list', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudRequest: async () => ({
        ok: true as const,
        status: 200,
        data: { items: [], page: 1, limit: 50, total: 0, totalPages: 0 },
      }),
    }
    const list = await listCloudPatients()
    expect(list.items).toEqual([])
    expect(list.total).toBe(0)
  })

  it('maps 401 SESSION_EXPIRED', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudRequest: async () => ({
        ok: false as const,
        code: 'SESSION_EXPIRED',
        message: 'expired',
        status: 401,
        state: 'SESSION_EXPIRED',
      }),
    }
    await expect(listCloudPatients()).rejects.toMatchObject({ kind: 'expired' })
  })

  it('maps 403', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudRequest: async () => ({
        ok: false as const,
        code: 'FORBIDDEN',
        message: 'nope',
        status: 403,
      }),
    }
    await expect(listCloudPatients()).rejects.toBeInstanceOf(CloudClientError)
  })

  it('maps network error', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudRequest: async () => ({
        ok: false as const,
        code: 'NETWORK',
        message: 'down',
        status: 0,
      }),
    }
    await expect(listCloudPatients()).rejects.toMatchObject({ kind: 'network' })
  })
})

describe('cloud session helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('login success restores authenticated context', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudConfig: async () => ({
        probeEnabled: true,
        apiBaseUrl: 'http://127.0.0.1:3001',
        cloudMode: false,
      }),
      cloudLogin: async () => ({
        ok: true as const,
        user: { id: 'u1', email: 'a@b.c' },
        context: {
          status: 'authenticated' as const,
          user: { id: 'u1', email: 'a@b.c' },
          organization: { id: 'o1', name: 'Pilot', slug: 'pilot', status: 'ACTIVE' },
          membership: {
            id: 'm1',
            userId: 'u1',
            organizationId: 'o1',
            role: 'ADMIN',
            status: 'ACTIVE',
          },
          permissions: {
            organizationId: 'o1',
            membershipId: 'm1',
            role: 'ADMIN',
            permissions: ['patients.read'],
          },
        },
      }),
    }
    const ctx = await loginCloud('a@b.c', 'secret')
    expect(ctx.status).toBe('authenticated')
    expect(ctx.membership?.role).toBe('ADMIN')
    expect(ctx.permissions?.permissions).toContain('patients.read')
  })

  it('invalid credentials surface as error', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudLogin: async () => ({
        ok: false as const,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
        status: 401,
      }),
    }
    await expect(loginCloud('x@y.z', 'bad')).rejects.toMatchObject({ kind: 'credentials' })
  })

  it('restore expired session', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudConfig: async () => ({
        probeEnabled: true,
        apiBaseUrl: 'http://127.0.0.1:3001',
        cloudMode: false,
      }),
      cloudRequest: async () => ({
        ok: false as const,
        code: 'UNAUTHORIZED',
        message: 'expired',
        status: 401,
      }),
      cloudHasSession: async () => ({ probeEnabled: true, hasSession: true }),
      cloudRestore: async () => ({
        ok: true as const,
        context: { status: 'expired' as const, state: 'SESSION_EXPIRED' as const, authenticated: false },
      }),
    }
    const ctx = await restoreCloudSession()
    expect(ctx.status).toBe('expired')
    expect(ctx.state).toBe('SESSION_EXPIRED')
  })

  it('logout still succeeds when API reports local clear', async () => {
    const logout = vi.fn(async () => ({ ok: true as const, apiRevoked: false, state: 'UNAUTHENTICATED' }))
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudLogout: logout,
    }
    await logoutCloud()
    expect(logout).toHaveBeenCalled()
  })

  it('login payload never includes token', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudConfig: async () => ({
        probeEnabled: true,
        apiBaseUrl: 'http://127.0.0.1:3001',
        cloudMode: false,
      }),
      cloudLogin: async () => ({
        ok: true as const,
        user: { id: 'u1', email: 'a@b.c' },
        context: {
          status: 'authenticated' as const,
          state: 'AUTHENTICATED' as const,
          authenticated: true,
          user: { id: 'u1', email: 'a@b.c' },
          organization: { id: 'o1', name: 'Pilot', slug: 'pilot', status: 'ACTIVE' },
          membership: {
            id: 'm1',
            userId: 'u1',
            organizationId: 'o1',
            role: 'ADMIN',
            status: 'ACTIVE',
          },
          permissions: {
            organizationId: 'o1',
            membershipId: 'm1',
            role: 'ADMIN',
            permissions: ['patients.read'],
          },
        },
      }),
    }
    const ctx = await loginCloud('a@b.c', 'secret')
    expect(JSON.stringify(ctx)).not.toMatch(/Bearer/i)
    expect(JSON.stringify(ctx)).not.toContain('"token"')
  })
})

describe('token never in clinic persistence helpers', () => {
  it('does not define CLOUD_MODE global', async () => {
    const { readCloudConfig } = await import('./bridge')
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudConfig: async () => ({
        probeEnabled: false,
        apiBaseUrl: 'http://127.0.0.1:3001',
        cloudMode: false,
      }),
    }
    const cfg = await readCloudConfig()
    expect(cfg.cloudMode).toBe(false)
    expect(cfg.probeEnabled).toBe(false)
  })
})
