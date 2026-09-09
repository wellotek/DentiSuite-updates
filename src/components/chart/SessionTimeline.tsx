import { useState } from 'react'
import { Pencil, Plus, Stethoscope, Trash2 } from 'lucide-react'
import type { PatientSession } from '../../types'
import { SessionModal } from './SessionModal'
import { useT } from '../../i18n'

interface Props {
  patientId: string
  sessions: PatientSession[]
  onAdd: (draft: Omit<PatientSession, 'id'>) => void
  onUpdate: (id: string, draft: Omit<PatientSession, 'id'>) => void
  onDelete: (id: string) => void
}

export function SessionTimeline({ patientId, sessions, onAdd, onUpdate, onDelete }: Props) {
  const t = useT()
  const [editing, setEditing] = useState<PatientSession | null | 'new'>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const ordered = [...sessions].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{t('chart.sessions')}</h2>
          <p className="text-xs text-slate-500">{t('chart.sessionsHint')}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-clinic-700 px-3 py-2 text-xs font-semibold text-white hover:bg-clinic-800"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('chart.sessionNew')}
        </button>
      </div>

      {ordered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          {t('chart.sessionsEmpty')}
        </p>
      ) : (
        <ol className="relative space-y-4 border-s-2 border-clinic-100 ps-5">
          {ordered.map((session) => (
            <li key={session.id} className="relative">
              <span className="absolute -start-[27px] mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-clinic-700 text-white">
                <Stethoscope className="h-3 w-3" />
              </span>
              <article className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {new Date(`${session.date}T${session.time || '00:00'}`).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}{' '}
                      · {session.time}
                    </p>
                    {session.teeth.length > 0 && (
                      <p className="mt-1 font-mono text-xs text-clinic-800">
                        {t('chart.teeth')}: {session.teeth.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {confirmId === session.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(session.id)
                            setConfirmId(null)
                          }}
                          className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white"
                        >
                          {t('common.delete')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="rounded-md px-2 py-1 text-[11px] text-slate-500"
                        >
                          {t('common.cancel')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditing(session)}
                          className="rounded-md p-1.5 text-clinic-800 hover:bg-white"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(session.id)}
                          className="rounded-md p-1.5 text-red-600 hover:bg-white"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {session.acts && (
                  <p className="mt-2 text-sm text-slate-800">
                    <span className="font-medium">{t('chart.acts')}: </span>
                    {session.acts}
                  </p>
                )}
                {session.notes && (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{session.notes}</p>
                )}
                {session.prescription && (
                  <div className="mt-3 rounded-lg border border-clinic-100 bg-white px-3 py-2 text-sm text-clinic-900">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-clinic-600">
                      {t('chart.prescription')}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{session.prescription}</p>
                  </div>
                )}
              </article>
            </li>
          ))}
        </ol>
      )}

      {editing && (
        <SessionModal
          patientId={patientId}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(draft) => {
            if (editing === 'new') onAdd(draft)
            else onUpdate(editing.id, draft)
            setEditing(null)
          }}
        />
      )}
    </section>
  )
}
