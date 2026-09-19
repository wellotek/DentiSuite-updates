import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, LoaderCircle, Search } from 'lucide-react'
import type { Patient } from '../../types'
import { displayAge, formatBirthDateFr } from '../../lib/age'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useT } from '../../i18n'

export type PatientPickerOption = {
  value: string
  label: string
}

function filterPatients(patients: Patient[], query: string): Patient[] {
  const q = query.trim().toLowerCase()
  const phoneQ = q.replace(/\s+/g, '')
  const active = patients.filter((p) => !p.archivedAt)
  if (!q) return active.slice(0, 40)
  return active
    .filter((p) => {
      const name = `${p.lastName} ${p.firstName}`.toLowerCase()
      const phone = p.phone.replace(/\s+/g, '')
      return name.includes(q) || phone.includes(phoneQ)
    })
    .slice(0, 40)
}

function patientLabel(p: Patient) {
  return `${p.lastName} ${p.firstName}`
}

export function PatientPicker({
  patients,
  value,
  onChange,
  label,
  placeholder,
  required,
  disabled,
  loading,
  error,
  specialOptions = [],
  allowEmpty,
  emptyLabel,
}: {
  patients: Patient[]
  value: string
  onChange: (patientId: string, patient?: Patient) => void
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  loading?: boolean
  error?: string | null
  /** Extra options (walk-in, new patient) — not real patient ids. */
  specialOptions?: PatientPickerOption[]
  allowEmpty?: boolean
  emptyLabel?: string
}) {
  const t = useT()
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const debounced = useDebouncedValue(query, 200)

  const selectedPatient = patients.find((p) => p.id === value)
  const selectedSpecial = specialOptions.find((o) => o.value === value)

  const results = useMemo(() => filterPatients(patients, debounced), [patients, debounced])

  const rows: Array<{ kind: 'special' | 'patient'; value: string; label: string; sub?: string }> =
    useMemo(() => {
      const specials = specialOptions.map((o) => ({
        kind: 'special' as const,
        value: o.value,
        label: o.label,
      }))
      const pats = results.map((p) => {
        const birth = formatBirthDateFr(p.birthDate)
        const age = displayAge(p)
        const sub = [p.phone, birth ? `${birth} · ${age} ${t('patients.years')}` : `${age} ${t('patients.years')}`]
          .filter(Boolean)
          .join(' · ')
        return {
          kind: 'patient' as const,
          value: p.id,
          label: patientLabel(p),
          sub,
        }
      })
      return [...specials, ...pats]
    }, [specialOptions, results, t])

  useEffect(() => {
    setHighlight(0)
  }, [debounced, open])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function select(rowValue: string) {
    const patient = patients.find((p) => p.id === rowValue)
    onChange(rowValue, patient)
    setQuery('')
    setOpen(false)
  }

  const displayValue = open
    ? query
    : selectedPatient
      ? patientLabel(selectedPatient)
      : selectedSpecial
        ? selectedSpecial.label
        : ''

  return (
    <label className="block text-xs font-medium text-slate-600">
      {label ?? t('agenda.patient')}
      <div ref={wrapRef} className="relative mt-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={displayValue}
          disabled={disabled}
          required={required && !value}
          placeholder={placeholder ?? t('patients.search')}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setQuery('')
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setQuery('')
              return
            }
            if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
              setOpen(true)
              return
            }
            if (!open) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHighlight((h) => Math.min(h + 1, Math.max(0, rows.length - 1)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlight((h) => Math.max(h - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const row = rows[highlight]
              if (row) select(row.value)
            }
          }}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm outline-none focus:border-clinic-400 disabled:bg-slate-50"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          role="combobox"
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        {open ? (
          <div
            id={listId}
            role="listbox"
            className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            {allowEmpty ? (
              <button
                type="button"
                role="option"
                className="flex w-full px-3 py-2 text-start text-sm text-slate-500 hover:bg-slate-50"
                onClick={() => select('')}
              >
                {emptyLabel ?? t('common.none')}
              </button>
            ) : null}
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {t('common.loadingShort')}
              </div>
            ) : error ? (
              <p className="px-3 py-3 text-sm text-rose-700">{error}</p>
            ) : rows.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-500">{t('patients.empty')}</p>
            ) : (
              rows.map((row, index) => (
                <button
                  key={`${row.kind}-${row.value}`}
                  type="button"
                  role="option"
                  aria-selected={row.value === value || index === highlight}
                  className={`flex w-full flex-col px-3 py-2 text-start hover:bg-clinic-50 ${
                    index === highlight || row.value === value ? 'bg-clinic-50' : ''
                  }`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => select(row.value)}
                >
                  <span className="text-sm font-medium text-slate-900">{row.label}</span>
                  {row.sub ? <span className="text-xs text-slate-500">{row.sub}</span> : null}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </label>
  )
}
