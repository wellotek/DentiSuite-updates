const assert = require('assert')
const { signState, verifyState, graceValid, offlineUntilFrom, approachingDeadline } = require('../electron/license/integrity.cjs')
const { mapHttpError, classify, MSG } = require('../electron/license/errors.cjs')
const { OFFLINE_GRACE_PERIOD_DAYS } = require('../electron/license/config.cjs')

const sample = {
  license_id: 'DS-TEST-TEST-TEST',
  installation_id: '11111111-2222-4333-8444-555555555555',
  status: 'active',
  lastValidatedAt: '2026-08-21T00:00:00.000Z',
  offlineUntil: '2026-08-28T00:00:00.000Z',
  product: 'DentiSuite',
  version: 'V8',
}

const signed = signState(sample)
assert.ok(verifyState(signed), 'signed state must verify')

const tampered = { ...signed, offlineUntil: '2099-01-01T00:00:00.000Z' }
assert.strictEqual(verifyState(tampered), null, 'tampered offlineUntil must fail')

const tamperedStatus = { ...signed, status: 'active', integrity: signed.integrity }
tamperedStatus.license_id = 'DS-HACK-HACK-HACK'
assert.strictEqual(verifyState(tamperedStatus), null, 'tampered license_id must fail')

assert.strictEqual(OFFLINE_GRACE_PERIOD_DAYS, 7)
const now = Date.parse('2026-08-25T00:00:00.000Z')
assert.strictEqual(graceValid('2026-08-28T00:00:00.000Z', now), true)
assert.strictEqual(graceValid('2026-08-24T00:00:00.000Z', now), false)
const until = offlineUntilFrom(Date.parse('2026-08-21T00:00:00.000Z'), 7)
assert.ok(until.startsWith('2026-08-28'))
assert.strictEqual(approachingDeadline('2026-08-22T00:00:00.000Z', 48, Date.parse('2026-08-21T00:00:00.000Z')), true)

assert.strictEqual(mapHttpError(401, { error: 'invalid' }, MSG.invalid), MSG.invalid)
assert.strictEqual(mapHttpError(409, { error: 'already activated' }, MSG.invalid), MSG.already)
assert.strictEqual(mapHttpError(403, { error: 'revoked' }, MSG.invalid), MSG.revoked)
assert.strictEqual(
  mapHttpError(403, { error: 'Maximum activation limit reached' }, MSG.invalid),
  MSG.limit,
)
assert.strictEqual(mapHttpError(403, { error: 'license expired' }, MSG.invalid), MSG.expired)
assert.strictEqual(mapHttpError(403, { error: 'wrong product' }, MSG.invalid), MSG.product)
assert.strictEqual(mapHttpError(404, { error: 'not found' }, MSG.invalid), MSG.notFound)
assert.strictEqual(mapHttpError(403, {}, MSG.invalid), MSG.invalid)
assert.strictEqual(mapHttpError(503, {}, MSG.invalid), MSG.network)
assert.strictEqual(mapHttpError(429, {}, MSG.invalid), MSG.rate)
assert.strictEqual(classify({ error: 'invalid_code' }, 400), 'invalid')
assert.strictEqual(classify({ error: 'Maximum activation limit reached' }, 403), 'limit')
assert.strictEqual(classify({ error: 'expired' }, 403), 'expired')
assert.strictEqual(classify({ error: 'product mismatch' }, 403), 'product')

console.log('license logic tests ok')
