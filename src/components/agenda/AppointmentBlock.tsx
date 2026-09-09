import { Phone } from 'lucide-react'
import type { Appointment, Dentist } from '../../types'
import { appointmentLayout, blockTone, statusCaption } from '../../lib/agenda'
import { dentistInitials } from '../../lib/dentists'
import { useEffect, useRef } from 'react'

interface AppointmentBlockProps {
  appointment: Appointment
  dentist?: Dentist
  hourPx: number
  compact?: boolean
  gutterTop?: number
  onOpen?: (appointment: Appointment) => void
  onDragStartApt?: (appointment: Appointment) => void
  onDragEndApt?: () => void
  dragActive?: boolean
}

export function AppointmentBlock({
  appointment,
  dentist,
  hourPx,
  compact = false,
  gutterTop = 0,
  onOpen,
  onDragStartApt,
  onDragEndApt,
  dragActive = false,
}: AppointmentBlockProps) {
  const { top, height } = appointmentLayout(appointment, hourPx)
  const tone = blockTone(appointment)
  const inChair = appointment.status === 'en_salle'
  const dragged = useRef(false)
  const dragTimer = useRef<number>(0)

  useEffect(() => {
    return () => window.clearTimeout(dragTimer.current)
  }, [])

  return (
    <article
      draggable
      onDragStart={(e) => {
        dragged.current = true
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('application/x-dentisuite-apt', appointment.id)
        onDragStartApt?.(appointment)
      }}
      onDragEnd={() => {
        onDragEndApt?.()
        window.clearTimeout(dragTimer.current)
        dragTimer.current = window.setTimeout(() => {
          dragged.current = false
        }, 0)
      }}
      onClick={() => {
        if (dragged.current) return
        onOpen?.(appointment)
      }}
      className={`absolute inset-x-1 z-[1] cursor-grab overflow-hidden rounded-lg border px-2 py-1 shadow-sm active:cursor-grabbing ${tone.wrap} ${
        inChair ? 'ring-2 ring-white/70' : ''
      } ${dragActive ? 'pointer-events-none' : ''}`}
      style={{ top: top + gutterTop, height }}
      title={`${appointment.patientName} · ${appointment.patientPhone} · ${appointment.motif} — glisser pour déplacer`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className={`min-w-0 truncate font-semibold leading-tight ${compact ? 'text-[11px]' : 'text-xs'}`}>
          {appointment.patientName}
        </p>
        {dentist && (
          <span
            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white shadow-sm"
            style={{ background: dentist.color }}
            title={`Dr. ${dentist.firstName} ${dentist.lastName}`}
          >
            {dentistInitials(dentist)}
          </span>
        )}
      </div>
      <p className={`flex items-center gap-1 truncate font-medium leading-tight opacity-95 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
        <Phone className="h-3 w-3 shrink-0" />
        {appointment.patientPhone || '—'}
      </p>
      <p className={`truncate leading-tight opacity-90 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
        {appointment.motif}
      </p>
      {!compact && height > 72 && (
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-80">
          {appointment.time} · {statusCaption(appointment.status)}
        </p>
      )}
    </article>
  )
}
