import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { NewPatientModal } from '../components/patients/NewPatientModal'
import { patientHasAllergies } from '../data/teeth'
import { useT } from '../i18n'
import { dentistName } from '../lib/dentists'
import { isCloudClinicMode } from '../cloud/cloudClinicMode'
import type { Patient } from '../types'

export function Patients() {
  const t = useT()
  const navigate = useNavigate()
  const patients = useAppStore((s) => s.clinic.patients)
  const dentists = useAppStore((s) => s.clinic.dentists ?? [])
  const addPatient = useAppStore((s) => s.addPatient)
  const addPatientCloud = useAppStore((s) => s.addPatientCloud)
  const updatePatient = useAppStore((s) => s.updatePatient)
  const deletePatient = useAppStore((s) => s.deletePatient)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Patient | null | 'new'>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '')
    return patients.filter((p) => {
      const name = `${p.lastName} ${p.firstName}`.toLowerCase()
      const phone = p.phone.replace(/\s+/g, '')
      return name.includes(query.trim().toLowerCase()) || phone.includes(q)
    })
  }, [patients, query])

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('patients.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {patients.length} {t('patients.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 rounded-lg bg-clinic-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-clinic-800"
        >
          <Plus className="h-4 w-4" />
          {t('patients.new')}
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('patients.search')}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-card outline-none focus:border-clinic-400"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t('patients.title')}</th>
              <th className="px-4 py-3 font-medium">{t('patients.phone')}</th>
              <th className="px-4 py-3 font-medium">{t('patients.age')}</th>
              <th className="px-4 py-3 font-medium">{t('patients.dentist')}</th>
              <th className="px-4 py-3 font-medium">{t('patients.history')}</th>
              <th className="px-4 py-3 text-end font-medium">{t('stock.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => {
              const alert = patientHasAllergies(p.antecedents, p.hasAllergies)
              return (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/patients/${p.id}`)}
                  className="cursor-pointer transition hover:bg-clinic-50/70"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {p.lastName} {p.firstName}
                    </p>
                    {alert && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        {t('patients.allergies')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {p.phone}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.age} {t('patients.years')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {dentists.find((d) => d.id === p.dentistId)
                      ? dentistName(dentists.find((d) => d.id === p.dentistId)!)
                      : t('form.unassigned')}
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-slate-500">{p.antecedents}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {confirmId === p.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              deletePatient(p.id)
                              setConfirmId(null)
                            }}
                            className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                          >
                            {t('common.delete')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                          >
                            {t('common.cancel')}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditing(p)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-clinic-800 hover:bg-clinic-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(p.id)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t('common.delete')}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  {t('patients.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <NewPatientModal
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            if (editing === 'new') {
              const id = isCloudClinicMode()
                ? await addPatientCloud(draft)
                : addPatient(draft)
              setEditing(null)
              navigate(`/patients/${id}`)
            } else {
              updatePatient(editing.id, draft)
              setEditing(null)
            }
          }}
        />
      )}
    </div>
  )
}
