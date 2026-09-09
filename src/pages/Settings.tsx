import { useEffect, useState } from 'react'
import { Globe, ImageIcon, Monitor } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { seedClinic } from '../data/seed'
import {
  DATE_FORMATS,
  TIME_FORMATS,
  formatClinicDate,
  formatClinicTime,
  readImageAsDataUrl,
  useT,
} from '../i18n'
import type { ClinicSettings, DateFormat, Locale, TimeFormat } from '../types'

export function Settings() {
  const t = useT()
  const settings = useAppStore((s) => s.clinic.settings) ?? seedClinic.settings
  const updateSettings = useAppStore((s) => s.updateSettings)
  const [now, setNow] = useState(() => new Date())
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  function patch(partial: Partial<ClinicSettings>) {
    updateSettings(partial)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }

  async function onImage(key: 'logo' | 'adminPhoto', file?: File) {
    if (!file) return
    const data = await readImageAsDataUrl(file)
    patch({ [key]: data })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('settings.subtitle')}</p>
      </div>

      {saved && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          {t('settings.saved')}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-clinic-800">{t('settings.identity')}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label={t('settings.name')} value={settings.name} onChange={(name) => patch({ name })} />
          <Field label={t('patients.phone')} value={settings.phone} onChange={(phone) => patch({ phone })} />
          <div className="col-span-2">
            <Field label={t('patients.address')} value={settings.address} onChange={(address) => patch({ address })} />
          </div>
          <div className="col-span-2">
            <Field label={t('settings.email')} value={settings.email} onChange={(email) => patch({ email })} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2 text-clinic-800">
          <ImageIcon className="h-4 w-4" />
          <h2 className="text-sm font-semibold">{t('settings.branding')}</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ImagePicker
            label={t('settings.logo')}
            value={settings.logo}
            onFile={(f) => void onImage('logo', f)}
            onClear={() => patch({ logo: '' })}
            upload={t('settings.upload')}
            remove={t('settings.remove')}
          />
          <ImagePicker
            label={t('settings.adminPhoto')}
            value={settings.adminPhoto}
            onFile={(f) => void onImage('adminPhoto', f)}
            onClear={() => patch({ adminPhoto: '' })}
            upload={t('settings.upload')}
            remove={t('settings.remove')}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2 text-clinic-800">
          <Monitor className="h-4 w-4" />
          <h2 className="text-sm font-semibold">{t('settings.system')}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-600">
            {t('settings.dateFormat')}
            <select
              value={settings.dateFormat}
              onChange={(e) => patch({ dateFormat: e.target.value as DateFormat })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            >
              {DATE_FORMATS.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {fmt === 'long' ? t('settings.date.long') : fmt === 'short' ? t('settings.date.short') : t('settings.date.iso')}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t('settings.timeFormat')}
            <select
              value={settings.timeFormat}
              onChange={(e) => patch({ timeFormat: e.target.value as TimeFormat })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            >
              {TIME_FORMATS.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {fmt === '24h' ? t('settings.time.24') : t('settings.time.12')}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            {t('settings.timezone')}
            <select
              value={settings.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            >
              <option value="Africa/Algiers">Africa/Algiers (UTC+1)</option>
              <option value="UTC">UTC</option>
              <option value="Europe/Paris">Europe/Paris</option>
            </select>
          </label>
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="text-xs uppercase tracking-wide text-slate-400">{t('settings.preview')}</span>
          <br />
          {formatClinicDate(now, settings)} · {formatClinicTime(now, settings)}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2 text-clinic-800">
          <Globe className="h-4 w-4" />
          <h2 className="text-sm font-semibold">{t('settings.language')}</h2>
        </div>
        <p className="mb-3 text-sm text-slate-500">{t('settings.languageHint')}</p>
        <div className="flex gap-2">
          {(['fr', 'ar'] as Locale[]).map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => patch({ locale })}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                settings.locale === locale
                  ? 'bg-clinic-700 text-white'
                  : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {locale === 'fr' ? t('settings.fr') : t('settings.ar')}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
      />
    </label>
  )
}

function ImagePicker({
  label,
  value,
  onFile,
  onClear,
  upload,
  remove,
}: {
  label: string
  value: string
  onFile: (file?: File) => void
  onClear: () => void
  upload: string
  remove: string
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        <div>
          <label className="inline-flex cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
            {upload}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {value && (
            <button type="button" onClick={onClear} className="ms-2 text-xs text-slate-500 hover:text-red-600">
              {remove}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
