import { FormEvent, useState } from 'react'
import type { StockCategory, StockItem, StockItemDraft } from '../../types'
import { STOCK_CATEGORIES } from '../../lib/stock'
import { toISODate } from '../../lib/agenda'
import { useT } from '../../i18n'

interface Props {
  initial?: StockItem | null
  onClose: () => void
  onSave: (draft: StockItemDraft) => void
}

export function StockItemModal({ initial, onClose, onSave }: Props) {
  const t = useT()
  const [form, setForm] = useState({
    code: initial?.code ?? '',
    name: initial?.name ?? '',
    category: (initial?.category ?? 'consommable') as StockCategory,
    quantity: String(initial?.quantity ?? 1),
    minQuantity: String(initial?.minQuantity ?? 5),
    unitPrice: String(initial?.unitPrice ?? 0),
    addedAt: initial?.addedAt ?? toISODate(new Date()),
    expiryDate: initial?.expiryDate ?? '',
    supplier: initial?.supplier ?? '',
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      category: form.category,
      quantity: Math.max(0, Math.round(Number(form.quantity) || 0)),
      minQuantity: Math.max(0, Math.round(Number(form.minQuantity) || 0)),
      unitPrice: Math.max(0, Math.round(Number(form.unitPrice) || 0)),
      addedAt: form.addedAt,
      expiryDate: form.expiryDate,
      supplier: form.supplier.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">
          {initial ? t('stock.edit') : t('stock.add')}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field
            label={t('stock.code')}
            value={form.code}
            onChange={(v) => setForm({ ...form, code: v })}
          />
          <label className="block text-xs font-medium text-slate-600">
            {t('stock.category')}
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as StockCategory })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            >
              {STOCK_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            {t('stock.name')}
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            />
          </label>
          <Field
            label={t('stock.qty')}
            type="number"
            value={form.quantity}
            onChange={(v) => setForm({ ...form, quantity: v })}
          />
          <Field
            label={t('stock.minQty')}
            type="number"
            value={form.minQuantity}
            onChange={(v) => setForm({ ...form, minQuantity: v })}
          />
          <Field
            label={t('stock.unitPrice')}
            type="number"
            value={form.unitPrice}
            onChange={(v) => setForm({ ...form, unitPrice: v })}
          />
          <Field
            label={t('stock.supplier')}
            value={form.supplier}
            onChange={(v) => setForm({ ...form, supplier: v })}
            required={false}
          />
          <label className="block text-xs font-medium text-slate-600">
            {t('stock.addedAt')}
            <input
              type="date"
              value={form.addedAt}
              onChange={(e) => setForm({ ...form, addedAt: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t('stock.expiry')} ({t('common.optional')})
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
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
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = true,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        type={type}
        min={type === 'number' ? 0 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
      />
    </label>
  )
}
