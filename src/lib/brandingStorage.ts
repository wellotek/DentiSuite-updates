/** Persist clinic logo + admin photo outside Cloud-blocked clinic JSON. */

export type BrandingAssets = {
  logo: string
  adminPhoto: string
}

const LOCAL_KEY = 'dentisuite.branding'

function normalize(raw: unknown): BrandingAssets {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    logo: typeof obj.logo === 'string' ? obj.logo : '',
    adminPhoto: typeof obj.adminPhoto === 'string' ? obj.adminPhoto : '',
  }
}

export async function loadBrandingAssets(): Promise<BrandingAssets> {
  const api = typeof window !== 'undefined' ? window.dentisuite : undefined
  if (api?.getBranding) {
    try {
      return normalize(await api.getBranding())
    } catch {
      /* fall through */
    }
  }
  try {
    const stored = localStorage.getItem(LOCAL_KEY)
    if (stored) return normalize(JSON.parse(stored))
  } catch {
    /* ignore */
  }
  return { logo: '', adminPhoto: '' }
}

export async function saveBrandingAssets(partial: Partial<BrandingAssets>): Promise<void> {
  const current = await loadBrandingAssets()
  const next: BrandingAssets = {
    logo: partial.logo !== undefined ? partial.logo : current.logo,
    adminPhoto: partial.adminPhoto !== undefined ? partial.adminPhoto : current.adminPhoto,
  }
  const api = typeof window !== 'undefined' ? window.dentisuite : undefined
  if (api?.setBranding) {
    await api.setBranding(next)
    // Keep a browser fallback in sync for tests / non-Electron previews.
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
    } catch {
      /* ignore quota */
    }
    return
  }
  localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
}

/** Merge branding files into clinic settings (branding store wins when non-empty). */
export function applyBrandingToSettings<T extends { logo?: string; adminPhoto?: string }>(
  settings: T,
  branding: BrandingAssets,
): T {
  return {
    ...settings,
    logo: branding.logo || settings.logo || '',
    adminPhoto: branding.adminPhoto || settings.adminPhoto || '',
  }
}
