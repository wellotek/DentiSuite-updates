import { FormEvent, useMemo, useState } from 'react'
import type { Patient, PatientDraft } from '../../types'
import { useAppStore } from '../../store/useAppStore'
import { DentistSelect } from '../dentists/DentistSelect'
import { useT } from '../../i18n'
import { isCloudClinicMode } from '../../cloud/cloudClinicMode'
import { computeAgeFromBirthDate } from '../../lib/age'

interface NewPatientModalProps {
  initial?: Patient | null
  onClose: () => void
  onSave: (patient: PatientDraft) => void
}

export function NewPatientModal({ initial, onClose, onSave }: NewPatientModalProps) {
  const t = useT()
  const dentists = useAppStore((s) => s.clinic.dentists ?? [])
  const [form, setForm] = useState({
    lastName: initial?.lastName ?? '',
    firstName: initial?.firstName ?? '',
    birthDate: initial?.birthDate ?? '',
    age: initial ? String(initial.age) : '',
    phone: initial?.phone ?? '',
    address: initial?.address ?? '',
    antecedents: initial?.antecedents === 'Aucun' ? '' : (initial?.antecedents ?? ''),
    hasAllergies: initial?.hasAllergies ?? false,
    dentistId: initial?.dentistId ?? '',
  })

  const computedAge = useMemo(
    () => computeAgeFromBirthDate(form.birthDate || null),
    [form.birthDate],
  )
  const ageDisplay =
    computedAge !== null ? String(computedAge) : form.age

  function submit(e: FormEvent) {
    e.preventDefault()
    const antecedents = form.antecedents.trim() || 'Aucun'
    const birthDate = form.birthDate.trim() || null
    const age =
      computeAgeFromBirthDate(birthDate) ??
      (Number(form.age) || 0)
    onSave({
      lastName: form.lastName.trim(),
      firstName: form.firstName.trim(),
      age,
      birthDate,
      phone: form.phone.trim(),
      address: form.address.trim(),
      antecedents,
      hasAllergies: form.hasAllergies || /allerg/i.test(antecedents),
      dentistId: form.dentistId || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{initial ? t('patients.edit') : t('patients.new')}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {isCloudClinicMode()
            ? 'Le dossier est synchronisé avec le cloud du cabinet.'
            : 'Le dossier est enregistré localement sur ce poste.'}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Field label={t('form.lastName')} value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
          <Field label={t('form.firstName')} value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
          <Field
            label={t('patients.birthDate')}
            type="date"
            value={form.birthDate}
            onChange={(v) => setForm({ ...form, birthDate: v })}
            required={false}
          />
          <label className="block text-xs font-medium text-slate-600">
            {t('patients.age')}
            <input
              type="number"
              value={ageDisplay}
              onChange={(e) => {
                if (form.birthDate) return
                setForm({ ...form, age: e.target.value })
              }}
              readOnly={Boolean(form.birthDate)}
              required={!form.birthDate}
              min={0}
              max={150}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400 read-only:bg-slate-50"
            />
            {form.birthDate ? (
              <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                Calculé automatiquement depuis la date de naissance
              </span>
            ) : null}
          </label>
          <Field label={t('patients.phone')} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <div className="col-span-2">
            <Field
            label={t('patients.address')}
            value={form.address}
            onChange={(v) => setForm({ ...form, address: v })}
            required={false}
          />
          </div>
          <div className="col-span-2">
            <DentistSelect
              dentists={dentists}
              value={form.dentistId}
              onChange={(dentistId) => setForm({ ...form, dentistId })}
              label={`${t('patients.dentist')} (${t('common.optional')})`}
              optionalLabel={t('form.unassigned')}
            />
          </div>
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            {t('form.antecedents')}
            <textarea
              value={form.antecedents}
              onChange={(e) => {
                const antecedents = e.target.value
                setForm({
                  ...form,
                  antecedents,
                  hasAllergies: form.hasAllergies || /allerg/i.test(antecedents),
                })
              }}
              rows={3}
              placeholder="Ex. Allergie à la pénicilline, diabète, anticoagulant…"
              className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
            />
          </label>
          <label className="col-span-2 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50/70 px-3 py-2 text-sm text-red-800">
            <input
              type="checkbox"
              checked={form.hasAllergies}
              onChange={(e) => setForm({ ...form, hasAllergies: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              {t('form.allergyFlag')}
            </span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            {t('common.cancel')}
          </button>
          <button type="submit" className="rounded-lg bg-clinic-700 px-4 py-2 text-sm font-medium text-white hover:bg-clinic-800">
            {t('form.savePatient')}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = true,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-clinic-400"
      />
    </label>
  )
}
