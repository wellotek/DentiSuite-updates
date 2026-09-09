import type { LicenseStatus } from '../types'

const inactive = (): LicenseStatus => ({
  activated: false,
  screen: 'activate',
  message: null,
  product: 'DentiSuite',
  version: 'V8',
  licenseId: null,
})

export async function loadLicenseStatus(): Promise<LicenseStatus> {
  if (typeof window === 'undefined' || !window.dentisuite?.getLicenseStatus) {
    // Dev browser preview only — production Electron always has the bridge.
    if (import.meta.env.PROD) return inactive()
    return { ...inactive(), activated: true, screen: 'ok' }
  }
  try {
    return await window.dentisuite.getLicenseStatus()
  } catch {
    return inactive()
  }
}

export async function activateLicense(licenseId: string, activationCode: string) {
  if (!window.dentisuite?.activateLicense) {
    return { ok: false as const, error: 'Activation disponible uniquement dans l’application DentiSuite.' }
  }
  return window.dentisuite.activateLicense(licenseId, activationCode)
}

export async function retryLicense(): Promise<LicenseStatus> {
  if (!window.dentisuite?.retryLicense) return inactive()
  return window.dentisuite.retryLicense()
}
