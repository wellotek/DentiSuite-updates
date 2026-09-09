import { useMemo, useState } from 'react'
import { Minus, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'
import { formatDA } from '../lib/money'
import {
  STOCK_CATEGORIES,
  formatStockDate,
  stockAlert,
  stockAlertMeta,
  stockCategoryLabel,
  stockValue,
} from '../lib/stock'
import type { StockAlert, StockCategory, StockItem } from '../types'
import { StockItemModal } from '../components/stock/StockItemModal'
import { printStockReport } from '../lib/stockReport'

type StatusFilter = 'all' | StockAlert

export function Stock() {
  const t = useT()
  const settings = useAppStore((s) => s.clinic.settings)
  const items = useAppStore((s) => s.clinic.stockItems ?? [])
  const addStockItem = useAppStore((s) => s.addStockItem)
  const updateStockItem = useAppStore((s) => s.updateStockItem)
  const deleteStockItem = useAppStore((s) => s.deleteStockItem)
  const adjustStockQuantity = useAppStore((s) => s.adjustStockQuantity)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<StockCategory | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [editing, setEditing] = useState<StockItem | null | 'new'>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      const alert = stockAlert(item)
      if (category !== 'all' && item.category !== category) return false
      if (status !== 'all' && alert !== status) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.supplier.toLowerCase().includes(q)
      )
    })
  }, [items, query, category, status])

  const totalValue = items.reduce((sum, item) => sum + stockValue(item), 0)
  const lowCount = items.filter((i) => stockAlert(i) === 'low').length
  const expiredCount = items.filter((i) => stockAlert(i) === 'expired').length
  const expiringCount = items.filter((i) => stockAlert(i) === 'expiring').length

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('stock.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('stock.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => printStockReport(filtered.length ? filtered : items, settings)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            {t('stock.export')}
          </button>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-2 rounded-lg bg-clinic-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-clinic-800"
          >
            <Plus className="h-4 w-4" />
            {t('stock.add')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t('stock.value')} value={formatDA(totalValue)} hint={`${items.length} ${t('stock.articles')}`} />
        <Kpi label={t('stock.low')} value={String(lowCount)} tone="red" />
        <Kpi label={t('stock.expired')} value={String(expiredCount)} tone="red" />
        <Kpi label={t('stock.expiring')} value={String(expiringCount)} tone="orange" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('stock.search')}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 ps-9 pe-3 text-sm outline-none focus:border-clinic-400"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as StockCategory | 'all')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-clinic-400"
        >
          <option value="all">{t('stock.allCategories')}</option>
          {STOCK_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-clinic-400"
        >
          <option value="all">{t('stock.allStatuses')}</option>
          <option value="ok">{t('stock.statusOk')}</option>
          <option value="low">{t('stock.low')}</option>
          <option value="expiring">{t('stock.expiring')}</option>
          <option value="expired">{t('stock.expired')}</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">{t('stock.code')}</th>
                <th className="px-3 py-3 font-medium">{t('stock.name')}</th>
                <th className="px-3 py-3 font-medium">{t('stock.category')}</th>
                <th className="px-3 py-3 font-medium">{t('stock.qty')}</th>
                <th className="px-3 py-3 font-medium">{t('stock.unitPrice')}</th>
                <th className="px-3 py-3 font-medium">{t('stock.addedAt')}</th>
                <th className="px-3 py-3 font-medium">{t('stock.expiry')}</th>
                <th className="px-3 py-3 font-medium">{t('stock.supplier')}</th>
                <th className="px-3 py-3 font-medium">{t('stock.status')}</th>
                <th className="px-3 py-3 text-end font-medium">{t('stock.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const alert = stockAlert(item)
                const meta = stockAlertMeta(alert)
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-clinic-800">{item.code}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{item.name}</td>
                    <td className="px-3 py-2.5 text-slate-600">{stockCategoryLabel(item.category)}</td>
                    <td className="px-3 py-2.5">
                      <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() => adjustStockQuantity(item.id, -1)}
                          className="rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          disabled={item.quantity <= 0}
                          aria-label="−"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-7 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => adjustStockQuantity(item.id, 1)}
                          className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                          aria-label="+"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-medium">{formatDA(item.unitPrice)}</td>
                    <td className="px-3 py-2.5 text-slate-500">{formatStockDate(item.addedAt)}</td>
                    <td className="px-3 py-2.5 text-slate-500">{formatStockDate(item.expiryDate)}</td>
                    <td className="px-3 py-2.5 text-slate-600">{item.supplier || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {confirmId === item.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                deleteStockItem(item.id)
                                setConfirmId(null)
                              }}
                              className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                            >
                              {t('common.delete')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(null)}
                              className="rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                            >
                              {t('common.cancel')}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditing(item)}
                              className="rounded-md p-1.5 text-clinic-800 hover:bg-clinic-50"
                              title={t('common.edit')}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(item.id)}
                              className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-sm text-slate-500">
                    {t('stock.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <StockItemModal
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(draft) => {
            if (editing === 'new') addStockItem(draft)
            else updateStockItem(editing.id, draft)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'red' | 'orange'
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === 'red' ? 'text-red-700' : tone === 'orange' ? 'text-orange-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
