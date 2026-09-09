import { useRef, type DragEvent, type ReactNode, type RefObject } from 'react'
import type { Appointment } from '../../types'
import { appointmentLayout, DAY_HOURS, TIME_GUTTER_PX, timeFromColumnY } from '../../lib/agenda'

interface DropColumnProps {
  hourPx: number
  dragging: Appointment | null
  preview: { time: string } | null
  onPreview: (time: string | null) => void
  onDropAt: (time: string) => void
  children: ReactNode
  gridRef?: RefObject<HTMLDivElement | null>
}

export function DropColumn({ hourPx, dragging, preview, onPreview, onDropAt, children }: DropColumnProps) {
  const lastPreview = useRef<string | null>(null)

  function offsetY(e: DragEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return e.clientY - rect.top - TIME_GUTTER_PX
  }

  function emitPreview(time: string | null) {
    if (lastPreview.current === time) return
    lastPreview.current = time
    onPreview(time)
  }

  return (
    <div
      className="relative border-e border-slate-100 last:border-e-0"
      onDragOver={(e) => {
        if (!dragging) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        emitPreview(timeFromColumnY(offsetY(e), hourPx, dragging.durationMin))
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) emitPreview(null)
      }}
      onDrop={(e) => {
        e.preventDefault()
        lastPreview.current = null
        if (!dragging) return
        onDropAt(timeFromColumnY(offsetY(e), hourPx, dragging.durationMin))
        onPreview(null)
      }}
    >
      <div style={{ height: TIME_GUTTER_PX }} />
      {DAY_HOURS.map((hour) => (
        <div key={hour} className="border-b border-slate-100" style={{ height: hourPx }}>
          <div className="h-1/2 border-b border-dashed border-slate-100" />
        </div>
      ))}
      {dragging && preview && (
        <div
          className="pointer-events-none absolute inset-x-1 z-[2] rounded-lg border-2 border-dashed border-clinic-500 bg-clinic-100/70"
          style={{
            top: appointmentLayout({ ...dragging, time: preview.time }, hourPx).top + TIME_GUTTER_PX,
            height: appointmentLayout(dragging, hourPx).height,
          }}
        />
      )}
      {children}
    </div>
  )
}
