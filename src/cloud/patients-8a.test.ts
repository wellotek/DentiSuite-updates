import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  assertNoSecretsInPatientsPayload,
  listCloudPatients,
  patientsLoadStateFromError,
} from './patientsRepository'
import { CloudClientError } from './errors'

describe('listCloudPatients Phase 8A', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('1. success via dedicated IPC', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsList: async () => ({
        ok: true as const,
        status: 200,
        data: {
          items: [
            {
              id: 'uuid-1',
              organizationId: 'ac3d519a-b1cd-4926-9c12-c6721c6e9907',
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
    const list = await listCloudPatients()
    expect(list.total).toBe(1)
    expect(list.items[0]?.organizationId).toBe('ac3d519a-b1cd-4926-9c12-c6721c6e9907')
  })

  it('2. empty list', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsList: async () => ({
        ok: true as const,
        status: 200,
        data: { items: [], page: 1, limit: 50, total: 0, totalPages: 0 },
      }),
    }
    const list = await listCloudPatients()
    expect(list.items).toEqual([])
    expect(list.total).toBe(0)
  })

  it('3. 401 SESSION_EXPIRED', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsList: async () => ({
        ok: false as const,
        code: 'SESSION_EXPIRED',
        message: 'expired',
        status: 401,
        state: 'SESSION_EXPIRED',
      }),
    }
    await expect(listCloudPatients()).rejects.toMatchObject({ kind: 'expired' })
    expect(patientsLoadStateFromError(new CloudClientError('expired', 'SESSION_EXPIRED', 'x', 401))).toBe(
      'SESSION_EXPIRED',
    )
  })

  it('4. 403 FORBIDDEN', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsList: async () => ({
        ok: false as const,
        code: 'FORBIDDEN',
        message: 'nope',
        status: 403,
      }),
    }
    await expect(listCloudPatients()).rejects.toMatchObject({ kind: 'forbidden' })
    expect(patientsLoadStateFromError(new CloudClientError('forbidden', 'FORBIDDEN', 'x', 403))).toBe(
      'FORBIDDEN',
    )
  })

  it('5. API / network error', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsList: async () => ({
        ok: false as const,
        code: 'NETWORK',
        message: 'down',
        status: 0,
      }),
    }
    await expect(listCloudPatients()).rejects.toMatchObject({ kind: 'network' })
    expect(patientsLoadStateFromError(new CloudClientError('network', 'NETWORK', 'x', 0))).toBe('API_ERROR')
  })

  it('6. response never contains token', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsList: async () => ({
        ok: true as const,
        status: 200,
        data: {
          items: [],
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0,
          token: 'leaked',
        },
      }),
    }
    await expect(listCloudPatients()).rejects.toMatchObject({ code: 'SECRET_LEAK' })
  })

  it('6b. assertNoSecretsInPatientsPayload accepts clean payload', () => {
    expect(() =>
      assertNoSecretsInPatientsPayload({
        ok: true,
        data: { items: [{ id: '1', firstName: 'A', lastName: 'B' }], total: 1 },
      }),
    ).not.toThrow()
  })

  it('7. does not send organizationId from renderer query', async () => {
    const spy = vi.fn(async () => ({
      ok: true as const,
      status: 200,
      data: { items: [], page: 1, limit: 50, total: 0, totalPages: 0 },
    }))
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsList: spy,
    }
    await listCloudPatients({ search: 'x', page: 1, limit: 50 })
    expect(spy).toHaveBeenCalledWith({ search: 'x', page: 1, limit: 50 })
    const calls = spy.mock.calls as unknown as Array<[Record<string, unknown>?]>
    const firstArg = calls[0]?.[0]
    expect(firstArg).not.toHaveProperty('organizationId')
    expect(firstArg).not.toHaveProperty('orgId')
  })

  it('8. never writes Legacy clinic via listCloudPatients', async () => {
    const setClinic = vi.fn(async () => undefined)
    window.dentisuite = {
      getClinic: async () => null,
      setClinic,
      cloudPatientsList: async () => ({
        ok: true as const,
        status: 200,
        data: { items: [], page: 1, limit: 50, total: 0, totalPages: 0 },
      }),
    }
    await listCloudPatients()
    expect(setClinic).not.toHaveBeenCalled()
  })

  it('9. repository has list+create+update but no delete (Phase 8C)', async () => {
    const mod = await import('./patientsRepository')
    expect(typeof mod.listCloudPatients).toBe('function')
    expect(typeof mod.createCloudPatient).toBe('function')
    expect(typeof mod.updateCloudPatient).toBe('function')
    expect(mod).not.toHaveProperty('deleteCloudPatient')
    expect(mod).not.toHaveProperty('patchCloudPatient')
  })

  it('falls back to cloudRequest GET /patients when dedicated IPC missing', async () => {
    const cloudRequest = vi.fn(async () => ({
      ok: true as const,
      status: 200,
      data: { items: [], page: 1, limit: 50, total: 0, totalPages: 0 },
    }))
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudRequest,
    }
    await listCloudPatients({ search: 'q' })
    expect(cloudRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/patients' }),
    )
  })
})
