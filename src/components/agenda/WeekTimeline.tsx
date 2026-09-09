import type { Appointment, Dentist } from '../../types'
import { DAY_HOURS, TIME_GUTTER_PX, toISODate } from '../../lib/agenda'
import { AppointmentBlock } from './AppointmentBlock'
import { DropColumn } from './DropColumn'
import { useAgendaDrag } from './useAgendaDrag'
import { useAppStore } from '../../store/useAppStore'
import { formatHourLabel, localeTag } from '../../i18n'

const HOUR_PX = 68

interface WeekTimelineProps {
  days: Date[]
  appointments: Appointment[]
  dentists: Dentist[]
  selectedIso: string
  onSelectDay: (iso: string) => void
  onOpen: (appointment: Appointment) => void
  onMove: (id: string, patch: { date: string; time: string }) => void
}

export function WeekTimeline({
  days,
  appointments,
  dentists,
  selectedIso,
  onSelectDay,
  onOpen,
  onMove,
}: WeekTimelineProps) {
  const settings = useAppStore((s) => s.clinic.settings)
  const loc = localeTag(settings.locale)
  const totalHeight = TIME_GUTTER_PX + DAY_HOURS.length * HOUR_PX
  const { dragging, setDragging, preview, setPreview, clear } = useAgendaDrag()

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div
        className="z-20 grid shrink-0 border-b border-slate-200 bg-white"
        style={{ gridTemplateColumns: `64px repeat(7, minmax(140px, 1fr))` }}
      >
        <div className="border-e border-slate-100" />
        {days.map((day) => {
          const iso = toISODate(day)
          const active = iso === selectedIso
          const count = appointments.filter((a) => a.date === iso).length
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay(iso)}
              className={`border-e border-slate-100 px-2 py-3 text-start last:border-e-0 ${
                active ? 'bg-clinic-50' : 'hover:bg-slate-50'
              }`}
            >
              <p className="text-[11px] font-medium capitalize text-slate-500">
                {day.toLocaleDateString(loc, { weekday: 'short' })}
              </p>
              <p className={`text-lg font-semibold leading-none ${active ? 'text-clinic-800' : 'text-slate-900'}`}>
                {day.getDate()}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">{count} RDV</p>
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `64px repeat(7, minmax(140px, 1fr))`, height: totalHeight }}
        >
          <div className="relative border-e border-slate-100">
            <div style={{ height: TIME_GUTTER_PX }} />
            {DAY_HOURS.map((hour) => (
              <div key={hour} className="relative" style={{ height: HOUR_PX }}>
                <span className="absolute -top-2 end-1.5 text-[10px] font-medium text-slate-500">
                  {formatHourLabel(hour, settings.timeFormat)}
                </span>
              </div>
            ))}
          </div>
          {days.map((day) => {
            const iso = toISODate(day)
            return (
              <DropColumn
                key={iso}
                hourPx={HOUR_PX}
                dragging={dragging}
                preview={preview?.key === iso ? { time: preview.time } : null}
                onPreview={(time) =>
                  setPreview((prev) => {
                    if (!time) return prev?.key === iso ? null : prev
                    if (prev?.key === iso && prev.time === time) return prev
                    return { key: iso, time }
                  })
                }
                onDropAt={(time) => {
                  if (!dragging) return
                  onMove(dragging.id, { date: iso, time })
                  clear()
                }}
              >
                {appointments
                  .filter((a) => a.date === iso)
                  .map((apt) => (
                    <AppointmentBlock
                      key={apt.id}
                      appointment={apt}
                      dentist={dentists.find((d) => d.id === apt.dentistId)}
                      hourPx={HOUR_PX}
                      gutterTop={TIME_GUTTER_PX}
                      compact
                      onOpen={onOpen}
                      onDragStartApt={setDragging}
                      onDragEndApt={clear}
                      dragActive={dragging != null && dragging.id !== apt.id}
                    />
                  ))}
              </DropColumn>
            )
          })}
        </div>
      </div>
    </div>
  )
}
