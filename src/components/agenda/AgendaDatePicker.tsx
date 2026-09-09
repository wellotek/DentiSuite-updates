import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, parseISODate, startOfWeek, toISODate, weekDays, type AgendaView } from '../../lib/agenda'
import { localeTag } from '../../i18n'
import { useAppStore } from '../../store/useAppStore'

interface AgendaDatePickerProps {
  value: string
  view: AgendaView
  onChange: (iso: string) => void
}

export function AgendaDatePicker({ value, view, onChange }: AgendaDatePickerProps) {
  const locale = useAppStore((s) => s.clinic.settings?.locale ?? 'fr')
  const loc = localeTag(locale)
  const selected = parseISODate(value)
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1))
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const next = parseISODate(value)
    const year = next.getFullYear()
    const month = next.getMonth()
    setCursor((prev) =>
      prev.getFullYear() === year && prev.getMonth() === month ? prev : new Date(year, month, 1),
    )
  }, [value])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const todayIso = toISODate(new Date())
  const week = weekDays(selected)
  const weekStart = toISODate(week[0])
  const weekEnd = toISODate(week[6])
  const label = selected.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' })

  const firstWeekday = startOfWeek(cursor)
  const grid = Array.from({ length: 42 }, (_, i) => addDays(firstWeekday, i))
  const weekdayLabels = weekDays(new Date()).map((d) =>
    d.toLocaleDateString(loc, { weekday: 'narrow' }),
  )

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
        {label}
      </button>
      {open && (
        <div className="absolute end-0 z-30 mt-1 w-[272px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-50"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
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
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
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
              const inMonth = day.getMonth() === cursor.getMonth()
              const isToday = iso === todayIso
              const isSelected = iso === value
              const inWeek = view === 'week' && iso >= weekStart && iso <= weekEnd
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso)
                    setOpen(false)
                  }}
                  className={`h-8 rounded-md text-xs font-medium ${
                    isSelected
                      ? 'bg-clinic-700 text-white'
                      : inWeek
                        ? 'bg-clinic-50 text-clinic-900'
                        : inMonth
                          ? 'text-slate-700 hover:bg-slate-100'
                          : 'text-slate-300 hover:bg-slate-50'
                  } ${isToday && !isSelected ? 'ring-1 ring-clinic-400' : ''}`}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
