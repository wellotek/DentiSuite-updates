import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { DayTimeline } from '../components/agenda/DayTimeline'
import { WeekTimeline } from '../components/agenda/WeekTimeline'
import { NewAppointmentModal } from '../components/agenda/NewAppointmentModal'
import { AgendaDatePicker } from '../components/agenda/AgendaDatePicker'
import {
  addDays,
  LEGEND,
  parseISODate,
  toISODate,
  weekDays,
  type AgendaView,
} from '../lib/agenda'
import { dentistName } from '../lib/dentists'
import { useT } from '../i18n'
import type { Appointment, AppointmentDraft } from '../types'
import { isCloudClinicMode } from '../cloud/cloudClinicMode'

export function Agenda() {
  const t = useT()
  const appointments = useAppStore((s) => s.clinic.appointments)
  const patients = useAppStore((s) => s.clinic.patients)
  const dentists = useAppStore((s) => s.clinic.dentists ?? [])
  const addAppointment = useAppStore((s) => s.addAppointment)
  const addAppointmentCloud = useAppStore((s) => s.addAppointmentCloud)
  const updateAppointment = useAppStore((s) => s.updateAppointment)
  const deleteAppointment = useAppStore((s) => s.deleteAppointment)
  const [view, setView] = useState<AgendaView>('day')
  const [selected, setSelected] = useState(() => toISODate(new Date()))
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const selectedDate = parseISODate(selected)
  const todayIso = toISODate(new Date())
  const days = weekDays(selectedDate)

  const resolved = useMemo(
    () =>
      appointments.map((apt) => ({
        ...apt,
        patientPhone:
          apt.patientPhone ||
          patients.find((p) => p.id === apt.patientId)?.phone ||
          '',
      })),
    [appointments, patients],
  )

  const dayAppointments = resolved.filter((a) => a.date === selected)
  const title = selectedDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const weekLabel = `${days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — ${days[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`

  function shift(step: number) {
    setSelected(toISODate(addDays(selectedDate, view === 'week' ? step * 7 : step)))
  }

  async function saveDraft(draft: AppointmentDraft) {
    if (editing) {
      updateAppointment(editing.id, draft)
      setEditing(null)
    } else {
      if (isCloudClinicMode()) await addAppointmentCloud(draft)
      else addAppointment(draft)
      setOpen(false)
    }
    setSelected(draft.date)
  }

  function moveAppointment(
    id: string,
    patch: { time: string; date?: string; dentistId?: string; practitioner?: string },
  ) {
    const current = appointments.find((a) => a.id === id)
    if (!current) return
    const dentist = dentists.find((d) => d.id === patch.dentistId)
    updateAppointment(id, {
      time: patch.time,
      date: patch.date ?? current.date,
      dentistId: patch.dentistId === undefined && patch.practitioner === undefined ? current.dentistId : patch.dentistId,
      practitioner:
        patch.practitioner !== undefined
          ? patch.practitioner
          : dentist
            ? dentistName(dentist)
            : current.practitioner,
    })
  }

  return (
    <div className="relative isolate flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('agenda.title')}</h1>
          <p className="mt-1 capitalize text-sm text-slate-500">{view === 'day' ? title : `${t('agenda.weekOf')} ${weekLabel}`}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-clinic-700 px-3 py-2 text-xs font-semibold text-white hover:bg-clinic-800"
          >
            <Plus className="h-4 w-4" />
            {t('agenda.new')}
          </button>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            {(['day', 'week'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  view === mode ? 'bg-clinic-700 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {mode === 'day' ? t('common.day') : t('common.week')}
              </button>
            ))}
          </div>

          <AgendaDatePicker value={selected} view={view} onChange={setSelected} />

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-50"
              aria-label={t('agenda.prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelected(todayIso)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-clinic-800 hover:bg-clinic-50"
            >
              {t('common.today')}
            </button>
            <button
              type="button"
              onClick={() => shift(1)}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-50"
              aria-label={t('agenda.next')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <ul className="flex shrink-0 flex-wrap gap-3">
        {LEGEND.map((item) => (
          <li key={item.label} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${item.className}`} />
            {item.label}
          </li>
        ))}
      </ul>

      <div className="min-h-0 flex-1">
        {view === 'day' ? (
          <DayTimeline
            appointments={dayAppointments}
            dentists={dentists}
            now={now}
            isToday={selected === todayIso}
            onOpen={setEditing}
            onMove={moveAppointment}
          />
        ) : (
          <WeekTimeline
            days={days}
            appointments={resolved}
            dentists={dentists}
            selectedIso={selected}
            onSelectDay={(iso) => {
              setSelected(iso)
              setView('day')
            }}
            onOpen={setEditing}
            onMove={moveAppointment}
          />
        )}
      </div>

      {(open || editing) && (
        <NewAppointmentModal
          patients={patients}
          dentists={dentists}
          defaultDate={selected}
          appointment={editing}
          onClose={() => {
            setOpen(false)
            setEditing(null)
          }}
          onSave={saveDraft}
          onDelete={
            editing
              ? () => {
                  deleteAppointment(editing.id)
                  setEditing(null)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
