import { FormEvent, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'
import { dentistName, DENTIST_COLORS } from '../lib/dentists'
import { DentistAvatar } from '../components/dentists/DentistSelect'
import { readImageAsDataUrl } from '../i18n'
import type { Dentist, DentistDraft } from '../types'
import { isCloudClinicMode } from '../cloud/cloudClinicMode'

export function Practitioners() {
  const t = useT()
  const dentists = useAppStore((s) => s.clinic.dentists ?? [])
  const addDentist = useAppStore((s) => s.addDentist)
  const addDentistCloud = useAppStore((s) => s.addDentistCloud)
  const updateDentist = useAppStore((s) => s.updateDentist)
  const deleteDentist = useAppStore((s) => s.deleteDentist)
  const [editing, setEditing] = useState<Dentist | null | 'new'>(null)

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('dentists.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('dentists.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 rounded-lg bg-clinic-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-clinic-800"
        >
          <Plus className="h-4 w-4" />
          {t('dentists.new')}
        </button>
      </div>

      <div className="grid gap-3">
        {dentists.map((d) => (
          <article key={d.id} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <DentistAvatar dentist={d} size={56} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{dentistName(d)}</p>
              <p className="text-sm text-slate-500">{d.specialty}</p>
            </div>
            <span className="h-3 w-3 rounded-full" style={{ background: d.color }} />
            <button
              type="button"
              onClick={() => setEditing(d)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t('dentists.deleteConfirm'))) deleteDentist(d.id)
              }}
              className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </article>
        ))}
        {dentists.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            {t('dentists.empty')}
          </p>
        )}
      </div>

      {editing && (
        <DentistModal
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            if (editing === 'new') {
              if (isCloudClinicMode()) await addDentistCloud(draft)
              else addDentist(draft)
            } else updateDentist(editing.id, draft)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function DentistModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Dentist | null
  onClose: () => void
  onSave: (draft: DentistDraft) => void
}) {
  const t = useT()
  const [form, setForm] = useState<DentistDraft>({
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    specialty: initial?.specialty ?? 'Omnipratique',
    photo: initial?.photo ?? '',
    color: initial?.color ?? DENTIST_COLORS[0],
  })

  async function onFile(file?: File) {
    if (!file) return
    const photo = await readImageAsDataUrl(file)
    setForm({ ...form, photo })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">
          {initial ? t('dentists.edit') : t('dentists.new')}
        </h2>
        <div className="mt-4 flex items-center gap-4">
          <DentistAvatar dentist={form} size={64} />
          <div>
            <p className="text-xs font-medium text-slate-600">{t('dentists.photo')}</p>
            <label className="mt-1 inline-flex cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              {t('settings.upload')}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </label>
            {form.photo && (
              <button
                type="button"
                onClick={() => setForm({ ...form, photo: '' })}
                className="ms-2 text-xs text-slate-500 hover:text-red-600"
              >
                {t('settings.remove')}
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label={t('form.lastName')} value={form.lastName} onChange={(lastName) => setForm({ ...form, lastName })} />
          <Field label={t('form.firstName')} value={form.firstName} onChange={(firstName) => setForm({ ...form, firstName })} />
          <div className="col-span-2">
            <Field label={t('dentists.specialty')} value={form.specialty} onChange={(specialty) => setForm({ ...form, specialty })} />
          </div>
        </div>
        <p className="mt-3 text-xs font-medium text-slate-600">{t('dentists.color')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DENTIST_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setForm({ ...form, color })}
              className={`h-7 w-7 rounded-full ${form.color === color ? 'ring-2 ring-offset-2 ring-clinic-700' : ''}`}
              style={{ background: color }}
            />
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            {t('common.cancel')}
          </button>
          <button type="submit" className="rounded-lg bg-clinic-700 px-4 py-2 text-sm font-medium text-white hover:bg-clinic-800">
            {t('common.save')}
          </button>
        </div>
      </form>
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
        required
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
      />
    </label>
  )
}
