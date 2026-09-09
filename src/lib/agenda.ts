import type { Appointment, AppointmentCategory, AppointmentStatus, Dentist } from '../types'

export const DAY_START_MIN = 8 * 60
export const DAY_END_MIN = 19 * 60
export const DAY_HOURS = Array.from({ length: 11 }, (_, i) => 8 + i)
export const TIME_SNAP_MIN = 15
export const TIME_GUTTER_PX = 20

export type AgendaView = 'day' | 'week'

export const CATEGORY_LABEL: Record<AppointmentCategory, string> = {
  urgence: 'Urgence',
  consultation: 'Consultation',
  controle: 'Contrôle',
  soin: 'Soin',
  extraction: 'Extraction',
  prothese: 'Prothèse',
}

export function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number) {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

export function startOfWeek(d: Date) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

export function weekDays(anchor: Date) {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function minutesToTime(total: number) {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function snapAppointmentStart(startMin: number, durationMin: number, step = TIME_SNAP_MIN) {
  const snapped = Math.round(startMin / step) * step
  const maxStart = Math.max(DAY_START_MIN, DAY_END_MIN - Math.max(step, Math.min(durationMin, 60)))
  return Math.min(maxStart, Math.max(DAY_START_MIN, snapped))
}

export function timeFromColumnY(offsetY: number, hourPx: number, durationMin: number) {
  const raw = DAY_START_MIN + (offsetY / hourPx) * 60
  return minutesToTime(snapAppointmentStart(raw, durationMin))
}

export function dentistColumnId(apt: Appointment, dentists: Dentist[]) {
  if (apt.dentistId) return apt.dentistId
  const match = dentists.find((d) => apt.practitioner.toLowerCase().includes(d.lastName.toLowerCase()))
  return match?.id ?? 'unassigned'
}

export function dentistColumns(dentists: Dentist[], appointments: Appointment[]) {
  const cols: { id: string; dentist?: Dentist }[] = dentists.map((d) => ({ id: d.id, dentist: d }))
  const hasUnassigned = appointments.some((a) => dentistColumnId(a, dentists) === 'unassigned')
  if (hasUnassigned || dentists.length === 0) cols.push({ id: 'unassigned' })
  return cols
}

export function parseFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}

export function inferCategory(motif: string): AppointmentCategory {
  const t = motif.toLowerCase()
  if (t.includes('urgence') || t.includes('douleur')) return 'urgence'
  if (t.includes('extract')) return 'extraction'
  if (t.includes('contrôle') || t.includes('controle') || t.includes('détartrage') || t.includes('detartrage')) {
    return 'controle'
  }
  if (t.includes('couronne') || t.includes('bridge') || t.includes('facette') || t.includes('prothèse') || t.includes('prothese')) {
    return 'prothese'
  }
  if (t.includes('consult')) return 'consultation'
  return 'soin'
}

export function appointmentLayout(apt: Appointment, hourPx: number) {
  const start = timeToMinutes(apt.time)
  const top = ((start - DAY_START_MIN) / 60) * hourPx
  const height = Math.max((apt.durationMin / 60) * hourPx - 4, 54)
  return { top, height }
}

export function blockTone(apt: Appointment) {
  if (apt.status === 'annule') {
    return {
      wrap: 'bg-slate-200/90 text-slate-500 border-slate-300 line-through',
      label: 'Annulé',
    }
  }
  if (apt.status === 'termine' || apt.category === 'controle') {
    return {
      wrap: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-emerald-400/40',
      label: apt.status === 'termine' ? 'Terminé' : 'Contrôle',
    }
  }
  if (apt.category === 'urgence') {
    return {
      wrap: 'bg-gradient-to-br from-red-500 to-rose-600 text-white border-red-400/40',
      label: 'Urgence',
    }
  }
  if (apt.category === 'consultation') {
    return {
      wrap: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white border-sky-400/40',
      label: 'Consultation',
    }
  }
  if (apt.category === 'extraction') {
    return {
      wrap: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white border-rose-400/40',
      label: 'Extraction',
    }
  }
  if (apt.category === 'prothese') {
    return {
      wrap: 'bg-gradient-to-br from-amber-400 to-orange-500 text-amber-950 border-amber-300/50',
      label: 'Prothèse',
    }
  }
  return {
    wrap: 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white border-violet-400/40',
    label: 'Soin',
  }
}

export function statusCaption(status: AppointmentStatus) {
  if (status === 'en_salle') return 'En salle'
  if (status === 'confirme') return 'Confirmé'
  if (status === 'termine') return 'Terminé'
  return 'Annulé'
}

export const LEGEND = [
  { label: 'Urgence', className: 'bg-red-500' },
  { label: 'Consultation', className: 'bg-sky-500' },
  { label: 'Contrôle / Terminé', className: 'bg-emerald-500' },
  { label: 'Soin', className: 'bg-violet-500' },
  { label: 'Extraction', className: 'bg-rose-500' },
  { label: 'Prothèse', className: 'bg-amber-400' },
]
