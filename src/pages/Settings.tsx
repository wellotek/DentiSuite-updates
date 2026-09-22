import { useEffect, useMemo, useState } from 'react'
import { Globe, ImageIcon, Monitor, Pill } from 'lucide-react'
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
import type { ClinicSettings, DateFormat, Locale, MedicationItem, TimeFormat } from '../types'
import { UpdateNotifier } from '../components/UpdateNotifier'
import { MEDICATION_SOURCE_LABEL, MEDICATION_SOURCE_VERSION, CUSTOM_MEDICATION_SOURCE } from '../data/medications'
import { mergeMedicationCatalog, MEDICATION_IMPORT_FIELDS, searchMedications } from '../lib/medications'
import { toISODate } from '../lib/agenda'
import { isCloudClinicMode } from '../cloud/cloudClinicMode'
import {
  buildClinicBackup,
  clinicFromBackup,
  downloadJsonBackup,
  readBackupFile,
  validateClinicBackup,
} from '../lib/clinicBackup'
import { saveClinic } from '../lib/storage'

const APP_VERSION = '3.5.1'

export function Settings() {
  const t = useT()
  const settings = useAppStore((s) => s.clinic.settings) ?? seedClinic.settings
  const medicationCatalog = useAppStore((s) => s.clinic.medicationCatalog)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const upsertMedication = useAppStore((s) => s.upsertMedication)
  const setMedicationStatus = useAppStore((s) => s.setMedicationStatus)
  const [now, setNow] = useState(() => new Date())
  const [saved, setSaved] = useState(false)
  const [medQuery, setMedQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState({
    name: '',
    dci: '',
    dosage: '',
    form: '',
    route: '',
  })

  const catalog = useMemo(() => mergeMedicationCatalog(medicationCatalog), [medicationCatalog])
  const medResults = useMemo(() => {
    const q = medQuery.trim()
    if (!q) return catalog.slice(0, 40)
    return searchMedications(catalog, q, 40)
  }, [catalog, medQuery])

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

  function saveMed() {
    if (!draft.name.trim()) return
    const item: MedicationItem = {
      id: `med-custom-${Date.now()}`,
      name: draft.name.trim(),
      dci: draft.dci.trim() || draft.name.trim(),
      dosage: draft.dosage.trim(),
      form: draft.form.trim(),
      route: draft.route.trim() || undefined,
      family: 'autre',
      market: 'cabinet',
      status: 'active',
      origin: 'custom',
      source: CUSTOM_MEDICATION_SOURCE,
      lastVerifiedAt: toISODate(new Date()),
    }
    upsertMedication(item)
    setDraft({ name: '', dci: '', dosage: '', form: '', route: '' })
    setShowAdd(false)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
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

      <BackupRestoreSection />

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
        <div className="mb-2 flex items-center gap-2 text-clinic-800">
          <Pill className="h-4 w-4" />
          <h2 className="text-sm font-semibold">{t('settings.medications')}</h2>
        </div>
        <p className="mb-3 text-sm text-slate-500">{t('settings.medicationsHint')}</p>
        <p className="mb-1 text-[11px] text-slate-400">{t('settings.medSourceNote')}</p>
        <p className="mb-3 text-[11px] text-slate-400">
          {MEDICATION_SOURCE_LABEL} — {MEDICATION_SOURCE_VERSION} · {catalog.filter((m) => m.status !== 'inactive').length}{' '}
          {t('settings.medCount')}
        </p>
        <p className="mb-3 text-[11px] text-slate-400">
          Import ({MEDICATION_IMPORT_FIELDS.join(', ')}) — relancer via `npm run medications:import-miph`.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            value={medQuery}
            onChange={(e) => setMedQuery(e.target.value)}
            placeholder={t('settings.medSearch')}
            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
          />
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="rounded-lg bg-clinic-700 px-3 py-2 text-sm font-medium text-white hover:bg-clinic-800"
          >
            {t('settings.medAdd')}
          </button>
        </div>
        {showAdd ? (
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <Field label={t('settings.medName')} value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
            <Field label={t('settings.medDci')} value={draft.dci} onChange={(dci) => setDraft({ ...draft, dci })} />
            <Field label={t('settings.medDosage')} value={draft.dosage} onChange={(dosage) => setDraft({ ...draft, dosage })} />
            <Field label={t('settings.medForm')} value={draft.form} onChange={(form) => setDraft({ ...draft, form })} />
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg px-3 py-1.5 text-sm text-slate-600">
                {t('common.cancel')}
              </button>
              <button type="button" onClick={saveMed} className="rounded-lg bg-clinic-700 px-3 py-1.5 text-sm text-white">
                {t('common.save')}
              </button>
            </div>
          </div>
        ) : null}
        <ul className="max-h-72 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-100">
          {medResults.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-900">
                  {m.name}{' '}
                  {m.origin === 'custom' ? (
                    <span className="text-[10px] font-semibold uppercase text-clinic-700">
                      {t('settings.medCustomBadge')}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold uppercase text-slate-400">
                      {t('settings.medOfficialBadge')}
                    </span>
                  )}{' '}
                  {m.status === 'inactive' ? (
                    <span className="text-[10px] font-semibold uppercase text-amber-700">inactif</span>
                  ) : null}
                </p>
                <p className="text-[11px] text-slate-500">
                  {[m.dosage, m.form, m.dci].filter(Boolean).join(' · ')}
                </p>
                <p className="text-[10px] text-slate-400">{m.source || MEDICATION_SOURCE_LABEL}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setMedicationStatus(m.id, m.status === 'inactive' ? 'active' : 'inactive')
                }
                className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {m.status === 'inactive' ? t('settings.medEnable') : t('settings.medDisable')}
              </button>
            </li>
          ))}
        </ul>
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
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {t(`settings.date.${f}` as 'settings.date.long')}
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
              {TIME_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {t(`settings.time.${f === '24h' ? '24' : '12'}` as 'settings.time.24')}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            {t('settings.timezone')}
            <input
              value={settings.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            />
          </label>
          <div className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <span className="text-xs font-medium text-slate-500">{t('settings.preview')} · </span>
            {formatClinicDate(now, settings)} · {formatClinicTime(now, settings)}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2 text-clinic-800">
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

      <UpdateNotifier mode="settings" />
    </div>
  )
}

function BackupRestoreSection() {
  const clinic = useAppStore((s) => s.clinic)
  const replaceClinicMirror = useAppStore((s) => s.replaceClinicMirror)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const cloud = isCloudClinicMode()

  async function onBackup() {
    setBusy(true)
    setMsg(null)
    try {
      const payload = buildClinicBackup(clinic, {
        appVersion: APP_VERSION,
        mode: cloud ? 'CLOUD_EXPORT' : 'LEGACY',
      })
      downloadJsonBackup(payload)
      setMsg(
        cloud
          ? 'Export cabinet téléchargé (ne remplace pas un backup serveur PostgreSQL/R2).'
          : 'Sauvegarde LEGACY téléchargée.',
      )
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Échec sauvegarde')
    } finally {
      setBusy(false)
    }
  }

  async function onRestore(file?: File) {
    if (!file) return
    if (cloud) {
      setMsg('La restauration complète n’est disponible qu’en mode LEGACY. Utilisez l’export Cloud pour archivage local uniquement.')
      return
    }
    if (
      !window.confirm(
        'Restaurer cette sauvegarde ? Une copie de sécurité des données actuelles sera créée d’abord. Cette action remplace le cabinet local.',
      )
    ) {
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const raw = await readBackupFile(file)
      const validated = validateClinicBackup(raw)
      if (!validated.ok) {
        setMsg(validated.message)
        return
      }
      // Safety backup of current state before restore
      downloadJsonBackup(
        buildClinicBackup(clinic, { appVersion: APP_VERSION, mode: 'LEGACY' }),
        `dentisuite-pre-restore-${Date.now()}.json`,
      )
      const next = clinicFromBackup(validated.data)
      await saveClinic(next)
      replaceClinicMirror(next)
      setMsg('Restauration terminée. Rechargez si l’affichage n’est pas à jour.')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Échec restauration')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-sm font-semibold text-clinic-800">Sauvegarde et restauration</h2>
      <p className="mt-2 text-sm text-slate-500">
        {cloud
          ? 'Mode Cloud : export local du miroir cabinet (patients/ordonnances en mémoire). Ce n’est pas un backup PostgreSQL/R2.'
          : 'Mode Legacy : sauvegarde JSON complète du cabinet local, restaurable après validation.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onBackup()}
          className="rounded-lg bg-clinic-700 px-3 py-2 text-sm font-medium text-white hover:bg-clinic-800 disabled:opacity-60"
        >
          {cloud ? 'Exporter le cabinet' : 'Créer une sauvegarde'}
        </button>
        {!cloud ? (
          <label className="inline-flex cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">
            Restaurer…
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              disabled={busy}
              onChange={(e) => void onRestore(e.target.files?.[0])}
            />
          </label>
        ) : null}
      </div>
      {msg ? <p className="mt-3 text-sm text-slate-600">{msg}</p> : null}
    </section>
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
  value?: string
  onFile: (f?: File) => void
  onClear: () => void
  upload: string
  remove: string
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-slate-600">{label}</p>
      <div className="flex flex-col gap-2">
        {value ? (
          <img src={value} alt="" className="h-24 w-full rounded-lg border border-slate-200 object-contain" />
        ) : (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400">
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
