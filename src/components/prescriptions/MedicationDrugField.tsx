import { useEffect, useMemo, useRef, useState } from 'react'
import type { MedicationItem, PrescriptionLine } from '../../types'
import { applyMedicationToLine, searchMedications } from '../../lib/medications'
import { useT } from '../../i18n'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

interface Props {
  line: PrescriptionLine
  catalog: MedicationItem[]
  onChange: (line: PrescriptionLine) => void
}

export function MedicationDrugField({ line, catalog, onChange }: Props) {
  const t = useT()
  const [query, setQuery] = useState(line.drug)
  const [open, setOpen] = useState(false)
  const [manual, setManual] = useState(!line.medicationId)
  const debounced = useDebouncedValue(query, 180)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(line.drug)
  }, [line.drug])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const suggestions = useMemo(() => {
    if (manual || !debounced.trim()) return []
    return searchMedications(catalog, debounced, 10)
  }, [catalog, debounced, manual])

  function selectMed(med: MedicationItem) {
    const next = applyMedicationToLine(line, med)
    onChange(next)
    setQuery(next.drug)
    setOpen(false)
    setManual(false)
  }

  function enableManual() {
    setManual(true)
    setOpen(false)
    onChange({
      ...line,
      medicationId: undefined,
      dci: undefined,
      form: line.form,
      dosage: line.dosage,
    })
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={query}
        onChange={(e) => {
          const v = e.target.value
          setQuery(v)
          setOpen(true)
          onChange({
            ...line,
            drug: v,
            medicationId: manual ? undefined : line.medicationId,
          })
        }}
        onFocus={() => setOpen(true)}
        placeholder={t('rx.drug')}
        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-clinic-400"
        autoComplete="off"
      />
      {open && !manual && (suggestions.length > 0 || debounced.trim().length >= 2) ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {suggestions.map((med) => (
            <li key={med.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-clinic-50"
                onClick={() => selectMed(med)}
              >
                <span className="text-sm font-medium text-slate-900">{med.name}</span>
                <span className="text-[11px] text-slate-500">
                  {[med.dosage, med.form, med.dci].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="w-full border-t border-slate-100 px-3 py-2 text-left text-xs font-semibold text-clinic-800 hover:bg-slate-50"
              onClick={enableManual}
            >
              {t('rx.manualDrug')}
            </button>
          </li>
        </ul>
      ) : null}
      {manual ? (
        <button
          type="button"
          className="mt-1 text-[11px] font-medium text-clinic-700 hover:underline"
          onClick={() => {
            setManual(false)
            setOpen(true)
          }}
        >
          Rechercher dans le catalogue
        </button>
      ) : null}
      <div className="mt-1 grid grid-cols-2 gap-1">
        <input
          value={line.dosage || ''}
          onChange={(e) => onChange({ ...line, dosage: e.target.value })}
          placeholder={t('rx.dosage')}
          className="w-full rounded-md border border-transparent px-2 py-1 text-[11px] text-slate-600 outline-none focus:border-slate-200"
        />
        <input
          value={line.form || ''}
          onChange={(e) => onChange({ ...line, form: e.target.value })}
          placeholder={t('rx.form')}
          className="w-full rounded-md border border-transparent px-2 py-1 text-[11px] text-slate-600 outline-none focus:border-slate-200"
        />
        <input
          value={line.quantity || ''}
          onChange={(e) => onChange({ ...line, quantity: e.target.value })}
          placeholder={t('rx.quantity')}
          className="col-span-2 w-full rounded-md border border-transparent px-2 py-1 text-[11px] text-slate-600 outline-none focus:border-slate-200"
        />
      </div>
    </div>
  )
}
