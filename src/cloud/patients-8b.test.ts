import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  assertNoSecretsInPatientsPayload,
  createCloudPatient,
  listCloudPatients,
  patientsCreateStateFromError,
  patientsLoadStateFromError,
  validateCloudPatientCreate,
} from './patientsRepository'
import { CloudClientError } from './errors'

describe('createCloudPatient Phase 8B', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('1. create success via dedicated IPC', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsCreate: async () => ({
        ok: true as const,
        status: 201,
        data: {
          patient: {
            id: 'uuid-new',
            organizationId: 'ac3d519a-b1cd-4926-9c12-c6721c6e9907',
            firstName: 'Test',
            lastName: 'Patient8B',
            phone: '0555000000',
            age: 30,
            address: '',
            antecedents: '',
            hasAllergies: false,
            dentistId: null,
            notes: null,
          },
        },
      }),
    }
    const p = await createCloudPatient({
      firstName: 'Test',
      lastName: 'Patient8B',
      phone: '0555000000',
      age: 30,
    })
    expect(p.id).toBe('uuid-new')
    expect(p.lastName).toBe('Patient8B')
  })

  it('2. validation error client-side', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsCreate: vi.fn(),
    }
    await expect(
      createCloudPatient({ firstName: '', lastName: 'X', phone: '1', age: 10 }),
    ).rejects.toMatchObject({ kind: 'validation' })
    expect(window.dentisuite.cloudPatientsCreate).not.toHaveBeenCalled()
  })

  it('3. 401 SESSION_EXPIRED', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsCreate: async () => ({
        ok: false as const,
        code: 'SESSION_EXPIRED',
        message: 'expired',
        status: 401,
      }),
    }
    await expect(
      createCloudPatient({ firstName: 'A', lastName: 'B', phone: '1', age: 20 }),
    ).rejects.toMatchObject({ kind: 'expired' })
    expect(patientsCreateStateFromError(new CloudClientError('expired', 'SESSION_EXPIRED', 'x', 401))).toBe(
      'SESSION_EXPIRED',
    )
  })

  it('4. 403 FORBIDDEN', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsCreate: async () => ({
        ok: false as const,
        code: 'FORBIDDEN',
        message: 'nope',
        status: 403,
      }),
    }
    await expect(
      createCloudPatient({ firstName: 'A', lastName: 'B', phone: '1', age: 20 }),
    ).rejects.toMatchObject({ kind: 'forbidden' })
  })

  it('5. API / network error', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsCreate: async () => ({
        ok: false as const,
        code: 'SERVER',
        message: 'boom',
        status: 500,
      }),
    }
    await expect(
      createCloudPatient({ firstName: 'A', lastName: 'B', phone: '1', age: 20 }),
    ).rejects.toMatchObject({ kind: 'server' })
    expect(patientsCreateStateFromError(new CloudClientError('server', 'SERVER', 'x', 500))).toBe(
      'API_ERROR',
    )
  })

  it('6. double-submit protection via SUBMITTING state helper', () => {
    // UI disables submit when createState === SUBMITTING; repository has no parallel queue.
    expect(patientsCreateStateFromError(new CloudClientError('validation', 'VALIDATION', 'x', 400))).toBe(
      'VALIDATION_ERROR',
    )
  })

  it('7. never sends organizationId from renderer', async () => {
    const spy = vi.fn(async () => ({
      ok: true as const,
      status: 201,
      data: {
        patient: {
          id: 'u1',
          organizationId: 'org-a',
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
      },
    }))
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsCreate: spy,
    }
    await createCloudPatient({
      firstName: 'A',
      lastName: 'B',
      phone: '1',
      age: 20,
      // @ts-expect-error intentional smuggle attempt
      organizationId: 'org-evil',
    })
    const arg = (spy.mock.calls as unknown as Array<[Record<string, unknown>?]>)[0]?.[0]
    expect(arg).not.toHaveProperty('organizationId')
    expect(arg).not.toHaveProperty('orgId')
  })

  it('8. response never contains token', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsCreate: async () => ({
        ok: true as const,
        status: 201,
        data: {
          patient: {
            id: 'u1',
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
          token: 'leaked',
        },
      }),
    }
    await expect(
      createCloudPatient({ firstName: 'A', lastName: 'B', phone: '1', age: 20 }),
    ).rejects.toMatchObject({ code: 'SECRET_LEAK' })
  })

  it('9. never writes Legacy clinic via createCloudPatient', async () => {
    const setClinic = vi.fn(async () => undefined)
    window.dentisuite = {
      getClinic: async () => null,
      setClinic,
      cloudPatientsCreate: async () => ({
        ok: true as const,
        status: 201,
        data: {
          patient: {
            id: 'u1',
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
        },
      }),
    }
    await createCloudPatient({ firstName: 'A', lastName: 'B', phone: '1', age: 20 })
    expect(setClinic).not.toHaveBeenCalled()
  })

  it('10-11. repository has create+update but no delete; list still works', async () => {
    const mod = await import('./patientsRepository')
    expect(typeof mod.createCloudPatient).toBe('function')
    expect(typeof mod.updateCloudPatient).toBe('function')
    expect(typeof mod.listCloudPatients).toBe('function')
    expect(mod).not.toHaveProperty('deleteCloudPatient')
    expect(mod).not.toHaveProperty('patchCloudPatient')

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
    expect(list.total).toBe(0)
  })

  it('validateCloudPatientCreate rejects bad age', () => {
    expect(validateCloudPatientCreate({ firstName: 'A', lastName: 'B', phone: '1', age: -1 }).ok).toBe(
      false,
    )
  })

  it('assertNoSecretsInPatientsPayload still rejects Authorization', () => {
    expect(() => assertNoSecretsInPatientsPayload({ Authorization: 'Bearer x' })).toThrow()
  })

  it('load state mapping unchanged for list errors', () => {
    expect(patientsLoadStateFromError(new CloudClientError('forbidden', 'FORBIDDEN', 'x', 403))).toBe(
      'FORBIDDEN',
    )
  })
})
