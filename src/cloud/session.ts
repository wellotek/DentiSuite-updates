import {
  cloudBootstrapOrganization,
  cloudLogin,
  cloudLogout,
  cloudOnboardingStatus,
  cloudRestore,
  isCloudModeActive,
  type BootstrapOrganizationPayload,
} from './bridge'
import type { CloudSessionContext } from './types'

export async function restoreCloudSession(): Promise<CloudSessionContext> {
  if (!(await isCloudModeActive())) {
    return { status: 'none', state: 'UNAUTHENTICATED', authenticated: false }
  }
  return cloudRestore()
}

export async function loginCloud(email: string, password: string): Promise<CloudSessionContext> {
  const result = await cloudLogin(email, password)
  if (
    result.context?.authenticated ||
    result.context?.status === 'authenticated' ||
    result.context?.state === 'AUTHENTICATED'
  ) {
    return result.context
  }
  if (result.context) return result.context
  return cloudRestore()
}

export async function bootstrapCloudOrganization(
  payload: BootstrapOrganizationPayload,
): Promise<CloudSessionContext> {
  const result = await cloudBootstrapOrganization(payload)
  if (
    result.context?.authenticated ||
    result.context?.status === 'authenticated' ||
    result.context?.state === 'AUTHENTICATED'
  ) {
    return result.context
  }
  if (result.context) return result.context
  return cloudRestore()
}

export async function fetchCloudOnboardingStatus(licenseKey: string) {
  return cloudOnboardingStatus(licenseKey)
}

export async function logoutCloud(): Promise<void> {
  await cloudLogout()
}
