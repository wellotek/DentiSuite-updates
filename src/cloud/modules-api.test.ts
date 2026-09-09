import { describe, expect, it, vi, beforeEach } from 'vitest'
import { cloudApi } from './api'
import { listAppointments } from './modules/appointments'
import { listDentists } from './modules/dentists'

describe('cloudApi generic modules', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('scrubs organizationId from body and never writes Legacy', async () => {
    const setClinic = vi.fn(async () => undefined)
    const cloudRequest = vi.fn(async () => ({
      ok: true as const,
      status: 200,
      data: { items: [], page: 1, limit: 50, total: 0, totalPages: 0 },
    }))
    window.dentisuite = {
      getClinic: async () => null,
      setClinic,
      cloudRequest,
    }
    await cloudApi({
      method: 'POST',
      path: '/dentists',
      body: { firstName: 'A', lastName: 'B', specialty: 'X', color: '#000000', organizationId: 'evil' },
    })
    expect(cloudRequest).toHaveBeenCalled()
    const firstArg = cloudRequest.mock.calls.at(0)?.at(0) as
      | { body?: Record<string, unknown> }
      | undefined
    expect(firstArg?.body).not.toHaveProperty('organizationId')
    expect(setClinic).not.toHaveBeenCalled()
  })

  it('listAppointments and listDentists use GET paths', async () => {
    const cloudRequest = vi.fn(async (input: { path: string }) => ({
      ok: true as const,
      status: 200,
      data: { items: [], page: 1, limit: 50, total: 0, totalPages: 0, path: input.path },
    }))
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudRequest,
    }
    await listAppointments({ date: '2026-09-04' })
    await listDentists({ q: 'a' })
    expect(cloudRequest.mock.calls[0]?.[0]).toMatchObject({ method: 'GET', path: '/appointments' })
    expect(cloudRequest.mock.calls[1]?.[0]).toMatchObject({ method: 'GET', path: '/dentists' })
  })
})
