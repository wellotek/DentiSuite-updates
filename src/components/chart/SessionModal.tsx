import { FormEvent, useState } from 'react'
import type { PatientSession } from '../../types'
import { LOWER_TEETH, UPPER_TEETH, COMMON_ACTS } from '../../data/teeth'
import { toISODate } from '../../lib/agenda'
import { useT } from '../../i18n'

interface Props {
  patientId: string
  initial?: PatientSession | null
  onClose: () => void
  onSave: (draft: Omit<PatientSession, 'id'>) => void
}

export function SessionModal({ patientId, initial, onClose, onSave }: Props) {
  const t = useT()
  const now = new Date()
  const [form, setForm] = useState({
    date: initial?.date ?? toISODate(now),
    time: initial?.time ?? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    teeth: initial?.teeth ?? [],
    acts: initial?.acts ?? '',
    notes: initial?.notes ?? '',
    prescription: initial?.prescription ?? '',
  })

  function toggleTooth(n: string) {
    setForm((current) => ({
      ...current,
      teeth: current.teeth.includes(n) ? current.teeth.filter((x) => x !== n) : [...current.teeth, n],
    }))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({
      patientId,
      date: form.date,
      time: form.time,
      teeth: form.teeth,
      acts: form.acts.trim(),
      notes: form.notes.trim(),
      prescription: form.prescription.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">
          {initial ? t('chart.sessionEdit') : t('chart.sessionNew')}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-600">
            {t('agenda.date')}
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t('agenda.time')}
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            />
          </label>
          <div className="col-span-2">
            <p className="text-xs font-medium text-slate-600">{t('chart.teeth')}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {[...UPPER_TEETH, ...LOWER_TEETH].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleTooth(n)}
                  className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] ${
                    form.teeth.includes(n)
                      ? 'bg-clinic-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            {t('chart.acts')}
            <input
              list="session-acts"
              value={form.acts}
              onChange={(e) => setForm({ ...form, acts: e.target.value })}
              placeholder="Composite 16, Détartrage…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            />
            <datalist id="session-acts">
              {COMMON_ACTS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            {t('chart.notes')}
            <textarea
              rows={5}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              placeholder="Observations cliniques, diagnostics, suivi…"
            />
          </label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            {t('chart.prescription')}
            <textarea
              rows={3}
              value={form.prescription}
              onChange={(e) => setForm({ ...form, prescription: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              placeholder="Ordonnance, conseils d’hygiène, rendez-vous de contrôle…"
            />
          </label>
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
