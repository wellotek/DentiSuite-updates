import { FormEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Patient, Prosthesis, ProsthesisDraft } from '../../types'
import { toISODate } from '../../lib/agenda'
import { normalizeProsthesisStatus, PROSTHESIS_STATUSES, PROSTHESIS_TYPES, type ProsthesisUiStatus } from '../../lib/prostheses'
import { useT } from '../../i18n'

interface Props {
  patients: Patient[]
  labs: string[]
  initial?: Prosthesis | null
  onClose: () => void
  onSave: (draft: ProsthesisDraft) => void
}

export function ProsthesisModal({ patients, labs, initial, onClose, onSave }: Props) {
  const t = useT()
  const editing = Boolean(initial)
  const [form, setForm] = useState({
    patientId: initial?.patientId || '',
    type: initial?.type ?? PROSTHESIS_TYPES[0],
    tooth: initial?.tooth ?? '',
    lab: initial?.lab ?? '',
    sentAt: initial?.sentAt ?? toISODate(new Date()),
    expectedAt: initial?.expectedAt ?? '',
    status: (initial?.status === 'envoye' ? 'fabrication' : initial?.status) ?? 'fabrication',
    notes: initial?.notes ?? '',
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

  function submit(e: FormEvent) {
    e.preventDefault()
    const patient = patients.find((p) => p.id === form.patientId)
    const type = form.type.trim()
    const lab = form.lab.trim()
    if (!patient || !type || !lab) return
    onSave({
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      type,
      tooth: form.tooth.trim(),
      lab,
      sentAt: form.sentAt || toISODate(new Date()),
      expectedAt: form.expectedAt || undefined,
      notes: form.notes.trim() || undefined,
      status: normalizeProsthesisStatus(form.status),
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">
          {editing ? t('prostheses.edit') : t('prostheses.addTitle')}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            {t('prostheses.patient')}
            <select
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            >
              <option value="">{t('agenda.choosePatient')}</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            {t('prostheses.type')}
            <select
              value={PROSTHESIS_TYPES.includes(form.type as (typeof PROSTHESIS_TYPES)[number]) ? form.type : '__custom__'}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value === '__custom__' ? '' : e.target.value,
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            >
              {PROSTHESIS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
              <option value="__custom__">{t('prostheses.typeOther')}</option>
            </select>
          </label>
          {!PROSTHESIS_TYPES.includes(form.type as (typeof PROSTHESIS_TYPES)[number]) && (
            <label className="col-span-2 block text-xs font-medium text-slate-600">
              {t('prostheses.typeCustom')}
              <input
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
                required
              />
            </label>
          )}
          <label className="block text-xs font-medium text-slate-600">
            {t('prostheses.tooth')}
            <input
              value={form.tooth}
              onChange={(e) => setForm({ ...form, tooth: e.target.value })}
              placeholder="16, 24-26…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t('prostheses.lab')}
            <input
              value={form.lab}
              onChange={(e) => setForm({ ...form, lab: e.target.value })}
              list="prosthesis-labs"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            />
            <datalist id="prosthesis-labs">
              {labs.map((lab) => (
                <option key={lab} value={lab} />
              ))}
            </datalist>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t('prostheses.sentAt')}
            <input
              type="date"
              value={form.sentAt}
              onChange={(e) => setForm({ ...form, sentAt: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t('prostheses.expectedAt')}
            <input
              type="date"
              value={form.expectedAt}
              onChange={(e) => setForm({ ...form, expectedAt: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            />
          </label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            {t('prostheses.status')}
            <select
              value={normalizeProsthesisStatus(form.status)}
              onChange={(e) => setForm({ ...form, status: e.target.value as ProsthesisUiStatus })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            >
              {PROSTHESIS_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            {t('prostheses.notes')}
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
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
    </div>,
    document.body,
  )
}
