import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

export type ToastInput = {
  kind: ToastKind
  title: string
  description?: string
  durationMs?: number
}

type ToastItem = ToastInput & { id: string }

type ToastApi = {
  push: (toast: ToastInput) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

let idSeq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, number>>(new Map())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (toast: ToastInput) => {
      const id = `toast-${++idSeq}`
      const duration = toast.durationMs ?? (toast.kind === 'error' ? 6000 : 3500)
      setItems((prev) => [...prev.slice(-4), { ...toast, id }])
      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration)
        timers.current.set(id, timer)
      }
    },
    [dismiss],
  )

  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer)
      timers.current.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      push,
      dismiss,
      success: (title, description) => push({ kind: 'success', title, description }),
      error: (title, description) => push({ kind: 'error', title, description }),
      warning: (title, description) => push({ kind: 'warning', title, description }),
      info: (title, description) => push({ kind: 'info', title, description }),
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 end-4 z-[100] flex w-[min(100vw-2rem,22rem)] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const tone =
    item.kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
      : item.kind === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-950'
        : item.kind === 'warning'
          ? 'border-amber-200 bg-amber-50 text-amber-950'
          : 'border-slate-200 bg-white text-slate-900'
  const Icon =
    item.kind === 'success'
      ? CheckCircle2
      : item.kind === 'error'
        ? XCircle
        : item.kind === 'warning'
          ? AlertTriangle
          : Info

  return (
    <div
      className={`pointer-events-auto flex gap-3 rounded-xl border px-3 py-2.5 shadow-lg ${tone}`}
      role={item.kind === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{item.title}</p>
        {item.description ? <p className="mt-0.5 text-xs opacity-90">{item.description}</p> : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded p-0.5 opacity-60 hover:opacity-100"
        aria-label="Close"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      push: () => undefined,
      dismiss: () => undefined,
      success: () => undefined,
      error: () => undefined,
      warning: () => undefined,
      info: () => undefined,
    }
  }
  return ctx
}
