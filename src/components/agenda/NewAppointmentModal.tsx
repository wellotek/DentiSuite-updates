import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Appointment, AppointmentCategory, AppointmentDraft, Dentist, Patient } from '../../types'
import { DentistSelect } from '../dentists/DentistSelect'
import { CATEGORY_LABEL, inferCategory, parseFullName } from '../../lib/agenda'
import { dentistName } from '../../lib/dentists'
import { COMMON_ACTS } from '../../data/teeth'
import { useT } from '../../i18n'
import { useAppStore } from '../../store/useAppStore'
import { isCloudClinicMode } from '../../cloud/cloudClinicMode'
import { PatientPicker } from '../patients/PatientPicker'
import { useToast } from '../ui/Toast'
import { Link } from 'react-router-dom'

const NEW_PATIENT = '__new__'

interface Props {
  patients: Patient[]
  dentists: Dentist[]
  defaultDate: string
  appointment?: Appointment | null
  /** Prefill patient when creating (e.g. from patient chart). */
  defaultPatientId?: string
  onClose: () => void
  onSave: (draft: AppointmentDraft) => void | Promise<void>
  onDelete?: () => void
}

export function NewAppointmentModal({
  patients,
  dentists,
  defaultDate,
  appointment,
  defaultPatientId,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const t = useT()
  const toast = useToast()
  const addPatient = useAppStore((s) => s.addPatient)
  const addPatientCloud = useAppStore((s) => s.addPatientCloud)
  const editing = Boolean(appointment)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({
    patientId:
      appointment?.patientId ||
      defaultPatientId ||
      patients[0]?.id ||
      NEW_PATIENT,
    fullName: appointment?.patientName ?? '',
    phone: appointment?.patientPhone ?? '',
    date: appointment?.date ?? defaultDate,
    time: appointment?.time ?? '09:00',
    durationMin: String(appointment?.durationMin ?? 30),
    motif: appointment?.motif ?? '',
    dentistId: appointment?.dentistId ?? '',
    category: (appointment?.category ?? '') as AppointmentCategory | '',
  })

  const selected = useMemo(
    () => patients.find((p) => p.id === form.patientId),
    [patients, form.patientId],
  )
  const isNewPatient = form.patientId === NEW_PATIENT
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const motif = form.motif.trim()
    const dentist = dentists.find((d) => d.id === form.dentistId)

    let patientId = form.patientId
    let patientName = selected ? `${selected.firstName} ${selected.lastName}` : ''
    let patientPhone = selected?.phone ?? ''

    if (isNewPatient) {
      const { firstName, lastName } = parseFullName(form.fullName)
      const phone = form.phone.trim()
      if (!firstName || !phone) return
      const draftPatient = {
        firstName,
        lastName: lastName || firstName,
        phone,
        age: 0,
        address: '',
        antecedents: 'Aucun',
        hasAllergies: false,
        dentistId: form.dentistId || undefined,
      }
      patientId = isCloudClinicMode()
        ? await addPatientCloud(draftPatient)
        : addPatient(draftPatient)
      patientName = lastName && lastName !== firstName ? `${firstName} ${lastName}` : firstName
      patientPhone = phone
    } else if (!selected) {
      return
    }

    await onSave({
      date: form.date,
      time: form.time,
      durationMin: Number(form.durationMin) || 30,
      patientId,
      patientName,
      patientPhone,
      motif,
      practitioner: dentist ? dentistName(dentist) : '',
      dentistId: form.dentistId || undefined,
      status: appointment?.status ?? 'confirme',
      category: form.category || inferCategory(motif),
    })
    toast.success(t('toast.appointmentSaved'))
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{editing ? t('agenda.edit') : t('agenda.new')}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-2">
            <PatientPicker
              patients={patients}
              value={form.patientId}
              label={t('agenda.patient')}
              required
              specialOptions={[{ value: NEW_PATIENT, label: t('agenda.addPatient') }]}
              onChange={(value, patient) => {
                setForm({
                  ...form,
                  patientId: value,
                  dentistId: form.dentistId || patient?.dentistId || '',
                  fullName: patient ? `${patient.firstName} ${patient.lastName}` : form.fullName,
                  phone: patient?.phone ?? form.phone,
                })
              }}
            />
            {selected && !isNewPatient ? (
              <Link
                to={`/patients/${selected.id}`}
                state={{ returnTo: '/agenda', returnLabel: t('nav.agenda') }}
                className="inline-flex text-xs font-medium text-clinic-700 hover:underline"
              >
                {t('nav.openPatientChart')}
              </Link>
            ) : null}
          </div>
          {isNewPatient && (
            <>
              <label className="block text-xs font-medium text-slate-600">
                {t('agenda.fullName')}
                <input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Karim Benali"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
                  required
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t('patients.phone')}
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="05 55 00 00 00"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
                  required
                />
              </label>
            </>
          )}
          <label className="block text-xs font-medium text-slate-600">
            {t('agenda.date')}
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t('agenda.time')}
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t('agenda.duration')}
            <input
              type="number"
              min={15}
              step={15}
              value={form.durationMin}
              onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t('agenda.act')}
            <input
              list="acts-rdv"
              value={form.motif}
              onChange={(e) => setForm({ ...form, motif: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
              required
            />
            <datalist id="acts-rdv">
              {COMMON_ACTS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            {t('agenda.category')}
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as AppointmentCategory | '' })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            >
              <option value="">{t('agenda.categoryAuto')}</option>
              {Object.entries(CATEGORY_LABEL).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-2">
            <DentistSelect
              dentists={dentists}
              value={form.dentistId}
              onChange={(dentistId) => setForm({ ...form, dentistId })}
              label={`${t('agenda.dentist')} (${t('common.optional')})`}
              optionalLabel={t('form.unassigned')}
            />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-2">
          <div>
            {editing && onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">{t('agenda.deleteConfirm')}</span>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    {t('common.delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  {t('common.delete')}
                </button>
              )
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
              {t('common.cancel')}
            </button>
            <button type="submit" className="rounded-lg bg-clinic-700 px-4 py-2 text-sm font-medium text-white hover:bg-clinic-800">
              {t('common.save')}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  )
}
