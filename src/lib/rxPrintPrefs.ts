import type { ClinicSettings, PrescriptionPrintLayout } from '../types'

const LOCAL_KEY = 'dentisuite.rxPrintPrefs'

export const DEFAULT_RX_FOOTER_AR = 'نتمنى لكم الشفاء العاجل'

export type RxPrintPrefs = {
  prescriptionPrintLayout?: PrescriptionPrintLayout
  practitionerArabicName?: string
  orderNumber?: string
  prescriptionFooterAr?: string
}

function normalize(raw: unknown): RxPrintPrefs {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const layout = obj.prescriptionPrintLayout
  return {
    prescriptionPrintLayout: layout === 'elegante' || layout === 'classic' ? layout : undefined,
    practitionerArabicName: typeof obj.practitionerArabicName === 'string' ? obj.practitionerArabicName : undefined,
    orderNumber: typeof obj.orderNumber === 'string' ? obj.orderNumber : undefined,
    prescriptionFooterAr: typeof obj.prescriptionFooterAr === 'string' ? obj.prescriptionFooterAr : undefined,
  }
}

export function loadRxPrintPrefs(): RxPrintPrefs {
  try {
    const stored = localStorage.getItem(LOCAL_KEY)
    if (stored) return normalize(JSON.parse(stored))
  } catch {
    /* ignore */
  }
  return {}
}

export function saveRxPrintPrefs(partial: RxPrintPrefs): RxPrintPrefs {
  const next = { ...loadRxPrintPrefs(), ...partial }
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
  return next
}

export function withRxPrintPrefs(settings: ClinicSettings): ClinicSettings {
  const prefs = loadRxPrintPrefs()
  return {
    ...settings,
    prescriptionPrintLayout: settings.prescriptionPrintLayout || prefs.prescriptionPrintLayout,
    practitionerArabicName: settings.practitionerArabicName || prefs.practitionerArabicName,
    orderNumber: settings.orderNumber || prefs.orderNumber,
    prescriptionFooterAr: settings.prescriptionFooterAr || prefs.prescriptionFooterAr,
  }
}

export function resolvePrescriptionPrintLayout(
  rx: { printLayout?: PrescriptionPrintLayout },
  settings: Pick<ClinicSettings, 'prescriptionPrintLayout'>,
): PrescriptionPrintLayout {
  return rx.printLayout || settings.prescriptionPrintLayout || 'classic'
}
