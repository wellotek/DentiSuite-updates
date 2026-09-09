import type { Appointment, Dentist } from '../../types'
import { DAY_END_MIN, DAY_HOURS, DAY_START_MIN, dentistColumnId, dentistColumns, TIME_GUTTER_PX } from '../../lib/agenda'
import { AppointmentBlock } from './AppointmentBlock'
import { DropColumn } from './DropColumn'
import { useAgendaDrag } from './useAgendaDrag'
import { dentistName } from '../../lib/dentists'
import { DentistAvatar } from '../dentists/DentistSelect'
import { useAppStore } from '../../store/useAppStore'
import { formatHourLabel } from '../../i18n'

const HOUR_PX = 84

interface DayTimelineProps {
  appointments: Appointment[]
  dentists: Dentist[]
  now?: Date
  isToday: boolean
  onOpen: (appointment: Appointment) => void
  onMove: (id: string, patch: { time: string; dentistId?: string; practitioner?: string }) => void
}

export function DayTimeline({ appointments, dentists, now, isToday, onOpen, onMove }: DayTimelineProps) {
  const timeFormat = useAppStore((s) => s.clinic.settings?.timeFormat ?? '24h')
  const columns = dentistColumns(dentists, appointments)
  const totalHeight = TIME_GUTTER_PX + ((DAY_END_MIN - DAY_START_MIN) / 60) * HOUR_PX
  const nowTop = nowOffset(now, isToday)
  const { dragging, setDragging, preview, setPreview, clear } = useAgendaDrag()

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div
        className="z-20 grid shrink-0 border-b border-slate-200 bg-white"
        style={{ gridTemplateColumns: `72px repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        <div className="border-e border-slate-100" />
        {columns.map((col) => (
          <div key={col.id} className="border-e border-slate-100 px-3 py-3 last:border-e-0">
            <div className="flex items-center gap-2">
              <DentistAvatar dentist={col.dentist} size={28} />
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  {col.dentist ? dentistName(col.dentist) : 'Non assigné'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {appointments.filter((a) => dentistColumnId(a, dentists) === col.id).length} RDV
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `72px repeat(${columns.length}, minmax(0, 1fr))`, height: totalHeight }}
        >
          <div className="relative border-e border-slate-100">
            <div style={{ height: TIME_GUTTER_PX }} />
            {DAY_HOURS.map((hour) => (
              <div key={hour} className="relative" style={{ height: HOUR_PX }}>
                <span className="absolute -top-2 end-2 text-[11px] font-medium text-slate-500">
                  {formatHourLabel(hour, timeFormat)}
                </span>
              </div>
            ))}
          </div>

          {columns.map((col) => (
            <DropColumn
              key={col.id}
              hourPx={HOUR_PX}
              dragging={dragging}
              preview={preview?.key === col.id ? { time: preview.time } : null}
              onPreview={(time) =>
                setPreview((prev) => {
                  if (!time) return prev?.key === col.id ? null : prev
                  if (prev?.key === col.id && prev.time === time) return prev
                  return { key: col.id, time }
                })
              }
              onDropAt={(time) => {
                if (!dragging) return
                onMove(dragging.id, {
                  time,
                  dentistId: col.id === 'unassigned' ? undefined : col.id,
                  practitioner: col.dentist ? dentistName(col.dentist) : '',
                })
                clear()
              }}
            >
              {appointments
                .filter((a) => dentistColumnId(a, dentists) === col.id)
                .map((apt) => (
                  <AppointmentBlock
                    key={apt.id}
                    appointment={apt}
                    dentist={dentists.find((d) => d.id === apt.dentistId) ?? col.dentist}
                    hourPx={HOUR_PX}
                    gutterTop={TIME_GUTTER_PX}
                    onOpen={onOpen}
                    onDragStartApt={setDragging}
                    onDragEndApt={clear}
                    dragActive={dragging != null && dragging.id !== apt.id}
                  />
                ))}
            </DropColumn>
          ))}

          {nowTop !== null && (
            <div
              className="pointer-events-none absolute inset-x-0 z-10 flex items-center ps-[72px]"
              style={{ top: nowTop + TIME_GUTTER_PX }}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="h-px flex-1 bg-red-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function nowOffset(now: Date | undefined, isToday: boolean) {
  if (!now || !isToday) return null
  const minutes = now.getHours() * 60 + now.getMinutes()
  if (minutes < DAY_START_MIN || minutes > DAY_END_MIN) return null
  return ((minutes - DAY_START_MIN) / 60) * HOUR_PX
}
