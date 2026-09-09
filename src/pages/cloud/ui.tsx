import type { ReactNode } from 'react'
import { LoaderCircle, RefreshCw } from 'lucide-react'
import { CloudClientError, cloudErrorLabel } from '../../cloud/errors'
import { formatLastSync } from '../../cloud/useCloudLiveSync'

export function CloudBanner({
  kind,
  children,
}: {
  kind: 'error' | 'success' | 'info' | 'warn'
  children: ReactNode
}) {
  const cls =
    kind === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : kind === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : kind === 'warn'
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-slate-200 bg-slate-50 text-slate-700'
  return <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>
}

export function CloudLoading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <LoaderCircle className="h-5 w-5 animate-spin" />
      {label}
    </div>
  )
}

export function CloudSyncBar({
  lastSyncedAt,
  syncing,
  onRefresh,
}: {
  lastSyncedAt: Date | null
  syncing?: boolean
  onRefresh: () => void
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span>Dernière synchro : {formatLastSync(lastSyncedAt)}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={syncing}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-60"
        title="Actualiser"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
        Actualiser
      </button>
    </div>
  )
}

export function formatCloudError(err: unknown): string {
  if (err instanceof CloudClientError) return cloudErrorLabel(err)
  if (err instanceof Error) return err.message
  return String(err)
}

export function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
