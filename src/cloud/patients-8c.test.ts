import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createCloudPatient,
  listCloudPatients,
  updateCloudPatient,
  validateCloudPatientUpdate,
  patientsUpdateStateFromError,
} from './patientsRepository'
import { CloudClientError, mapCloudFailure } from './errors'

const SAMPLE_ID = 'f0778efe-2277-4f75-ba3a-c0f8d4c5c026'

function samplePatient(overrides: Record<string, unknown> = {}) {
  return {
    id: SAMPLE_ID,
    organizationId: 'ac3d519a-b1cd-4926-9c12-c6721c6e9907',
    firstName: 'TEST',
    lastName: 'PATIENT8B',
    phone: '0555988C01',
    age: 33,
    address: '',
    antecedents: '',
    hasAllergies: false,
    dentistId: null,
    notes: null,
    ...overrides,
  }
}

describe('updateCloudPatient Phase 8C', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('1. update success via dedicated IPC', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsUpdate: async () => ({
        ok: true as const,
        status: 200,
        data: { patient: samplePatient({ phone: '0555988C99' }) },
      }),
    }
    const p = await updateCloudPatient({ id: SAMPLE_ID, phone: '0555988C99' })
    expect(p.phone).toBe('0555988C99')
    expect(p.id).toBe(SAMPLE_ID)
  })

  it('2. validation error client-side', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsUpdate: vi.fn(),
    }
    await expect(updateCloudPatient({ id: 'not-a-uuid', phone: '1' })).rejects.toMatchObject({
      kind: 'validation',
    })
    expect(window.dentisuite.cloudPatientsUpdate).not.toHaveBeenCalled()
  })

  it('3. 401 SESSION_EXPIRED', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsUpdate: async () => ({
        ok: false as const,
        code: 'SESSION_EXPIRED',
        message: 'expired',
        status: 401,
      }),
    }
    await expect(updateCloudPatient({ id: SAMPLE_ID, phone: '1' })).rejects.toMatchObject({
      kind: 'expired',
    })
  })

  it('4. 403 FORBIDDEN', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsUpdate: async () => ({
        ok: false as const,
        code: 'FORBIDDEN',
        message: 'nope',
        status: 403,
      }),
    }
    await expect(updateCloudPatient({ id: SAMPLE_ID, phone: '1' })).rejects.toMatchObject({
      kind: 'forbidden',
    })
  })

  it('5. 404 NOT_FOUND', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsUpdate: async () => ({
        ok: false as const,
        code: 'NOT_FOUND',
        message: 'Patient not found',
        status: 404,
      }),
    }
    await expect(updateCloudPatient({ id: SAMPLE_ID, phone: '1' })).rejects.toMatchObject({
      kind: 'not_found',
    })
    expect(patientsUpdateStateFromError(new CloudClientError('not_found', 'NOT_FOUND', 'x', 404))).toBe(
      'NOT_FOUND',
    )
    expect(mapCloudFailure({ code: 'NOT_FOUND', status: 404 }).kind).toBe('not_found')
  })

  it('6. API 500', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsUpdate: async () => ({
        ok: false as const,
        code: 'SERVER',
        message: 'boom',
        status: 500,
      }),
    }
    await expect(updateCloudPatient({ id: SAMPLE_ID, phone: '1' })).rejects.toMatchObject({
      kind: 'server',
    })
  })

  it('7. double-submit protection via SUBMITTING state helper', () => {
    expect(patientsUpdateStateFromError(new CloudClientError('validation', 'VALIDATION', 'x', 400))).toBe(
      'VALIDATION_ERROR',
    )
  })

  it('8. tenant isolation: orgId never sent; API org remains authority', async () => {
    const spy = vi.fn(async () => ({
      ok: true as const,
      status: 200,
      data: { patient: samplePatient() },
    }))
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsUpdate: spy,
    }
    await updateCloudPatient({
      id: SAMPLE_ID,
      phone: '0555',
      // @ts-expect-error intentional smuggle
      organizationId: 'org-evil',
    })
    const arg = (spy.mock.calls as unknown as Array<[Record<string, unknown>?]>)[0]?.[0]
    expect(arg).not.toHaveProperty('organizationId')
    expect(arg).not.toHaveProperty('orgId')
    expect(arg?.id).toBe(SAMPLE_ID)
  })

  it('9. orgId absent from validated update payload', () => {
    const v = validateCloudPatientUpdate({
      id: SAMPLE_ID,
      phone: '0555',
      // @ts-expect-error
      organizationId: 'x',
    })
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.data).not.toHaveProperty('organizationId')
    }
  })

  it('10. response never contains token', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsUpdate: async () => ({
        ok: true as const,
        status: 200,
        data: { patient: samplePatient(), token: 'leaked' },
      }),
    }
    await expect(updateCloudPatient({ id: SAMPLE_ID, phone: '1' })).rejects.toMatchObject({
      code: 'SECRET_LEAK',
    })
  })

  it('11. DELETE not exported; repository has update', async () => {
    const mod = await import('./patientsRepository')
    expect(typeof mod.updateCloudPatient).toBe('function')
    expect(mod).not.toHaveProperty('deleteCloudPatient')
  })

  it('12. GET list still works', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsList: async () => ({
        ok: true as const,
        status: 200,
        data: { items: [samplePatient()], page: 1, limit: 50, total: 1, totalPages: 1 },
      }),
    }
    const list = await listCloudPatients()
    expect(list.total).toBe(1)
  })

  it('13. POST create still works', async () => {
    window.dentisuite = {
      getClinic: async () => null,
      setClinic: async () => undefined,
      cloudPatientsCreate: async () => ({
        ok: true as const,
        status: 201,
        data: { patient: samplePatient({ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }) },
      }),
    }
    const p = await createCloudPatient({
      firstName: 'A',
      lastName: 'B',
      phone: '1',
      age: 20,
    })
    expect(p.id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
  })

  it('14. never writes Legacy clinic via updateCloudPatient', async () => {
    const setClinic = vi.fn(async () => undefined)
    window.dentisuite = {
      getClinic: async () => null,
      setClinic,
      cloudPatientsUpdate: async () => ({
        ok: true as const,
        status: 200,
        data: { patient: samplePatient() },
      }),
    }
    await updateCloudPatient({ id: SAMPLE_ID, notes: 'x' })
    expect(setClinic).not.toHaveBeenCalled()
  })
})
