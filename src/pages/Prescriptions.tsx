import { useMemo, useState } from 'react'
import { FileText, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { localeTag, useT } from '../i18n'
import { parseISODate } from '../lib/agenda'
import {
  draftFromTemplate,
  emptyPrescriptionDraft,
  PRESCRIPTION_TEMPLATES,
  prescriptionSummary,
} from '../lib/prescriptions'
import { printPrescription } from '../lib/prescriptionReport'
import type { Prescription, PrescriptionDraft } from '../types'
import { PrescriptionEditor } from '../components/prescriptions/PrescriptionEditor'
import { dentistName } from '../lib/dentists'
import {
  ContextBackButton,
  PatientContextBar,
  useOptionalPatientContext,
} from '../components/patients/PatientContextBar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

export function Prescriptions() {
  const t = useT()
  const prescriptions = useAppStore((s) => s.clinic.prescriptions ?? [])
  const patients = useAppStore((s) => s.clinic.patients)
  const dentists = useAppStore((s) => s.clinic.dentists ?? [])
  const settings = useAppStore((s) => s.clinic.settings)
  const locale = settings?.locale ?? 'fr'
  const loc = localeTag(locale)
  const addPrescription = useAppStore((s) => s.addPrescription)
  const updatePrescription = useAppStore((s) => s.updatePrescription)
  const deletePrescription = useAppStore((s) => s.deletePrescription)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 200)
  const [editing, setEditing] = useState<Prescription | PrescriptionDraft | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const { patient: contextPatient } = useOptionalPatientContext(patients)

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    return [...prescriptions]
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .filter((rx) => {
        if (contextPatient && rx.patientId && rx.patientId !== contextPatient.id) return false
        if (!q) return true
        return (
          rx.patientName.toLowerCase().includes(q) ||
          rx.title.toLowerCase().includes(q) ||
          rx.lines.some((l) => l.drug.toLowerCase().includes(q))
        )
      })
  }, [prescriptions, debouncedQuery, contextPatient])

  function printRx(rx: Prescription | PrescriptionDraft) {
    console.log('[PDF] Button clicked')
    const full: Prescription = 'id' in rx ? rx : { ...rx, id: 'preview' }
    void printPrescription(full, settings, loc).catch((error) => {
      const err = error instanceof Error ? error : new Error(String(error))
      console.error('[PDF] Print failed:', err.message, err.stack)
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {contextPatient ? (
        <div className="space-y-3">
          <ContextBackButton />
          <PatientContextBar patient={contextPatient} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('rx.titlePage')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('rx.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const dentist = dentists[0]
            setEditing({
              ...emptyPrescriptionDraft(),
              patientId: contextPatient?.id,
              patientName: contextPatient
                ? `${contextPatient.firstName} ${contextPatient.lastName}`
                : '',
              dentistId: dentist?.id,
              dentistName: dentist ? dentistName(dentist) : '',
            })
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-clinic-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-clinic-800"
        >
          <Plus className="h-4 w-4" />
          {t('rx.add')}
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('rx.templates')}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PRESCRIPTION_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => {
                const dentist = dentists[0]
                setEditing({
                  ...draftFromTemplate(tpl),
                  dentistId: dentist?.id,
                  dentistName: dentist ? dentistName(dentist) : '',
                })
              }}
              className="rounded-xl border border-slate-200 bg-white p-4 text-start shadow-card transition hover:border-clinic-300 hover:bg-clinic-50/40"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-clinic-50 text-clinic-800">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{tpl.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{tpl.hint}</p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {tpl.lines.length} {t('rx.medsShort')} · {t('rx.useTemplate')}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('rx.search')}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 ps-9 pe-3 text-sm outline-none focus:border-clinic-400"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t('rx.date')}</th>
                <th className="px-4 py-3 font-medium">{t('rx.patient')}</th>
                <th className="px-4 py-3 font-medium">{t('rx.title')}</th>
                <th className="px-4 py-3 font-medium">{t('rx.meds')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('rx.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((rx) => (
                <tr key={rx.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-slate-500">{parseISODate(rx.date).toLocaleDateString(loc)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{rx.patientName}</td>
                  <td className="px-4 py-3 text-slate-700">{rx.title}</td>
                  <td className="px-4 py-3 text-slate-500">{prescriptionSummary(rx) || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {confirmId === rx.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              deletePrescription(rx.id)
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
                            onClick={() => printRx(rx)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            {t('rx.printShort')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(rx)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-clinic-800 hover:bg-clinic-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(rx.id)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t('common.delete')}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    {t('rx.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <PrescriptionEditor
          patients={patients}
          dentists={dentists}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(draft) => {
            if ('id' in editing) {
              updatePrescription(editing.id, draft)
              return { ...draft, id: editing.id }
            }
            return addPrescription(draft)
          }}
          onPrint={printRx}
        />
      )}
    </div>
  )
}
