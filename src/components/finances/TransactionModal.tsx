import { FormEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Invoice, InvoiceDraft, Patient } from '../../types'
import { toISODate } from '../../lib/agenda'
import { useT } from '../../i18n'
import { PatientPicker } from '../patients/PatientPicker'
import { useToast } from '../ui/Toast'

interface Props {
  patients: Patient[]
  actSuggestions: string[]
  initial?: Invoice | null
  defaultDate: string
  onClose: () => void
  onSave: (draft: InvoiceDraft) => void
}

const WALK_IN = '__walkin__'

export function TransactionModal({
  patients,
  actSuggestions,
  initial,
  defaultDate,
  onClose,
  onSave,
}: Props) {
  const t = useT()
  const toast = useToast()
  const editing = Boolean(initial)
  const [form, setForm] = useState({
    patientId: initial?.patientId || patients.find((p) => `${p.firstName} ${p.lastName}` === initial?.patientName)?.id || (initial ? WALK_IN : patients[0]?.id || WALK_IN),
    walkInName: initial && !initial.patientId ? initial.patientName : '',
    label: initial?.label ?? '',
    date: initial?.date ?? defaultDate,
    amount: String(initial?.amount ?? ''),
    paid: initial?.paid ?? true,
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
    const amount = Math.max(0, Math.round(Number(form.amount) || 0))
    const label = form.label.trim()
    if (!label || amount <= 0) return
    const selected = patients.find((p) => p.id === form.patientId)
    const walkIn = form.patientId === WALK_IN
    const patientName = walkIn ? form.walkInName.trim() : selected ? `${selected.firstName} ${selected.lastName}` : ''
    if (!patientName) return
    onSave({
      patientId: walkIn ? undefined : selected?.id,
      patientName,
      label,
      date: form.date || toISODate(new Date()),
      amount,
      paid: form.paid,
    })
    toast.success(t('toast.invoiceSaved'))
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">
          {editing ? t('finances.editTx') : t('finances.addTx')}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <PatientPicker
              patients={patients}
              value={form.patientId}
              label={t('finances.patient')}
              specialOptions={[{ value: WALK_IN, label: t('finances.walkIn') }]}
              onChange={(patientId) => setForm({ ...form, patientId })}
            />
          </div>
          {form.patientId === WALK_IN && (
            <label className="col-span-2 block text-xs font-medium text-slate-600">
              {t('finances.patientName')}
              <input
                value={form.walkInName}
                onChange={(e) => setForm({ ...form, walkInName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
                required
              />
            </label>
          )}
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            {t('finances.label')}
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              list="finance-acts"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            />
            <datalist id="finance-acts">
              {actSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t('finances.date')}
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t('finances.amount')}
            <input
              type="number"
              min={0}
              step={50}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            />
          </label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            {t('finances.status')}
            <select
              value={form.paid ? 'paid' : 'billed'}
              onChange={(e) => setForm({ ...form, paid: e.target.value === 'paid' })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            >
              <option value="paid">{t('finances.paid')}</option>
              <option value="billed">{t('finances.billed')}</option>
            </select>
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
