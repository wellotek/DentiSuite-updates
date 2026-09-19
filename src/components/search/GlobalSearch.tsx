import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import {
  GLOBAL_SEARCH_GROUP_ORDER,
  searchClinic,
  type GlobalSearchHit,
  type GlobalSearchKind,
} from '../../lib/globalSearch'
import { useT } from '../../i18n'
import type { MsgKey } from '../../i18n/messages'

const OPEN_EVENT = 'dentisuite:open-global-search'

const GROUP_LABEL: Record<GlobalSearchKind, MsgKey> = {
  patient: 'search.group.patients',
  appointment: 'search.group.appointments',
  prescription: 'search.group.prescriptions',
  invoice: 'search.group.invoices',
  prosthesis: 'search.group.prostheses',
  dentist: 'search.group.dentists',
  medication: 'search.group.medications',
}

export function openGlobalSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function GlobalSearchHost() {
  const t = useT()
  const navigate = useNavigate()
  const clinic = useAppStore((s) => s.clinic)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounced = useDebouncedValue(query, 180)

  const hits = useMemo(
    () => (open ? searchClinic(clinic, debounced) : []),
    [clinic, debounced, open],
  )

  const flat = hits

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape' && open) {
        e.preventDefault()
        setOpen(false)
        setQuery('')
      }
    }
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setHighlight(0)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setQuery('')
    }
  }, [open])

  useEffect(() => {
    setHighlight(0)
  }, [debounced])

  function go(hit: GlobalSearchHit) {
    setOpen(false)
    setQuery('')
    navigate(hit.to, hit.state ? { state: hit.state } : undefined)
  }

  if (!open) return null

  const groups = GLOBAL_SEARCH_GROUP_ORDER.map((kind) => ({
    kind,
    items: flat.filter((h) => h.kind === kind),
  })).filter((g) => g.items.length > 0)

  let runningIndex = -1

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label={t('search.title')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          setOpen(false)
          setQuery('')
        }
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
          <Search className="h-4 w-4 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlight((h) => Math.min(h + 1, Math.max(0, flat.length - 1)))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlight((h) => Math.max(h - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const hit = flat[highlight]
                if (hit) go(hit)
              }
            }}
          />
          <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">
            Esc
          </kbd>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setQuery('')
            }}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[min(60vh,28rem)] overflow-y-auto py-2">
          {!debounced.trim() ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">{t('search.hint')}</p>
          ) : flat.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">{t('search.empty')}</p>
          ) : (
            groups.map((group) => (
              <div key={group.kind} className="mb-2">
                <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {t(GROUP_LABEL[group.kind])}
                </p>
                {group.items.map((hit) => {
                  runningIndex += 1
                  const index = runningIndex
                  return (
                    <button
                      key={hit.id}
                      type="button"
                      className={`flex w-full flex-col px-4 py-2 text-start hover:bg-clinic-50 ${
                        index === highlight ? 'bg-clinic-50' : ''
                      }`}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => go(hit)}
                    >
                      <span className="text-sm font-medium text-slate-900">{hit.title}</span>
                      {hit.subtitle ? (
                        <span className="text-xs text-slate-500">{hit.subtitle}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function GlobalSearchTrigger({ className }: { className?: string }) {
  const t = useT()
  return (
    <button
      type="button"
      className={
        className ??
        'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-white'
      }
      onClick={() => openGlobalSearch()}
      title={`${t('search.title')} (Ctrl+K)`}
    >
      <Search className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{t('search.short')}</span>
      <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px]">Ctrl+K</kbd>
    </button>
  )
}
