import type { Invoice } from '../types'
import { addDays, parseISODate, startOfWeek, toISODate, weekDays } from './agenda'

export type FinanceMode = 'day' | 'week' | 'range'

export interface FinancePeriod {
  mode: FinanceMode
  start: string
  end: string
  cursor: string
}

export interface FinanceChartPoint {
  iso: string
  label: string
  value: number
  billed: number
  count: number
}

export function defaultFinancePeriod(): FinancePeriod {
  const cursor = toISODate(new Date())
  return { mode: 'day', start: cursor, end: cursor, cursor }
}

export function periodForDay(iso: string): FinancePeriod {
  return { mode: 'day', start: iso, end: iso, cursor: iso }
}

export function periodForWeek(iso: string): FinancePeriod {
  const days = weekDays(parseISODate(iso))
  return { mode: 'week', start: toISODate(days[0]), end: toISODate(days[6]), cursor: iso }
}

export function periodForRange(a: string, b: string): FinancePeriod {
  const start = a <= b ? a : b
  const end = a <= b ? b : a
  return { mode: 'range', start, end, cursor: end }
}

export function periodForMonth(iso: string): FinancePeriod {
  const d = parseISODate(iso)
  return {
    mode: 'range',
    start: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)),
    end: toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    cursor: iso,
  }
}

export function inIsoRange(iso: string, start: string, end: string) {
  return iso >= start && iso <= end
}

export function eachIsoDay(start: string, end: string) {
  const days: string[] = []
  let d = parseISODate(start)
  const last = parseISODate(end)
  while (d.getTime() <= last.getTime()) {
    days.push(toISODate(d))
    d = addDays(d, 1)
  }
  return days
}

export function filterInvoices(invoices: Invoice[], start: string, end: string) {
  return invoices.filter((i) => inIsoRange(i.date, start, end))
}

export function sumAmount(invoices: Invoice[], paid?: boolean) {
  return invoices
    .filter((i) => paid === undefined || i.paid === paid)
    .reduce((s, i) => s + i.amount, 0)
}

export function weekRangeOf(iso: string) {
  const days = weekDays(parseISODate(iso))
  return { start: toISODate(days[0]), end: toISODate(days[6]) }
}

export function monthRangeOf(iso: string) {
  const d = parseISODate(iso)
  return {
    start: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)),
    end: toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  }
}

export function shiftIso(iso: string, days: number) {
  return toISODate(addDays(parseISODate(iso), days))
}

export function previousWeekOf(iso: string) {
  return weekRangeOf(shiftIso(iso, -7))
}

export function previousMonthOf(iso: string) {
  const d = parseISODate(iso)
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  return {
    start: toISODate(prev),
    end: toISODate(new Date(prev.getFullYear(), prev.getMonth() + 1, 0)),
  }
}

export function deltaPct(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / previous) * 100)
}

export function financeChartPoints(
  invoices: Invoice[],
  start: string,
  end: string,
  locale: string,
): FinanceChartPoint[] {
  const days = eachIsoDay(start, end)
  if (days.length <= 31) {
    return days.map((iso) => {
      const day = invoices.filter((i) => i.date === iso)
      const d = parseISODate(iso)
      return {
        iso,
        label: d.toLocaleDateString(locale, { day: '2-digit', month: 'short' }),
        value: sumAmount(day, true),
        billed: sumAmount(day),
        count: day.length,
      }
    })
  }

  const buckets = new Map<string, Invoice[]>()
  for (const inv of filterInvoices(invoices, start, end)) {
    const ws = weekRangeOf(inv.date).start
    const list = buckets.get(ws) ?? []
    list.push(inv)
    buckets.set(ws, list)
  }
  const keys = [...new Set(days.map((iso) => weekRangeOf(iso).start))].sort()
  return keys.map((ws) => {
    const list = buckets.get(ws) ?? []
    const d = parseISODate(ws)
    return {
      iso: ws,
      label: d.toLocaleDateString(locale, { day: '2-digit', month: 'short' }),
      value: sumAmount(list, true),
      billed: sumAmount(list),
      count: list.length,
    }
  })
}

export function lastNDays(n: number, endIso?: string) {
  const end = parseISODate(endIso ?? toISODate(new Date()))
  return Array.from({ length: n }, (_, i) => toISODate(addDays(end, i - (n - 1))))
}

export function formatPeriodLabel(period: FinancePeriod, locale: string) {
  const a = parseISODate(period.start)
  const b = parseISODate(period.end)
  if (period.mode === 'day' || period.start === period.end) {
    return a.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  return `${a.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} — ${b.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`
}

export function monthCursor(iso: string) {
  const d = parseISODate(iso)
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function csvEscape(value: string | number) {
  const s = String(value)
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function invoicesToCsv(invoices: Invoice[]) {
  const header = ['Date', 'Patient', 'Libellé', 'Montant (DA)', 'Statut']
  const rows = [...invoices]
    .sort((a, b) => b.date.localeCompare(a.date) || a.patientName.localeCompare(b.patientName))
    .map((i) => [i.date, i.patientName, i.label, i.amount, i.paid ? 'Payé' : 'Facturé'].map(csvEscape).join(';'))
  return `\uFEFF${header.join(';')}\n${rows.join('\n')}`
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function startOfCalendarMonth(year: number, month: number) {
  return startOfWeek(new Date(year, month, 1))
}
