import { ArrowLeft, UserRound } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Patient } from '../../types'
import { displayAge, formatBirthDateFr } from '../../lib/age'
import { useT } from '../../i18n'
import { patientChartPath, readPatientNavState } from '../../lib/patientNav'

export function ContextBackButton({
  fallbackTo = '/patients',
  fallbackLabel,
}: {
  fallbackTo?: string
  fallbackLabel?: string
}) {
  const t = useT()
  const location = useLocation()
  const navigate = useNavigate()
  const nav = readPatientNavState(location)
  const to = nav.returnTo || fallbackTo
  const label =
    nav.returnLabel || (nav.fromPatientId ? t('nav.backToPatient') : fallbackLabel || t('chart.back'))

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-clinic-800"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  )
}

export function PatientContextBar({
  patient,
  showOpenChart = true,
  compact = false,
}: {
  patient: Pick<Patient, 'id' | 'firstName' | 'lastName' | 'phone' | 'age' | 'birthDate'>
  showOpenChart?: boolean
  compact?: boolean
}) {
  const t = useT()
  const location = useLocation()
  const age = displayAge(patient)
  const birth = formatBirthDateFr(patient.birthDate)
  const meta = [`${age} ${t('patients.years')}`, birth || null, patient.phone || null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-clinic-100 bg-clinic-50/70 px-4 ${
        compact ? 'py-2.5' : 'py-3'
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clinic-700 text-white">
          <UserRound className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-clinic-700">
            {t('nav.patientContext')}
          </p>
          <p className="truncate text-sm font-semibold text-slate-900">
            {patient.firstName} {patient.lastName}
          </p>
          <p className="truncate text-xs text-slate-500">{meta}</p>
        </div>
      </div>
      {showOpenChart ? (
        <Link
          to={patientChartPath(patient.id)}
          state={{
            returnTo: `${location.pathname}${location.search}`,
          }}
          className="shrink-0 rounded-lg border border-clinic-200 bg-white px-3 py-1.5 text-xs font-medium text-clinic-800 hover:bg-clinic-50"
        >
          {t('nav.openPatientChart')}
        </Link>
      ) : null}
    </div>
  )
}

/** Resolve patient context from location state or query param — never invents a patient. */
export function useOptionalPatientContext(patients: Patient[]) {
  const location = useLocation()
  const nav = readPatientNavState(location)
  const params = new URLSearchParams(location.search)
  const qid = params.get('patientId') || undefined
  const id = nav.fromPatientId || qid
  if (!id) return { patient: undefined as Patient | undefined, nav }
  const patient = patients.find((p) => p.id === id && !p.archivedAt)
  return { patient, nav }
}
