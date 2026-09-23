import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { ActItem, CareStatus, Treatment } from '../../types'
import { searchActs } from '../../data/acts'
import { formatDA } from '../../lib/money'
import { LOWER_TEETH, UPPER_TEETH } from '../../data/teeth'

interface CareDraft {
  date: string
  tooth: string
  cost: number
  comment: string
  careStatus: CareStatus
}

interface CareTableProps {
  treatments: Treatment[]
  catalog: ActItem[]
  defaultStatus: CareStatus
  onAdd: (row: {
    date: string
    tooth: string
    act: ActItem
    careStatus: CareStatus
    comment: string
    cost: number
  }) => void | Promise<void>
  onUpdate: (id: string, patch: Partial<Treatment>) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
}

export function CareTable({
  treatments,
  catalog,
  defaultStatus,
  onAdd,
  onUpdate,
  onDelete,
}: CareTableProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [tooth, setTooth] = useState('')
  const [query, setQuery] = useState('')
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<CareStatus>(defaultStatus)
  const [open, setOpen] = useState(false)
  const [selectedAct, setSelectedAct] = useState<ActItem | null>(null)
  const [tariff, setTariff] = useState('')
  const [tariffTouched, setTariffTouched] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CareDraft | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStatus(defaultStatus)
  }, [defaultStatus])

  const matches = useMemo(() => searchActs(catalog, query), [catalog, query])
  const suggested = selectedAct ?? matches[0]
  const teeth = ['—', ...UPPER_TEETH, ...LOWER_TEETH]

  useEffect(() => {
    if (tariffTouched) return
    setTariff(suggested ? String(suggested.tariff) : '')
  }, [suggested, tariffTouched])

  function chooseAct(act: ActItem) {
    setSelectedAct(act)
    setQuery(`${act.code} ${act.name}`)
    setTariff(String(act.tariff))
    setTariffTouched(false)
    setOpen(false)
  }

  function resetQuickRow() {
    setQuery('')
    setComment('')
    setTooth('')
    setSelectedAct(null)
    setTariff('')
    setTariffTouched(false)
    setOpen(false)
  }

  async function submit() {
    if (!suggested || saving) return
    setSaving(true)
    try {
      await onAdd({
        date,
        tooth: tooth || '—',
        act: suggested,
        careStatus: status,
        comment,
        cost: parseTariff(tariff, suggested.tariff),
      })
      resetQuickRow()
    } finally {
      setSaving(false)
    }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
    if (e.key === 'Escape') setOpen(false)
  }

  function startEdit(line: Treatment) {
    setConfirmDeleteId(null)
    setEditingId(line.id)
    setDraft({
      date: line.date.slice(0, 10),
      tooth: line.tooth,
      cost: line.cost,
      comment: line.comment ?? '',
      careStatus: line.careStatus,
    })
  }

  async function saveEdit(id: string) {
    if (!draft || saving) return
    setSaving(true)
    try {
      await onUpdate(id, {
        date: draft.date,
        tooth: draft.tooth || '—',
        cost: Math.max(0, Math.round(Number(draft.cost) || 0)),
        comment: draft.comment,
        careStatus: draft.careStatus,
      })
      setEditingId(null)
      setDraft(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Historique des soins</h2>
        <p className="text-xs text-slate-500">
          Tarif catalogue par défaut — modifiable en DA avant validation, puis ligne par ligne
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3 font-medium">Date</th>
              <th className="px-3 py-3 font-medium">Dent</th>
              <th className="px-3 py-3 font-medium">Code / Acte</th>
              <th className="px-3 py-3 font-medium">Tarif (DA)</th>
              <th className="px-3 py-3 font-medium">Statut</th>
              <th className="px-3 py-3 font-medium">Commentaire</th>
              <th className="px-3 py-3 text-end font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-clinic-50/40">
              <td className="px-3 py-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-[138px] rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-clinic-400"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  list="care-teeth"
                  value={tooth}
                  onChange={(e) => setTooth(e.target.value)}
                  placeholder="16"
                  className="w-16 rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-clinic-400"
                />
                <datalist id="care-teeth">
                  {teeth.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </td>
              <td className="relative px-3 py-2">
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setSelectedAct(null)
                    setTariffTouched(false)
                    setOpen(true)
                  }}
                  onFocus={() => setOpen(true)}
                  onKeyDown={onKey}
                  placeholder="SO-20 ou Composite…"
                  className="w-full min-w-[180px] rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-clinic-400"
                />
                {open && query && matches.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-48 w-[min(320px,70vw)] overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {matches.slice(0, 8).map((act) => (
                      <li key={act.id}>
                        <button
                          type="button"
                          onClick={() => chooseAct(act)}
                          className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-clinic-50"
                        >
                          <span>
                            <span className="font-mono text-clinic-700">{act.code}</span> {act.name}
                          </span>
                          <span className="text-slate-500">{formatDA(act.tariff)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={tariff}
                    onChange={(e) => {
                      setTariff(e.target.value)
                      setTariffTouched(true)
                    }}
                    onKeyDown={onKey}
                    placeholder={suggested ? String(suggested.tariff) : '0'}
                    className="w-[92px] rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium outline-none focus:border-clinic-400"
                  />
                  <span className="text-[10px] text-slate-400">DA</span>
                </div>
              </td>
              <td className="px-3 py-2">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CareStatus)}
                  className="rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-clinic-400"
                >
                  <option value="a_faire">À faire</option>
                  <option value="fait">Fait</option>
                </select>
              </td>
              <td className="px-3 py-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Note…"
                  className="w-full min-w-[120px] rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-clinic-400"
                />
              </td>
              <td className="px-3 py-2 text-end">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!suggested || saving}
                  className="inline-flex items-center gap-1 rounded-md bg-clinic-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-clinic-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter
                </button>
              </td>
            </tr>
            {treatments.map((line) => {
              const editing = editingId === line.id && draft
              const confirming = confirmDeleteId === line.id
              return (
                <tr key={line.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2.5 text-slate-600">
                    <input
                      type="date"
                      value={editing ? draft.date : line.date.slice(0, 10)}
                      onChange={(e) => {
                        if (editing) setDraft({ ...draft, date: e.target.value })
                        else void onUpdate(line.id, { date: e.target.value })
                      }}
                      className="w-[138px] rounded-md border border-transparent bg-transparent px-1 py-1 text-xs text-slate-600 outline-none hover:border-slate-200 focus:border-clinic-400"
                    />
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-clinic-800">
                    {editing ? (
                      <input
                        list="care-teeth"
                        value={draft.tooth}
                        onChange={(e) => setDraft({ ...draft, tooth: e.target.value })}
                        className="w-16 rounded-md border border-clinic-300 px-2 py-1 text-xs outline-none"
                      />
                    ) : (
                      line.tooth
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[11px] text-clinic-700">{line.code || '—'}</span>
                    <span className="ms-2 text-slate-800">{line.act}</span>
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    {editing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step={50}
                          value={draft.cost}
                          onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) })}
                          className="w-[92px] rounded-md border border-clinic-300 px-2 py-1 text-xs outline-none"
                        />
                        <span className="text-[10px] text-slate-400">DA</span>
                      </div>
                    ) : (
                      formatDA(line.cost)
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {editing ? (
                      <select
                        value={draft.careStatus}
                        onChange={(e) => setDraft({ ...draft, careStatus: e.target.value as CareStatus })}
                        className="rounded-md border border-clinic-300 px-2 py-1 text-xs outline-none"
                      >
                        <option value="a_faire">À faire</option>
                        <option value="fait">Fait</option>
                      </select>
                    ) : (
                      <select
                        value={line.careStatus}
                        onChange={(e) => void onUpdate(line.id, { careStatus: e.target.value as CareStatus })}
                        className={`rounded-full border-0 px-2 py-0.5 text-[11px] font-semibold ${
                          line.careStatus === 'fait'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        <option value="a_faire">À faire</option>
                        <option value="fait">Fait</option>
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {editing ? (
                      <input
                        value={draft.comment}
                        onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
                        className="w-full min-w-[120px] rounded-md border border-clinic-300 px-2 py-1 text-xs outline-none"
                      />
                    ) : (
                      line.comment || '—'
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {confirming ? (
                        <>
                          <span className="me-1 text-[11px] text-red-600">Supprimer ?</span>
                          <button
                            type="button"
                            onClick={() => {
                              void (async () => {
                                try {
                                  await onDelete(line.id)
                                  setConfirmDeleteId(null)
                                } catch {
                                  /* toast handled by PatientChart */
                                }
                              })()
                            }}
                            className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                          >
                            Oui
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100"
                          >
                            Non
                          </button>
                        </>
                      ) : editing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void saveEdit(line.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-clinic-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-clinic-800"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Enregistrer
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null)
                              setDraft(null)
                            }}
                            className="inline-flex items-center rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Annuler"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(line)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-clinic-800 hover:bg-clinic-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null)
                              setConfirmDeleteId(line.id)
                            }}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Supprimer
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {treatments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                  Aucun acte saisi — utilisez le schéma ou la ligne rapide.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function parseTariff(value: string, fallback: number) {
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.round(n)
}
