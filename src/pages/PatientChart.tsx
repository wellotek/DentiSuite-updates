import { useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarPlus,
  FilePlus2,
  MapPin,
  Pencil,
  Phone,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { Odontogram } from '../components/odontogram/Odontogram'
import { ActsPalette } from '../components/care/ActsPalette'
import { CareTable } from '../components/care/CareTable'
import { SessionTimeline } from '../components/chart/SessionTimeline'
import { PatientImaging } from '../components/chart/PatientImaging'
import { DentistSelect } from '../components/dentists/DentistSelect'
import { PrescriptionEditor } from '../components/prescriptions/PrescriptionEditor'
import { NewAppointmentModal } from '../components/agenda/NewAppointmentModal'
import { ProsthesisModal } from '../components/prostheses/ProsthesisModal'
import { patientHasAllergies } from '../data/teeth'
import { dentistName } from '../lib/dentists'
import { localeTag, useT } from '../i18n'
import type { ActItem, CareStatus, Prescription, PrescriptionDraft } from '../types'
import { computeAgeFromBirthDate, displayAge } from '../lib/age'
import { ContextBackButton, PatientContextBar } from '../components/patients/PatientContextBar'
import { openFromPatient } from '../lib/patientNav'
import { useToast } from '../components/ui/Toast'
import { emptyPrescriptionDraft } from '../lib/prescriptions'
import { toISODate } from '../lib/agenda'
import { isCloudClinicMode } from '../cloud/cloudClinicMode'
import { CloudClientError, cloudErrorLabel } from '../cloud/errors'
import { prescriptionPrintContextFromClinic, printPrescription } from '../lib/prescriptionReport'

type ChartTab = 'soins' | 'seances' | 'imagerie'
type ChartModal = 'rx' | 'appointment' | 'prosthesis' | null

export function PatientChart() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const { id } = useParams()
  const clinic = useAppStore((s) => s.clinic)
  const updatePatient = useAppStore((s) => s.updatePatient)
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
  const addPrescription = useAppStore((s) => s.addPrescription)
  const addAppointment = useAppStore((s) => s.addAppointment)
  const addAppointmentCloud = useAppStore((s) => s.addAppointmentCloud)
  const addProsthesis = useAppStore((s) => s.addProsthesis)
  const [selectedTeeth, setSelectedTeeth] = useState<string[]>([])
  const [careStatus, setCareStatus] = useState<CareStatus>('a_faire')
  const [tab, setTab] = useState<ChartTab>('soins')
  const [modal, setModal] = useState<ChartModal>(null)
  const [editingInfo, setEditingInfo] = useState(false)
  const [infoDraft, setInfoDraft] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    age: '',
    phone: '',
    address: '',
    antecedents: '',
    hasAllergies: false,
    dentistId: '',
  })

  const patient = clinic.patients.find((p) => p.id === id)
  const catalog = clinic.actCatalog ?? []
  const loc = localeTag(clinic.settings?.locale ?? 'fr')
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

  const rxInitial = useMemo(() => {
    if (!patient) return emptyPrescriptionDraft()
    const d = clinic.dentists?.[0]
    const assigned = clinic.dentists?.find((x) => x.id === patient.dentistId)
    const name = `${patient.firstName} ${patient.lastName}`
    return {
      ...emptyPrescriptionDraft(),
      patientId: patient.id,
      patientName: name,
      patientBirthDate: patient.birthDate || null,
      patientAge: displayAge(patient),
      dentistId: patient.dentistId || d?.id,
      dentistName: assigned ? dentistName(assigned) : d ? dentistName(d) : '',
    }
  }, [patient, clinic.dentists])

  if (!patient) return <Navigate to="/patients" replace />

  const allergy = patientHasAllergies(patient.antecedents, patient.hasAllergies)
  const dentist = clinic.dentists.find((d) => d.id === patient.dentistId)
  const patientName = `${patient.firstName} ${patient.lastName}`
  const activePatients = clinic.patients.filter((p) => !p.archivedAt)

  function startEditInfo() {
    setInfoDraft({
      firstName: patient!.firstName,
      lastName: patient!.lastName,
      birthDate: patient!.birthDate ?? '',
      age: String(patient!.age || ''),
      phone: patient!.phone,
      address: patient!.address || '',
      antecedents: patient!.antecedents === 'Aucun' ? '' : patient!.antecedents,
      hasAllergies: Boolean(patient!.hasAllergies),
      dentistId: patient!.dentistId ?? '',
    })
    setEditingInfo(true)
  }

  async function saveInfo() {
    const antecedents = infoDraft.antecedents.trim() || 'Aucun'
    const birthDate = infoDraft.birthDate.trim() || null
    const age = computeAgeFromBirthDate(birthDate) ?? (Number(infoDraft.age) || 0)
    try {
      await updatePatient(patient!.id, {
        firstName: infoDraft.firstName.trim() || patient!.firstName,
        lastName: infoDraft.lastName.trim() || patient!.lastName,
        birthDate,
        age,
        phone: infoDraft.phone.trim(),
        address: infoDraft.address.trim(),
        antecedents,
        hasAllergies: infoDraft.hasAllergies || /allerg/i.test(antecedents),
        dentistId: infoDraft.dentistId || undefined,
        notes: patient!.notes,
      })
      setEditingInfo(false)
      toast.success(t('toast.patientSaved'))
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Échec de l’enregistrement du patient. Vérifiez la connexion et réessayez.',
      )
    }
  }

  function carePersistError(err: unknown) {
    if (err instanceof CloudClientError) return cloudErrorLabel(err)
    return err instanceof Error
      ? err.message
      : 'Échec de l’enregistrement du soin. Vérifiez la connexion et réessayez.'
  }

  async function applyAct(
    act: ActItem,
    extra?: { tooth?: string; comment?: string; date?: string; status?: CareStatus; cost?: number },
  ) {
    try {
      await applyCareAct({
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
      toast.success(t('toast.careSaved'))
    } catch (err) {
      toast.error(t('toast.careError'), carePersistError(err))
      throw err
    }
  }

  function printRx(rx: Prescription | PrescriptionDraft) {
    const full: Prescription = 'id' in rx ? rx : { ...rx, id: 'preview' }
    void printPrescription(
      full,
      clinic.settings,
      loc,
      prescriptionPrintContextFromClinic(full, clinic),
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <ContextBackButton fallbackTo="/patients" fallbackLabel={t('chart.back')} />

      <PatientContextBar patient={patient} showOpenChart={false} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setModal('rx')}
            className="group relative flex min-h-[112px] flex-col items-start justify-between overflow-hidden rounded-2xl border border-clinic-200/70 bg-gradient-to-br from-clinic-700 via-clinic-800 to-clinic-950 p-4 text-start text-white shadow-lg shadow-clinic-900/15 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/20">
              <FilePlus2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{t('dashboard.qa.rx')}</p>
              <p className="mt-0.5 text-[11px] text-clinic-100/75">{patientName}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setModal('appointment')}
            className="group relative flex min-h-[112px] flex-col items-start justify-between overflow-hidden rounded-2xl border border-clinic-200/70 bg-gradient-to-br from-clinic-700 via-clinic-800 to-clinic-950 p-4 text-start text-white shadow-lg shadow-clinic-900/15 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/20">
              <CalendarPlus className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{t('dashboard.qa.appointment')}</p>
              <p className="mt-0.5 text-[11px] text-clinic-100/75">{patientName}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setModal('prosthesis')}
            className="group relative flex min-h-[112px] flex-col items-start justify-between overflow-hidden rounded-2xl border border-clinic-200/70 bg-gradient-to-br from-clinic-700 via-clinic-800 to-clinic-950 p-4 text-start text-white shadow-lg shadow-clinic-900/15 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{t('dashboard.qa.prosthesis')}</p>
              <p className="mt-0.5 text-[11px] text-clinic-100/75">{patientName}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() =>
              navigate('/finances', {
                state: openFromPatient(patient.id, t('nav.backToPatient')),
              })
            }
            className="group relative flex min-h-[112px] flex-col items-start justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-card transition hover:-translate-y-0.5 hover:border-clinic-300 hover:shadow-md"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-clinic-50 text-clinic-800 ring-1 ring-clinic-100">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{t('nav.quickFinance')}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{patientName}</p>
            </div>
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {patient.firstName} {patient.lastName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {t('chart.file')}
              {patient.birthDate ? (
                <>
                  {' · '}
                  {t('patients.bornOn')}{' '}
                  {patient.birthDate.split('-').reverse().join('/')}
                </>
              ) : null}
              {' · '}
              {t('patients.age')} : {displayAge(patient)} {t('patients.years')}
            </p>
          </div>
          {!editingInfo ? (
            <button
              type="button"
              onClick={startEditInfo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-clinic-800 hover:bg-clinic-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              {t('chart.editInfo')}
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditingInfo(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={saveInfo}
                className="rounded-lg bg-clinic-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-clinic-800"
              >
                {t('chart.saveInfo')}
              </button>
            </div>
          )}
        </div>

        {editingInfo ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-600">
              {t('form.lastName')}
              <input
                value={infoDraft.lastName}
                onChange={(e) => setInfoDraft({ ...infoDraft, lastName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              {t('form.firstName')}
              <input
                value={infoDraft.firstName}
                onChange={(e) => setInfoDraft({ ...infoDraft, firstName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              {t('patients.birthDate')}
              <input
                type="date"
                value={infoDraft.birthDate}
                onChange={(e) => setInfoDraft({ ...infoDraft, birthDate: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              {t('patients.phone')}
              <input
                value={infoDraft.phone}
                onChange={(e) => setInfoDraft({ ...infoDraft, phone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              />
            </label>
            <label className="col-span-2 block text-xs font-medium text-slate-600">
              {t('patients.address')}
              <input
                value={infoDraft.address}
                onChange={(e) => setInfoDraft({ ...infoDraft, address: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              />
            </label>
            <div className="col-span-2">
              <DentistSelect
                dentists={clinic.dentists ?? []}
                value={infoDraft.dentistId}
                onChange={(dentistId) => setInfoDraft({ ...infoDraft, dentistId })}
                label={`${t('patients.dentist')} (${t('common.optional')})`}
                optionalLabel={t('form.unassigned')}
              />
            </div>
            <label className="col-span-2 block text-xs font-medium text-slate-600">
              {t('form.antecedents')}
              <textarea
                value={infoDraft.antecedents}
                onChange={(e) => setInfoDraft({ ...infoDraft, antecedents: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              />
            </label>
            <label className="col-span-2 flex items-start gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={infoDraft.hasAllergies}
                onChange={(e) => setInfoDraft({ ...infoDraft, hasAllergies: e.target.checked })}
                className="mt-0.5"
              />
              <span>{t('form.allergyFlag')}</span>
            </label>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
            <Info label={t('patients.phone')} value={patient.phone} icon={<Phone className="h-3.5 w-3.5 text-slate-400" />} />
            <Info label={t('patients.address')} value={patient.address || '—'} icon={<MapPin className="h-3.5 w-3.5 text-slate-400" />} />
            <Info label={t('patients.dentist')} value={dentist ? dentistName(dentist) : t('form.unassigned')} />
            <Info label={t('patients.history')} value={patient.antecedents} />
          </div>
        )}
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
            onUpdate={async (treatmentId, patch) => {
              try {
                await updateTreatment(treatmentId, patch)
                toast.success(t('toast.careSaved'))
              } catch (err) {
                toast.error(t('toast.careError'), carePersistError(err))
                throw err
              }
            }}
            onDelete={async (treatmentId) => {
              try {
                await deleteTreatment(treatmentId)
                toast.success(t('toast.careDeleted'))
              } catch (err) {
                toast.error(t('toast.careError'), carePersistError(err))
                throw err
              }
            }}
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

      {modal === 'rx' && (
        <PrescriptionEditor
          patients={activePatients}
          dentists={clinic.dentists ?? []}
          initial={rxInitial}
          onClose={() => setModal(null)}
          onSave={(draft) => {
            const saved = addPrescription({
              ...draft,
              patientId: patient.id,
              patientName,
            })
            setModal(null)
            return saved
          }}
          onPrint={printRx}
        />
      )}

      {modal === 'appointment' && (
        <NewAppointmentModal
          patients={activePatients}
          dentists={clinic.dentists ?? []}
          defaultDate={toISODate(new Date())}
          defaultPatientId={patient.id}
          onClose={() => setModal(null)}
          onSave={async (draft) => {
            const linked = {
              ...draft,
              patientId: patient.id,
              patientName,
              patientPhone: patient.phone,
            }
            if (isCloudClinicMode()) await addAppointmentCloud(linked)
            else addAppointment(linked)
            setModal(null)
          }}
        />
      )}

      {modal === 'prosthesis' && (
        <ProsthesisModal
          patients={activePatients}
          labs={[...new Set((clinic.prostheses ?? []).map((p) => p.lab).filter(Boolean))]}
          initial={null}
          defaultPatientId={patient.id}
          onClose={() => setModal(null)}
          onSave={(draft) => {
            addProsthesis({
              ...draft,
              patientId: patient.id,
              patientName,
            })
            setModal(null)
          }}
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
