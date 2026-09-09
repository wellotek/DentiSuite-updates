import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Printer, Trash2 } from 'lucide-react'
import type { Dentist, Patient, Prescription, PrescriptionDraft } from '../../types'
import { dentistName } from '../../lib/dentists'
import { toISODate } from '../../lib/agenda'
import { newPrescriptionLine } from '../../lib/prescriptions'
import { useT } from '../../i18n'

const WALK_IN = '__walkin__'

interface Props {
  patients: Patient[]
  dentists: Dentist[]
  initial: Prescription | PrescriptionDraft
  onClose: () => void
  onSave: (draft: PrescriptionDraft) => Prescription
  onPrint: (rx: Prescription | PrescriptionDraft) => void
}

export function PrescriptionEditor({ patients, dentists, initial, onClose, onSave, onPrint }: Props) {
  const t = useT()
  const savedId = 'id' in initial ? initial.id : undefined
  const [form, setForm] = useState({
    patientId: initial.patientId || (initial.patientName ? WALK_IN : patients[0]?.id || WALK_IN),
    walkInName: initial.patientId ? '' : initial.patientName,
    date: initial.date || toISODate(new Date()),
    title: initial.title,
    templateId: initial.templateId,
    lines: initial.lines.length ? initial.lines : [newPrescriptionLine()],
    advice: initial.advice,
    dentistId: initial.dentistId || dentists[0]?.id || '',
  })
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function buildDraft(): PrescriptionDraft | null {
    const selected = patients.find((p) => p.id === form.patientId)
    const walkIn = form.patientId === WALK_IN
    const patientName = walkIn ? form.walkInName.trim() : selected ? `${selected.firstName} ${selected.lastName}` : ''
    if (!patientName) return null
    const dentist = dentists.find((d) => d.id === form.dentistId)
    const lines = form.lines
      .map((l) => ({ ...l, drug: l.drug.trim(), posology: l.posology.trim(), duration: l.duration.trim(), notes: l.notes.trim() }))
      .filter((l) => l.drug)
    if (!lines.length) return null
    return {
      patientId: walkIn ? undefined : selected?.id,
      patientName,
      date: form.date || toISODate(new Date()),
      title: form.title.trim() || t('rx.defaultTitle'),
      templateId: form.templateId,
      lines,
      advice: form.advice.trim(),
      dentistId: dentist?.id,
      dentistName: dentist ? dentistName(dentist) : '',
    }
  }

  function save(): Prescription | null {
    const draft = buildDraft()
    if (!draft) return null
    return onSave(draft)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        className="my-6 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault()
          if (save()) onClose()
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {savedId ? t('rx.edit') : t('rx.new')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">{form.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const draft = buildDraft()
                if (draft) onPrint(savedId ? { ...draft, id: savedId } : draft)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              {t('rx.print')}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
              {t('common.cancel')}
            </button>
            <button type="submit" className="rounded-lg bg-clinic-700 px-4 py-2 text-sm font-medium text-white hover:bg-clinic-800">
              {t('common.save')}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="col-span-2 block text-xs font-medium text-slate-600 sm:col-span-1">
            {t('rx.patient')}
            <select
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
              <option value={WALK_IN}>{t('rx.walkIn')}</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t('rx.date')}
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            />
          </label>
          {form.patientId === WALK_IN && (
            <label className="col-span-2 block text-xs font-medium text-slate-600">
              {t('rx.patientName')}
              <input
                value={form.walkInName}
                onChange={(e) => setForm({ ...form, walkInName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
                required
              />
            </label>
          )}
          <label className="block text-xs font-medium text-slate-600">
            {t('rx.title')}
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t('rx.dentist')}
            <select
              value={form.dentistId}
              onChange={(e) => setForm({ ...form, dentistId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            >
              <option value="">{t('form.unassigned')}</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  {dentistName(d)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('rx.meds')}</p>
            <button
              type="button"
              onClick={() => setForm({ ...form, lines: [...form.lines, newPrescriptionLine()] })}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-clinic-800 hover:bg-clinic-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('rx.addLine')}
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('rx.drug')}</th>
                  <th className="px-3 py-2 font-medium">{t('rx.posology')}</th>
                  <th className="px-3 py-2 font-medium">{t('rx.duration')}</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {form.lines.map((line, index) => (
                  <tr key={line.id}>
                    <td className="px-2 py-2 align-top">
                      <input
                        value={line.drug}
                        onChange={(e) => {
                          const lines = form.lines.map((l, i) => (i === index ? { ...l, drug: e.target.value } : l))
                          setForm({ ...form, lines })
                        }}
                        placeholder={t('rx.drug')}
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-clinic-400"
                      />
                      <input
                        value={line.notes}
                        onChange={(e) => {
                          const lines = form.lines.map((l, i) => (i === index ? { ...l, notes: e.target.value } : l))
                          setForm({ ...form, lines })
                        }}
                        placeholder={t('rx.lineNotes')}
                        className="mt-1 w-full rounded-md border border-transparent px-2 py-1 text-[11px] text-slate-500 outline-none focus:border-slate-200"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input
                        value={line.posology}
                        onChange={(e) => {
                          const lines = form.lines.map((l, i) => (i === index ? { ...l, posology: e.target.value } : l))
                          setForm({ ...form, lines })
                        }}
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-clinic-400"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input
                        value={line.duration}
                        onChange={(e) => {
                          const lines = form.lines.map((l, i) => (i === index ? { ...l, duration: e.target.value } : l))
                          setForm({ ...form, lines })
                        }}
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-clinic-400"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            lines: form.lines.length === 1 ? [newPrescriptionLine()] : form.lines.filter((_, i) => i !== index),
                          })
                        }
                        className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <label className="mt-4 block text-xs font-medium text-slate-600">
          {t('rx.advice')}
          <textarea
            value={form.advice}
            onChange={(e) => setForm({ ...form, advice: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
          />
        </label>
      </form>
    </div>,
    document.body,
  )
}
