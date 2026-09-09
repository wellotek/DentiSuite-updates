const LICENSE_ORIGIN = 'https://license.dentisuite.xyz'
const ACTIVATE_URL = `${LICENSE_ORIGIN}/api/public/license/activate`
const VALIDATE_URL = `${LICENSE_ORIGIN}/api/public/license/validate`
const REFRESH_URL = `${LICENSE_ORIGIN}/api/public/license/refresh`

const PRODUCT = 'DentiSuite'
const VERSION = 'V8'
const OFFLINE_GRACE_PERIOD_DAYS = 7
const FETCH_MS = 15_000
const REFRESH_WITHIN_HOURS = 48

module.exports = {
  LICENSE_ORIGIN,
  ACTIVATE_URL,
  VALIDATE_URL,
  REFRESH_URL,
  PRODUCT,
  VERSION,
  OFFLINE_GRACE_PERIOD_DAYS,
  FETCH_MS,
  REFRESH_WITHIN_HOURS,
}
