import { useMemo, useState, type ReactNode } from 'react'
import {
  Banknote,
  CircleAlert,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { formatDA } from '../lib/money'
import { localeTag, useT } from '../i18n'
import type { Invoice } from '../types'
import { parseISODate } from '../lib/agenda'
import {
  defaultFinancePeriod,
  deltaPct,
  downloadCsv,
  filterInvoices,
  financeChartPoints,
  formatPeriodLabel,
  invoicesToCsv,
  lastNDays,
  monthRangeOf,
  periodForDay,
  previousMonthOf,
  previousWeekOf,
  shiftIso,
  sumAmount,
  weekRangeOf,
} from '../lib/finances'
import { printFinanceReport } from '../lib/financeReport'
import { FinanceDatePicker } from '../components/finances/FinanceDatePicker'
import { FinanceChart } from '../components/finances/FinanceChart'
import { TransactionModal } from '../components/finances/TransactionModal'

export function Finances() {
  const t = useT()
  const invoices = useAppStore((s) => s.clinic.invoices ?? [])
  const patients = useAppStore((s) => s.clinic.patients)
  const settings = useAppStore((s) => s.clinic.settings)
  const actCatalog = useAppStore((s) => s.clinic.actCatalog ?? [])
  const addInvoice = useAppStore((s) => s.addInvoice)
  const updateInvoice = useAppStore((s) => s.updateInvoice)
  const deleteInvoice = useAppStore((s) => s.deleteInvoice)
  const loc = localeTag(settings?.locale ?? 'fr')
  const [period, setPeriod] = useState(defaultFinancePeriod)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'paid' | 'billed'>('all')
  const [editing, setEditing] = useState<Invoice | null | 'new'>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const cursor = period.cursor
  const yesterday = shiftIso(cursor, -1)
  const week = weekRangeOf(cursor)
  const prevWeek = previousWeekOf(cursor)
  const month = monthRangeOf(cursor)
  const prevMonth = previousMonthOf(cursor)

  const caDay = sumAmount(filterInvoices(invoices, cursor, cursor), true)
  const caYesterday = sumAmount(filterInvoices(invoices, yesterday, yesterday), true)
  const caWeek = sumAmount(filterInvoices(invoices, week.start, week.end), true)
  const caPrevWeek = sumAmount(filterInvoices(invoices, prevWeek.start, prevWeek.end), true)
  const caMonth = sumAmount(filterInvoices(invoices, month.start, month.end), true)
  const caPrevMonth = sumAmount(filterInvoices(invoices, prevMonth.start, prevMonth.end), true)

  const inPeriod = useMemo(
    () =>
      [...filterInvoices(invoices, period.start, period.end)].sort(
        (a, b) => b.date.localeCompare(a.date) || a.patientName.localeCompare(b.patientName),
      ),
    [invoices, period.start, period.end],
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return inPeriod.filter((inv) => {
      if (status === 'paid' && !inv.paid) return false
      if (status === 'billed' && inv.paid) return false
      if (!q) return true
      return inv.patientName.toLowerCase().includes(q) || inv.label.toLowerCase().includes(q)
    })
  }, [inPeriod, query, status])

  const periodPaid = sumAmount(inPeriod, true)
  const periodUnpaid = sumAmount(inPeriod, false)
  const chartStart = period.mode === 'day' ? shiftIso(cursor, -13) : period.start
  const chartEnd = period.mode === 'day' ? cursor : period.end
  const chartPoints = useMemo(
    () => financeChartPoints(invoices, chartStart, chartEnd, loc),
    [invoices, chartStart, chartEnd, loc],
  )
  const recentDays = lastNDays(7, cursor)
  const actSuggestions = actCatalog.map((a) => a.name)

  function exportCsv() {
    const rows = filtered.length ? filtered : inPeriod
    downloadCsv(invoicesToCsv(rows), `dentisuite-caisse-${period.start}_${period.end}.csv`)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('finances.title')}</h1>
          <p className="mt-1 text-sm capitalize text-slate-500">
            {t('finances.subtitle')} · {formatPeriodLabel(period, loc)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FinanceDatePicker period={period} onChange={setPeriod} />
          <button
            type="button"
            onClick={() => printFinanceReport(invoices, settings, period, loc)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            {t('finances.print')}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            {t('finances.csv')}
          </button>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-2 rounded-lg bg-clinic-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-clinic-800"
          >
            <Plus className="h-4 w-4" />
            {t('finances.add')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          icon={<Banknote className="h-4 w-4" />}
          label={t('finances.caDay')}
          value={formatDA(caDay)}
          hint={parseISODate(cursor).toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'short' })}
          delta={deltaPct(caDay, caYesterday)}
          deltaLabel={t('finances.vsYesterday')}
        />
        <Kpi
          icon={<TrendingUp className="h-4 w-4" />}
          label={t('finances.caWeek')}
          value={formatDA(caWeek)}
          hint={`${parseISODate(week.start).toLocaleDateString(loc, { day: 'numeric', month: 'short' })} — ${parseISODate(week.end).toLocaleDateString(loc, { day: 'numeric', month: 'short' })}`}
          delta={deltaPct(caWeek, caPrevWeek)}
          deltaLabel={t('finances.vsPrevWeek')}
        />
        <Kpi
          icon={<FileSpreadsheet className="h-4 w-4" />}
          label={t('finances.caMonth')}
          value={formatDA(caMonth)}
          hint={parseISODate(cursor).toLocaleDateString(loc, { month: 'long', year: 'numeric' })}
          delta={deltaPct(caMonth, caPrevMonth)}
          deltaLabel={t('finances.vsPrevMonth')}
        />
        <Kpi
          icon={<CircleAlert className="h-4 w-4" />}
          label={t('finances.yesterday')}
          value={formatDA(caYesterday)}
          hint={parseISODate(yesterday).toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'short' })}
          tone="slate"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {recentDays.map((iso) => {
          const paid = sumAmount(filterInvoices(invoices, iso, iso), true)
          const active = iso === cursor && period.mode === 'day'
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setPeriod(periodForDay(iso))}
              className={`min-w-[88px] rounded-xl border px-3 py-2 text-start transition ${
                active
                  ? 'border-clinic-400 bg-clinic-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-clinic-200 hover:bg-slate-50'
              }`}
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {parseISODate(iso).toLocaleDateString(loc, { weekday: 'short', day: 'numeric' })}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">{formatDA(paid)}</p>
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">{t('finances.chart')}</h2>
            <p className="text-xs text-slate-400">{t('finances.chartHint')}</p>
          </div>
          <div className="flex gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-5 rounded-full bg-clinic-600" />
              {t('finances.paid')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-5 rounded-sm bg-slate-300" />
              {t('finances.volume')}
            </span>
            <span className="font-semibold text-slate-700">
              {t('finances.periodPaid')}: {formatDA(periodPaid)}
            </span>
          </div>
        </div>
        <FinanceChart points={chartPoints} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('finances.search')}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 ps-9 pe-3 text-sm outline-none focus:border-clinic-400"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-clinic-400"
        >
          <option value="all">{t('finances.allStatuses')}</option>
          <option value="paid">{t('finances.paid')}</option>
          <option value="billed">{t('finances.billed')}</option>
        </select>
        <p className="text-xs text-slate-400">
          {filtered.length} {t('finances.txShort')} · {t('finances.unpaid')}: {formatDA(periodUnpaid)}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t('finances.patient')}</th>
                <th className="px-4 py-3 font-medium">{t('finances.label')}</th>
                <th className="px-4 py-3 font-medium">{t('finances.date')}</th>
                <th className="px-4 py-3 font-medium">{t('finances.amount')}</th>
                <th className="px-4 py-3 font-medium">{t('finances.status')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('finances.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium text-slate-800">{inv.patientName}</td>
                  <td className="px-4 py-3 text-slate-600">{inv.label}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {parseISODate(inv.date).toLocaleDateString(loc)}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatDA(inv.amount)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        inv.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {inv.paid ? t('finances.paid') : t('finances.billed')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {confirmId === inv.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              deleteInvoice(inv.id)
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
                            onClick={() => setEditing(inv)}
                            className="rounded-md p-1.5 text-clinic-800 hover:bg-clinic-50"
                            title={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(inv.id)}
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
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    {t('finances.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <TransactionModal
          patients={patients}
          actSuggestions={actSuggestions}
          initial={editing === 'new' ? null : editing}
          defaultDate={period.cursor}
          onClose={() => setEditing(null)}
          onSave={(draft) => {
            if (editing === 'new') addInvoice(draft)
            else updateInvoice(editing.id, draft)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function Kpi({
  icon,
  label,
  value,
  hint,
  delta,
  deltaLabel,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
  delta?: number
  deltaLabel?: string
  tone?: 'slate'
}) {
  const up = (delta ?? 0) > 0
  const down = (delta ?? 0) < 0
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center gap-2 text-clinic-700">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-semibold ${tone === 'slate' ? 'text-slate-800' : 'text-slate-900'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs capitalize text-slate-400">{hint}</p>}
      {delta !== undefined && deltaLabel && (
        <p
          className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${
            up ? 'text-emerald-700' : down ? 'text-red-600' : 'text-slate-400'
          }`}
        >
          {up ? <TrendingUp className="h-3 w-3" /> : down ? <TrendingDown className="h-3 w-3" /> : null}
          {up ? '+' : ''}
          {delta}% {deltaLabel}
        </p>
      )}
    </div>
  )
}
