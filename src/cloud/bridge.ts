import { CloudClientError, mapCloudFailure } from './errors'
import type {
  CloudAppConfig,
  CloudIpcError,
  CloudRequestInput,
  CloudSessionContext,
} from './types'

function bridge() {
  return typeof window !== 'undefined' ? window.dentisuite : undefined
}

export function isCloudBridgeAvailable(): boolean {
  return Boolean(bridge()?.cloudConfig && bridge()?.cloudRequest)
}

export async function readCloudConfig(): Promise<CloudAppConfig> {
  const api = bridge()
  if (!api?.cloudConfig) {
    return {
      appMode: 'LEGACY',
      probeEnabled: false,
      apiBaseUrl: '',
      cloudMode: false,
    }
  }
  const cfg = await api.cloudConfig()
  const appMode: 'CLOUD' | 'LEGACY' =
    cfg.appMode === 'CLOUD' || cfg.appMode === 'LEGACY'
      ? cfg.appMode
      : cfg.cloudMode || cfg.probeEnabled
        ? 'CLOUD'
        : 'LEGACY'
  const cloudMode = appMode === 'CLOUD'
  return {
    appMode,
    probeEnabled: cloudMode,
    apiBaseUrl: String(cfg.apiBaseUrl || ''),
    cloudMode,
  }
}

/**
 * Vite-only hint for browser preview of Cloud UI.
 * Electron authority is DENTISUITE_APP_MODE / packaged default.
 */
export function viteCloudModeHint(): boolean {
  return (
    import.meta.env.VITE_APP_MODE === 'CLOUD' ||
    import.meta.env.VITE_CLOUD_PROBE === 'true' ||
    import.meta.env.VITE_CLOUD_PROBE === '1'
  )
}

/** True when Cloud is the active product mode. */
export async function isCloudModeActive(): Promise<boolean> {
  if (isCloudBridgeAvailable()) {
    const cfg = await readCloudConfig()
    return cfg.cloudMode || cfg.appMode === 'CLOUD'
  }
  return viteCloudModeHint()
}

/** @deprecated use isCloudModeActive */
export async function isCloudProbeActive(): Promise<boolean> {
  return isCloudModeActive()
}

type OkRequest = { ok: true; status: number; data: unknown }
type FailRequest = CloudIpcError

export async function cloudRequest<T = unknown>(input: CloudRequestInput): Promise<T> {
  const api = bridge()
  if (!api?.cloudRequest) {
    throw new CloudClientError('disabled', 'NO_BRIDGE', 'Cloud IPC bridge unavailable', 0)
  }
  const result = (await api.cloudRequest(input)) as OkRequest | FailRequest
  if (!result || result.ok !== true) {
    throw mapCloudFailure(result || { code: 'UNKNOWN', message: 'Cloud request failed' })
  }
  return result.data as T
}

export async function cloudLogin(
  email: string,
  password: string,
): Promise<{ user: unknown; context: CloudSessionContext }> {
  const api = bridge()
  if (!api?.cloudLogin) {
    throw new CloudClientError('disabled', 'NO_BRIDGE', 'Cloud IPC bridge unavailable', 0)
  }
  const result = await api.cloudLogin(email, password)
  if (!result || result.ok !== true) {
    throw mapCloudFailure(result || { code: 'UNKNOWN', message: 'Login failed' })
  }
  return {
    user: result.user,
    context: (result.context || { status: 'authenticated' }) as CloudSessionContext,
  }
}

export type BootstrapOrganizationPayload = {
  licenseKey: string
  organizationName: string
  adminEmail: string
  adminPassword: string
  adminName: string
  phone?: string
  city?: string
}

export async function cloudBootstrapOrganization(
  payload: BootstrapOrganizationPayload,
): Promise<{ user: unknown; context: CloudSessionContext }> {
  const api = bridge()
  if (!api?.cloudBootstrapOrganization) {
    throw new CloudClientError('disabled', 'NO_BRIDGE', 'Cloud IPC bridge unavailable', 0)
  }
  const result = await api.cloudBootstrapOrganization(payload)
  if (!result || result.ok !== true) {
    throw mapCloudFailure(result || { code: 'UNKNOWN', message: 'Bootstrap failed' })
  }
  return {
    user: result.user,
    context: (result.context || { status: 'authenticated' }) as CloudSessionContext,
  }
}

export async function cloudOnboardingStatus(licenseKey: string): Promise<{
  licenseKey: string
  registered: boolean
  organizationName: string | null
}> {
  const api = bridge()
  if (!api?.cloudOnboardingStatus) {
    throw new CloudClientError('disabled', 'NO_BRIDGE', 'Cloud IPC bridge unavailable', 0)
  }
  const result = await api.cloudOnboardingStatus(licenseKey)
  if (!result || result.ok !== true) {
    throw mapCloudFailure(result || { code: 'UNKNOWN', message: 'Onboarding status failed' })
  }
  return {
    licenseKey: result.licenseKey,
    registered: result.registered,
    organizationName: result.organizationName,
  }
}

export async function cloudLogout(): Promise<void> {
  const api = bridge()
  if (!api?.cloudLogout) return
  const result = await api.cloudLogout()
  if (result && result.ok === false) {
    throw mapCloudFailure(result)
  }
}

export async function cloudRestore(): Promise<CloudSessionContext> {
  const api = bridge()
  if (!api?.cloudRestore) {
    throw new CloudClientError('disabled', 'NO_BRIDGE', 'Cloud IPC bridge unavailable', 0)
  }
  const result = await api.cloudRestore()
  if (!result || result.ok !== true) {
    throw mapCloudFailure(result || { code: 'UNKNOWN', message: 'Restore failed' })
  }
  return (result.context || { status: 'none' }) as CloudSessionContext
}

export async function cloudHasSession(): Promise<boolean> {
  const api = bridge()
  if (!api?.cloudHasSession) return false
  const result = await api.cloudHasSession()
  return Boolean(result?.hasSession)
}
