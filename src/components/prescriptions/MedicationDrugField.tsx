import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { MedicationItem, PrescriptionLine } from '../../types'
import {
  applyMedicationToLine,
  medicationSuggestionSecondary,
  searchMedications,
} from '../../lib/medications'
import { useT } from '../../i18n'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

interface Props {
  line: PrescriptionLine
  catalog: MedicationItem[]
  favoriteIds?: string[]
  onToggleFavorite?: (medicationId: string) => void
  onChange: (line: PrescriptionLine) => void
}

export function MedicationDrugField({
  line,
  catalog,
  favoriteIds = [],
  onToggleFavorite,
  onChange,
}: Props) {
  const t = useT()
  const [query, setQuery] = useState(line.drug)
  const [open, setOpen] = useState(false)
  const [manual, setManual] = useState(!line.medicationId)
  const [activeIndex, setActiveIndex] = useState(0)
  const debounced = useDebouncedValue(query, 180)
  const wrapRef = useRef<HTMLDivElement>(null)
  const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds])

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
    return searchMedications(catalog, debounced, 12, { favoriteIds })
  }, [catalog, debounced, manual, favoriteIds])

  useEffect(() => {
    setActiveIndex(0)
  }, [suggestions])

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

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (manual || !open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, Math.max(suggestions.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && suggestions[activeIndex]) {
      e.preventDefault()
      selectMed(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
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
        onKeyDown={onKeyDown}
        placeholder={t('rx.drug')}
        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-clinic-400"
        autoComplete="off"
        role="combobox"
        aria-expanded={open && !manual}
        aria-autocomplete="list"
      />
      {open && !manual && (suggestions.length > 0 || debounced.trim().length >= 1) ? (
        <ul
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {suggestions.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">{t('rx.noMedMatch')}</li>
          ) : (
            suggestions.map((med, idx) => {
              const isFav = favSet.has(med.id)
              const isActive = idx === activeIndex
              return (
                <li key={med.id} role="option" aria-selected={isActive}>
                  <div
                    className={`flex w-full items-start gap-1 px-1 ${
                      isActive ? 'bg-clinic-50' : ''
                    }`}
                  >
                    {onToggleFavorite ? (
                      <button
                        type="button"
                        className="mt-1 shrink-0 rounded px-1.5 py-1 text-sm text-amber-500 hover:bg-amber-50"
                        title={isFav ? t('rx.unfavoriteMed') : t('rx.favoriteMed')}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleFavorite(med.id)
                        }}
                      >
                        {isFav ? '★' : '☆'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col items-start px-2 py-2 text-left hover:bg-clinic-50"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => selectMed(med)}
                    >
                      <span className="flex w-full items-center gap-2 text-sm font-medium text-slate-900">
                        <span className="truncate">{med.name}</span>
                        {med.origin === 'custom' ? (
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                            {t('rx.customMed')}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {medicationSuggestionSecondary(med)}
                      </span>
                    </button>
                  </div>
                </li>
              )
            })
          )}
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
          {t('rx.searchCatalog')}
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
