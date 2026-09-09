/**
 * @vitest-environment node
 */
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const allowPath = path.join(root, 'electron/cloud/allowlist.cjs')

describe('cloud API allowlist', () => {
  it('allows business CRUD paths and blocks unknown', () => {
    delete require.cache[require.resolve(allowPath)]
    const { assertCloudPathAllowed, scrubCloudBody } = require(allowPath)

    expect(() => assertCloudPathAllowed('GET', '/appointments')).not.toThrow()
    expect(() => assertCloudPathAllowed('POST', '/dentists')).not.toThrow()
    expect(() => assertCloudPathAllowed('PATCH', '/stock/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).not.toThrow()
    expect(() => assertCloudPathAllowed('DELETE', '/patients/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).not.toThrow()
    expect(() => assertCloudPathAllowed('GET', '/team')).not.toThrow()
    expect(() => assertCloudPathAllowed('POST', '/team')).not.toThrow()
    expect(() => assertCloudPathAllowed('PATCH', '/team/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).not.toThrow()
    expect(() => assertCloudPathAllowed('POST', '/auth/bootstrap-organization')).not.toThrow()
    expect(() => assertCloudPathAllowed('GET', '/auth/onboarding-status')).not.toThrow()
    expect(() => assertCloudPathAllowed('POST', '/evil')).toThrow(/allowlisted/i)
    expect(() => assertCloudPathAllowed('GET', '/admin')).toThrow(/allowlisted/i)

    const scrubbed = scrubCloudBody({
      firstName: 'A',
      organizationId: 'evil',
      token: 'secret',
    })
    expect(scrubbed).toEqual({ firstName: 'A' })
  })
})
