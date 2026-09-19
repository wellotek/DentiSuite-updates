import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { localeTag, useT } from '../i18n'
import { parseISODate } from '../lib/agenda'
import {
  isProsthesisOpen,
  isProsthesisOverdue,
  normalizeProsthesisStatus,
  PROSTHESIS_STATUSES,
  prosthesisStatusMeta,
} from '../lib/prostheses'
import type { Prosthesis, ProsthesisStatus } from '../types'
import { ProsthesisModal } from '../components/prostheses/ProsthesisModal'
import {
  ContextBackButton,
  PatientContextBar,
  useOptionalPatientContext,
} from '../components/patients/PatientContextBar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

export function Prostheses() {
  const t = useT()
  const prostheses = useAppStore((s) => s.clinic.prostheses ?? [])
  const patients = useAppStore((s) => s.clinic.patients)
  const locale = useAppStore((s) => s.clinic.settings?.locale ?? 'fr')
  const loc = localeTag(locale)
  const addProsthesis = useAppStore((s) => s.addProsthesis)
  const updateProsthesis = useAppStore((s) => s.updateProsthesis)
  const deleteProsthesis = useAppStore((s) => s.deleteProsthesis)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 200)
  const [status, setStatus] = useState<ProsthesisStatus | 'all'>('all')
  const [editing, setEditing] = useState<Prosthesis | null | 'new'>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const { patient: contextPatient } = useOptionalPatientContext(patients)

  const labs = useMemo(
    () => [...new Set(prostheses.map((p) => p.lab).filter(Boolean))].sort(),
    [prostheses],
  )

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    return [...prostheses]
      .filter((item) => {
        if (contextPatient && item.patientId !== contextPatient.id) return false
        if (status !== 'all' && normalizeProsthesisStatus(item.status) !== status) return false
        if (!q) return true
        return (
          item.patientName.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q) ||
          item.lab.toLowerCase().includes(q) ||
          item.tooth.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt) || a.patientName.localeCompare(b.patientName))
  }, [prostheses, debouncedQuery, status, contextPatient])

  const openCount = prostheses.filter(isProsthesisOpen).length
  const fabCount = prostheses.filter((p) => normalizeProsthesisStatus(p.status) === 'fabrication').length
  const recuCount = prostheses.filter((p) => p.status === 'recu').length
  const overdueCount = prostheses.filter((p) => isProsthesisOverdue(p)).length

  function formatDate(iso?: string) {
    if (!iso) return '—'
    return parseISODate(iso).toLocaleDateString(loc)
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
          <h1 className="text-2xl font-semibold text-slate-900">{t('prostheses.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('prostheses.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 rounded-lg bg-clinic-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-clinic-800"
        >
          <Plus className="h-4 w-4" />
          {t('prostheses.add')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t('prostheses.open')} value={String(openCount)} />
        <Kpi label={t('prostheses.statusEnCours')} value={String(fabCount)} tone="amber" />
        <Kpi label={t('prostheses.statusRecu')} value={String(recuCount)} tone="teal" />
        <Kpi label={t('prostheses.overdue')} value={String(overdueCount)} tone="red" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('prostheses.search')}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 ps-9 pe-3 text-sm outline-none focus:border-clinic-400"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ProsthesisStatus | 'all')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-clinic-400"
        >
          <option value="all">{t('prostheses.allStatuses')}</option>
          {PROSTHESIS_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t('prostheses.patient')}</th>
                <th className="px-4 py-3 font-medium">{t('prostheses.type')}</th>
                <th className="px-4 py-3 font-medium">{t('prostheses.tooth')}</th>
                <th className="px-4 py-3 font-medium">{t('prostheses.lab')}</th>
                <th className="px-4 py-3 font-medium">{t('prostheses.sentAt')}</th>
                <th className="px-4 py-3 font-medium">{t('prostheses.expectedAt')}</th>
                <th className="px-4 py-3 font-medium">{t('prostheses.status')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('prostheses.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const meta = prosthesisStatusMeta(item.status)
                const overdue = isProsthesisOverdue(item)
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.patientName}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{item.type}</p>
                      {item.notes && <p className="mt-0.5 text-[11px] text-slate-400">{item.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.tooth || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.lab}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(item.sentAt)}</td>
                    <td className={`px-4 py-3 ${overdue ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
                      {formatDate(item.expectedAt)}
                      {overdue && (
                        <span className="ms-1 text-[10px] font-semibold uppercase">{t('prostheses.late')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.className}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {confirmId === item.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                deleteProsthesis(item.id)
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
                              onClick={() => setEditing(item)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-clinic-800 hover:bg-clinic-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {t('common.edit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(item.id)}
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
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                    {t('prostheses.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <ProsthesisModal
          patients={patients}
          labs={labs}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(draft) => {
            if (editing === 'new') addProsthesis(draft)
            else updateProsthesis(editing.id, draft)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'amber' | 'teal' | 'red'
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : tone === 'teal' ? 'text-teal-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
