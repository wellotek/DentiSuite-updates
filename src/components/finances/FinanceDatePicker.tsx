import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, parseISODate, toISODate, weekDays } from '../../lib/agenda'
import {
  periodForDay,
  periodForMonth,
  periodForRange,
  periodForWeek,
  startOfCalendarMonth,
  type FinanceMode,
  type FinancePeriod,
} from '../../lib/finances'
import { localeTag, useT } from '../../i18n'
import { useAppStore } from '../../store/useAppStore'

interface Props {
  period: FinancePeriod
  onChange: (period: FinancePeriod) => void
}

export function FinanceDatePicker({ period, onChange }: Props) {
  const t = useT()
  const locale = useAppStore((s) => s.clinic.settings?.locale ?? 'fr')
  const loc = localeTag(locale)
  const [open, setOpen] = useState(false)
  const [cursorYm, setCursorYm] = useState(() => {
    const d = parseISODate(period.cursor)
    return `${d.getFullYear()}-${d.getMonth()}`
  })
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const [cy, cm] = cursorYm.split('-').map(Number)
  const cursor = new Date(cy, cm, 1)

  useEffect(() => {
    const d = parseISODate(period.cursor)
    const next = `${d.getFullYear()}-${d.getMonth()}`
    setCursorYm((prev) => (prev === next ? prev : next))
  }, [period.cursor])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setRangeAnchor(null)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setRangeAnchor(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const todayIso = toISODate(new Date())
  const firstWeekday = startOfCalendarMonth(cy, cm)
  const grid = Array.from({ length: 42 }, (_, i) => addDays(firstWeekday, i))
  const weekdayLabels = weekDays(new Date()).map((d) => d.toLocaleDateString(loc, { weekday: 'narrow' }))

  const startLabel = parseISODate(period.start).toLocaleDateString(loc, {
    day: 'numeric',
    month: 'short',
  })
  const endLabel = parseISODate(period.end).toLocaleDateString(loc, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const buttonLabel =
    period.mode === 'day' || period.start === period.end
      ? parseISODate(period.cursor).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' })
      : `${startLabel} — ${endLabel}`

  function applyMode(mode: FinanceMode) {
    if (mode === 'day') onChange(periodForDay(period.cursor))
    else if (mode === 'week') onChange(periodForWeek(period.cursor))
    else onChange(periodForRange(period.start, period.end === period.start ? period.cursor : period.end))
    setRangeAnchor(null)
  }

  function pickDay(iso: string) {
    if (period.mode === 'day') {
      onChange(periodForDay(iso))
      setOpen(false)
      return
    }
    if (period.mode === 'week') {
      onChange(periodForWeek(iso))
      setOpen(false)
      return
    }
    if (!rangeAnchor) {
      setRangeAnchor(iso)
      onChange(periodForRange(iso, iso))
      return
    }
    onChange(periodForRange(rangeAnchor, iso))
    setRangeAnchor(null)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <CalendarDays className="h-3.5 w-3.5 text-clinic-700" />
        {buttonLabel}
      </button>
      {open && (
        <div className="absolute end-0 z-30 mt-1 w-[300px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex rounded-lg bg-slate-100 p-0.5">
            {(['day', 'week', 'range'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => applyMode(mode)}
                className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold ${
                  period.mode === mode ? 'bg-white text-clinic-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                {mode === 'day' ? t('common.day') : mode === 'week' ? t('common.week') : t('finances.range')}
              </button>
            ))}
          </div>
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-50"
              onClick={() => setCursorYm(`${cm === 0 ? cy - 1 : cy}-${cm === 0 ? 11 : cm - 1}`)}
              aria-label="Mois précédent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold capitalize text-slate-800">
              {cursor.toLocaleDateString(loc, { month: 'long', year: 'numeric' })}
            </p>
            <button
              type="button"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-50"
              onClick={() => setCursorYm(`${cm === 11 ? cy + 1 : cy}-${cm === 11 ? 0 : cm + 1}`)}
              aria-label="Mois suivant"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase text-slate-400">
            {weekdayLabels.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-0.5">
            {grid.map((day) => {
              const iso = toISODate(day)
              const inMonth = day.getMonth() === cm
              const isToday = iso === todayIso
              const inRange = iso >= period.start && iso <= period.end
              const isEdge = iso === period.start || iso === period.end
              const isAnchor = rangeAnchor === iso
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pickDay(iso)}
                  className={`h-8 rounded-md text-xs font-medium ${
                    isEdge || isAnchor
                      ? 'bg-clinic-700 text-white'
                      : inRange
                        ? 'bg-clinic-50 text-clinic-900'
                        : inMonth
                          ? 'text-slate-700 hover:bg-slate-100'
                          : 'text-slate-300 hover:bg-slate-50'
                  } ${isToday && !isEdge ? 'ring-1 ring-clinic-400' : ''}`}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Quick
              label={t('common.today')}
              onClick={() => {
                onChange(periodForDay(todayIso))
                setOpen(false)
              }}
            />
            <Quick
              label={t('finances.thisWeek')}
              onClick={() => {
                onChange(periodForWeek(todayIso))
                setOpen(false)
              }}
            />
            <Quick
              label={t('finances.thisMonth')}
              onClick={() => {
                onChange(periodForMonth(todayIso))
                setOpen(false)
              }}
            />
          </div>
          {period.mode === 'range' && (
            <p className="mt-2 text-[10px] text-slate-400">{t('finances.rangeHint')}</p>
          )}
        </div>
      )}
    </div>
  )
}

function Quick({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-clinic-50 hover:text-clinic-800"
    >
      {label}
    </button>
  )
}
