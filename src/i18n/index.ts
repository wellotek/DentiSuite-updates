import type { ClinicSettings, DateFormat, Locale, TimeFormat } from '../types'
import { translate, type MsgKey } from './messages'
import { useAppStore } from '../store/useAppStore'

export function useT() {
  const locale = useAppStore((s) => s.clinic.settings?.locale ?? 'fr')
  return (key: MsgKey) => translate(locale, key)
}

export function useLocale(): Locale {
  return useAppStore((s) => s.clinic.settings?.locale ?? 'fr')
}

export function localeTag(locale: Locale) {
  return locale === 'ar' ? 'ar-DZ' : 'fr-DZ'
}

export function formatClinicDate(date: Date, settings: ClinicSettings) {
  const loc = localeTag(settings.locale)
  const opts: Intl.DateTimeFormatOptions = { timeZone: settings.timezone }
  if (settings.dateFormat === 'iso') {
    const parts = new Intl.DateTimeFormat('en-CA', {
      ...opts,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
    return parts
  }
  if (settings.dateFormat === 'short') {
    return date.toLocaleDateString(loc, { ...opts, day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  return date.toLocaleDateString(loc, {
    ...opts,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatClinicTime(date: Date, settings: ClinicSettings) {
  return date.toLocaleTimeString(localeTag(settings.locale), {
    timeZone: settings.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: settings.timeFormat === '12h',
  })
}

export function formatHourLabel(hour: number, timeFormat: TimeFormat) {
  if (timeFormat === '12h') {
    const suffix = hour >= 12 ? 'PM' : 'AM'
    const h = hour % 12 || 12
    return `${h}:00 ${suffix}`
  }
  return `${String(hour).padStart(2, '0')}:00`
}

export const DATE_FORMATS: DateFormat[] = ['long', 'short', 'iso']
export const TIME_FORMATS: TimeFormat[] = ['24h', '12h']

export function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}
