import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, MapPin, Phone } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { Odontogram } from '../components/odontogram/Odontogram'
import { ActsPalette } from '../components/care/ActsPalette'
import { CareTable } from '../components/care/CareTable'
import { SessionTimeline } from '../components/chart/SessionTimeline'
import { PatientImaging } from '../components/chart/PatientImaging'
import { patientHasAllergies } from '../data/teeth'
import { dentistName } from '../lib/dentists'
import { useT } from '../i18n'
import type { ActItem, CareStatus } from '../types'

type ChartTab = 'soins' | 'seances' | 'imagerie'

export function PatientChart() {
  const t = useT()
  const { id } = useParams()
  const clinic = useAppStore((s) => s.clinic)
  const applyCareAct = useAppStore((s) => s.applyCareAct)
  const updateTreatment = useAppStore((s) => s.updateTreatment)
  const deleteTreatment = useAppStore((s) => s.deleteTreatment)
  const toggleActFavorite = useAppStore((s) => s.toggleActFavorite)
  const addSession = useAppStore((s) => s.addSession)
  const updateSession = useAppStore((s) => s.updateSession)
  const deleteSession = useAppStore((s) => s.deleteSession)
  const addMedia = useAppStore((s) => s.addMedia)
  const updateMedia = useAppStore((s) => s.updateMedia)
  const deleteMedia = useAppStore((s) => s.deleteMedia)
  const [selectedTeeth, setSelectedTeeth] = useState<string[]>([])
  const [careStatus, setCareStatus] = useState<CareStatus>('a_faire')
  const [tab, setTab] = useState<ChartTab>('soins')

  const patient = clinic.patients.find((p) => p.id === id)
  const catalog = clinic.actCatalog ?? []
  const treatments = useMemo(
    () =>
      (clinic.treatments ?? [])
        .filter((line) => line.patientId === id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [clinic.treatments, id],
  )
  const sessions = useMemo(
    () => (clinic.sessions ?? []).filter((s) => s.patientId === id),
    [clinic.sessions, id],
  )
  const media = useMemo(
    () => (clinic.mediaFiles ?? []).filter((m) => m.patientId === id),
    [clinic.mediaFiles, id],
  )

  if (!patient) return <Navigate to="/patients" replace />

  const allergy = patientHasAllergies(patient.antecedents, patient.hasAllergies)
  const dentist = clinic.dentists.find((d) => d.id === patient.dentistId)
  const patientName = `${patient.firstName} ${patient.lastName}`

  function applyAct(
    act: ActItem,
    extra?: { tooth?: string; comment?: string; date?: string; status?: CareStatus; cost?: number },
  ) {
    applyCareAct({
      patientId: patient!.id,
      patientName,
      teeth: extra?.tooth ? [extra.tooth] : selectedTeeth,
      act,
      careStatus: extra?.status ?? careStatus,
      comment: extra?.comment,
      date: extra?.date,
      cost: extra?.cost,
    })
    if (!extra?.tooth) setSelectedTeeth([])
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link
        to="/patients"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-clinic-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('chart.back')}
      </Link>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h1 className="text-2xl font-semibold text-slate-900">
          {patient.firstName} {patient.lastName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t('chart.file')} · {patient.age} {t('patients.years')}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
          <Info label={t('patients.phone')} value={patient.phone} icon={<Phone className="h-3.5 w-3.5 text-slate-400" />} />
          <Info label={t('patients.address')} value={patient.address || '—'} icon={<MapPin className="h-3.5 w-3.5 text-slate-400" />} />
          <Info label={t('patients.dentist')} value={dentist ? dentistName(dentist) : t('form.unassigned')} />
          <Info label={t('patients.history')} value={patient.antecedents} />
        </div>
        {allergy && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Alerte allergies / risque médical</p>
              <p className="mt-0.5 text-red-700">{patient.antecedents}</p>
            </div>
          </div>
        )}
      </section>

      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {(
          [
            ['soins', t('chart.tabCare')],
            ['seances', t('chart.tabSessions')],
            ['imagerie', t('chart.tabImaging')],
          ] as const
        ).map(([idTab, label]) => (
          <button
            key={idTab}
            type="button"
            onClick={() => setTab(idTab)}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${
              tab === idTab ? 'bg-clinic-700 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'soins' && (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <div className="min-w-0 flex-1">
              <Odontogram
                teeth={patient.teeth ?? {}}
                selectedTeeth={selectedTeeth}
                onToggleTooth={(tooth) =>
                  setSelectedTeeth((current) =>
                    current.includes(tooth) ? current.filter((n) => n !== tooth) : [...current, tooth],
                  )
                }
                onClearSelection={() => setSelectedTeeth([])}
              />
            </div>
            <ActsPalette
              catalog={catalog}
              careStatus={careStatus}
              onCareStatus={setCareStatus}
              selectedCount={selectedTeeth.length}
              onApply={(act) => applyAct(act)}
              onToggleFavorite={toggleActFavorite}
            />
          </div>
          <CareTable
            treatments={treatments}
            catalog={catalog}
            defaultStatus={careStatus}
            onAdd={({ date, tooth, act, careStatus: status, comment, cost }) =>
              applyAct(act, { tooth, comment, date, status, cost })
            }
            onUpdate={(treatmentId, patch) => updateTreatment(treatmentId, patch)}
            onDelete={(treatmentId) => deleteTreatment(treatmentId)}
          />
        </>
      )}

      {tab === 'seances' && (
        <SessionTimeline
          patientId={patient.id}
          sessions={sessions}
          onAdd={addSession}
          onUpdate={(sessionId, draft) => updateSession(sessionId, draft)}
          onDelete={deleteSession}
        />
      )}

      {tab === 'imagerie' && (
        <PatientImaging
          patientId={patient.id}
          media={media}
          onAdd={addMedia}
          onUpdate={updateMedia}
          onDelete={deleteMedia}
        />
      )}
    </div>
  )
}

function Info({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: ReactNode
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 font-medium text-slate-800">
        {icon}
        {value}
      </p>
    </div>
  )
}
