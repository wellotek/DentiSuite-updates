/**
 * @vitest-environment node
 * Phase 8A — Electron Main patients mapper / read-only guards.
 */
import { createRequire } from 'node:module'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const patientsPath = path.join(root, 'electron/cloud/patients.cjs')
const apiProxyPath = path.join(root, 'electron/cloud/api-proxy.cjs')

function loadPatientsModule() {
  delete require.cache[require.resolve(patientsPath)]
  return require(patientsPath)
}

function stubApiProxy(cloudFetch: unknown) {
  const resolved = require.resolve(apiProxyPath)
  delete require.cache[resolved]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(require.cache as any)[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: {
      cloudFetch,
      CloudApiError: class CloudApiError extends Error {
        code: string
        status: number
        constructor(code: string, message: string, status: number) {
          super(message)
          this.code = code
          this.status = status
        }
      },
    },
  }
}

describe('electron cloud patients (Phase 8A)', () => {
  beforeEach(() => {
    delete require.cache[require.resolve(patientsPath)]
  })

  it('normalizeListQuery clamps limit and page', () => {
    const { normalizeListQuery } = loadPatientsModule()
    expect(normalizeListQuery({ page: 0, limit: 999, search: '  ab  ' })).toEqual({
      search: 'ab',
      page: 1,
      limit: 100,
    })
  })

  it('mapCloudPatient keeps only real API fields and strips secrets', () => {
    const { mapCloudPatient } = loadPatientsModule()
    const mapped = mapCloudPatient({
      id: 'uuid-1',
      organizationId: 'org-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '0555',
      age: 36,
      address: 'x',
      antecedents: '',
      hasAllergies: false,
      dentistId: null,
      notes: null,
      token: 'secret-should-go',
      accessToken: 'nope',
    })
    expect(mapped?.id).toBe('uuid-1')
    expect(mapped?.firstName).toBe('Ada')
    expect(JSON.stringify(mapped)).not.toContain('secret')
    expect(JSON.stringify(mapped)).not.toMatch(/token/i)
  })

  it('assertPatientsReadOnly blocks POST/PATCH/DELETE on generic path', () => {
    const { assertPatientsReadOnly } = loadPatientsModule()
    expect(() => assertPatientsReadOnly('GET', '/patients')).not.toThrow()
    expect(() => assertPatientsReadOnly('POST', '/patients')).toThrow(/cloud:patients:create/i)
    expect(() => assertPatientsReadOnly('PATCH', '/patients/x')).toThrow(/cloud:patients:update/i)
    expect(() => assertPatientsReadOnly('DELETE', '/patients/x')).toThrow(/DELETE blocked/i)
  })

  it('normalizeCreateInput strips orgId and validates required fields', () => {
    const { normalizeCreateInput } = loadPatientsModule()
    const body = normalizeCreateInput({
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      phone: '0555',
      age: 36,
      organizationId: 'org-evil',
      orgId: 'org-evil',
      id: 'should-ignore',
      token: 'nope',
    })
    expect(body.firstName).toBe('Ada')
    expect(body).not.toHaveProperty('organizationId')
    expect(body).not.toHaveProperty('token')
    expect(() => normalizeCreateInput({ firstName: '', lastName: 'X', phone: '1', age: 1 })).toThrow(
      /firstName/i,
    )
  })

  it('createPatient success maps patient and ignores orgId hint', async () => {
    const cloudFetch = vi.fn(async () => ({
      status: 201,
      data: {
        patient: {
          id: 'uuid-new',
          organizationId: 'org-a',
          firstName: 'Test',
          lastName: 'Patient8B',
          phone: '0555',
          age: 30,
          address: '',
          antecedents: '',
          hasAllergies: false,
          dentistId: null,
          notes: null,
        },
      },
    }))
    stubApiProxy(cloudFetch)
    delete require.cache[require.resolve(patientsPath)]
    const { createPatient } = require(patientsPath)
    const created = await createPatient(
      {
        firstName: 'Test',
        lastName: 'Patient8B',
        phone: '0555',
        age: 30,
        organizationId: 'org-evil',
      },
      { organizationIdHint: 'org-evil' },
    )
    expect(created.patient.id).toBe('uuid-new')
    expect(created.patient.organizationId).toBe('org-a')
    expect(cloudFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/patients',
        auth: true,
      }),
    )
    const call = (cloudFetch.mock.calls as unknown as Array<[Record<string, unknown>?]>)[0]?.[0]
    expect(call?.body).not.toHaveProperty('organizationId')
    expect(JSON.stringify(created)).not.toMatch(/token/i)
  })

  it('listPatients success maps items and ignores orgId hint', async () => {
    const cloudFetch = vi.fn(async () => ({
      status: 200,
      data: {
        items: [
          {
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
        ],
        page: 1,
        limit: 50,
        total: 1,
        totalPages: 1,
      },
    }))
    stubApiProxy(cloudFetch)
    delete require.cache[require.resolve(patientsPath)]
    const { listPatients } = require(patientsPath)
    const list = await listPatients(
      { search: '', page: 1, limit: 50 },
      { organizationIdHint: 'org-evil' },
    )
    expect(list.total).toBe(1)
    expect(list.items[0].organizationId).toBe('org-a')
    expect(cloudFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/patients',
        auth: true,
      }),
    )
    const calls = cloudFetch.mock.calls as unknown as Array<[Record<string, unknown>?]>
    const call = calls[0]?.[0]
    expect(call?.query).not.toHaveProperty('organizationId')
    expect(JSON.stringify(list)).not.toMatch(/token/i)
  })

  it('listPatients empty', async () => {
    const cloudFetch = vi.fn(async () => ({
      status: 200,
      data: { items: [], page: 1, limit: 50, total: 0, totalPages: 0 },
    }))
    stubApiProxy(cloudFetch)
    delete require.cache[require.resolve(patientsPath)]
    const { listPatients } = require(patientsPath)
    const list = await listPatients()
    expect(list.items).toEqual([])
    expect(list.total).toBe(0)
  })

  it('updatePatient PATCH success strips orgId and uses UUID path', async () => {
    const cloudFetch = vi.fn(async () => ({
      status: 200,
      data: {
        patient: {
          id: 'f0778efe-2277-4f75-ba3a-c0f8d4c5c026',
          organizationId: 'org-a',
          firstName: 'TEST',
          lastName: 'PATIENT8B',
          phone: '0555988C99',
          age: 33,
          address: '',
          antecedents: '',
          hasAllergies: false,
          dentistId: null,
          notes: 'updated',
        },
      },
    }))
    stubApiProxy(cloudFetch)
    delete require.cache[require.resolve(patientsPath)]
    const { updatePatient } = require(patientsPath)
    const updated = await updatePatient(
      'f0778efe-2277-4f75-ba3a-c0f8d4c5c026',
      { phone: '0555988C99', organizationId: 'org-evil' },
      { organizationIdHint: 'org-evil' },
    )
    expect(updated.patient.phone).toBe('0555988C99')
    expect(cloudFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PATCH',
        path: '/patients/f0778efe-2277-4f75-ba3a-c0f8d4c5c026',
        auth: true,
      }),
    )
    const call = (cloudFetch.mock.calls as unknown as Array<[Record<string, unknown>?]>)[0]?.[0]
    expect(call?.body).not.toHaveProperty('organizationId')
  })

  it('normalizeUpdateInput requires at least one field', () => {
    const { normalizeUpdateInput } = loadPatientsModule()
    expect(() => normalizeUpdateInput({})).toThrow(/at least one/i)
  })
})

/**
 * Tenant isolation for GET /patients is covered by apps/api/tests/patients.test.ts
 * ("Admin A CRUD works; cross-tenant patient is 404").
 * Run: npm run api:test -- patients.test.ts
 * Do not invent production org fixtures solely for Electron.
 */
