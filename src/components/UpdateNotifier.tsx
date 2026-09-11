import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw, Rocket } from 'lucide-react'

export type UpdateUiStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'ready'
  | 'error'

export type UpdateStatusSnapshot = {
  status: UpdateUiStatus
  currentVersion: string
  availableVersion: string | null
  downloadPercent?: number
  error?: string | null
  packaged?: boolean
}

function asSnapshot(raw: {
  status: string
  currentVersion: string
  availableVersion: string | null
  downloadPercent?: number
  error?: string | null
  packaged?: boolean
}): UpdateStatusSnapshot {
  const allowed: UpdateUiStatus[] = [
    'idle',
    'checking',
    'available',
    'not-available',
    'downloading',
    'ready',
    'error',
  ]
  const status = (allowed.includes(raw.status as UpdateUiStatus)
    ? raw.status
    : 'idle') as UpdateUiStatus
  return { ...raw, status }
}

function statusLabel(s: UpdateStatusSnapshot): string {
  switch (s.status) {
    case 'checking':
      return 'Vérification…'
    case 'available':
      return `Nouvelle version disponible (${s.availableVersion})`
    case 'not-available':
      return 'À jour'
    case 'downloading':
      return `Téléchargement… ${s.downloadPercent ?? 0}%`
    case 'ready':
      return 'Installation prête'
    case 'error':
      return s.error ? `Erreur : ${s.error}` : 'Erreur de mise à jour'
    default:
      return '—'
  }
}

/**
 * Startup prompt + optional settings panel for electron-updater.
 */
export function UpdateNotifier({ mode = 'prompt' }: { mode?: 'prompt' | 'settings' }) {
  const [snap, setSnap] = useState<UpdateStatusSnapshot | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const api = window.dentisuite
    if (!api?.updateGetStatus) return
    try {
      const next = await api.updateGetStatus()
      setSnap(asSnapshot(next))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void refresh()
    const api = window.dentisuite
    if (!api?.onUpdateStatus) return
    return api.onUpdateStatus((payload) => {
      setSnap(asSnapshot(payload))
    })
  }, [refresh])

  useEffect(() => {
    // Silent startup check (packaged). Main also schedules one; this covers late UI mount.
    const api = window.dentisuite
    if (!api?.updateCheck) return
    const t = window.setTimeout(() => {
      void api
        .updateCheck?.({ silent: true })
        .then((r) => setSnap(asSnapshot(r)))
        .catch(() => undefined)
    }, 10_000)
    return () => window.clearTimeout(t)
  }, [])

  const onCheck = async () => {
    if (!window.dentisuite?.updateCheck || busy) return
    setBusy(true)
    setDismissed(false)
    try {
      const next = await window.dentisuite.updateCheck({ silent: false })
      setSnap(asSnapshot(next))
    } finally {
      setBusy(false)
    }
  }

  const onDownload = async () => {
    if (!window.dentisuite?.updateDownload || busy) return
    setBusy(true)
    try {
      const next = await window.dentisuite.updateDownload()
      setSnap(asSnapshot(next))
    } finally {
      setBusy(false)
    }
  }

  const onInstall = async () => {
    if (!window.dentisuite?.updateInstall || busy) return
    setBusy(true)
    try {
      await window.dentisuite.updateInstall()
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'settings') {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2 text-clinic-800">
          <RefreshCw className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Mises à jour</h2>
        </div>
        <p className="text-sm text-slate-500">
          Version installée : <span className="font-medium text-slate-800">{snap?.currentVersion ?? '—'}</span>
        </p>
        <p className="mt-1 text-sm text-slate-700">{snap ? statusLabel(snap) : '—'}</p>
        {snap?.status === 'downloading' ? (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-clinic-600 transition-all"
              style={{ width: `${snap.downloadPercent ?? 0}%` }}
            />
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onCheck()}
            className="rounded-lg bg-clinic-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Vérifier les mises à jour
          </button>
          {snap?.status === 'available' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onDownload()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Télécharger
            </button>
          ) : null}
          {snap?.status === 'ready' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onInstall()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              <Rocket className="h-4 w-4" />
              Redémarrer et installer
            </button>
          ) : null}
        </div>
      </section>
    )
  }

  // Startup / global prompts
  if (dismissed || !snap) return null
  if (snap.status !== 'available' && snap.status !== 'ready') return null

  if (snap.status === 'available') {
    return (
      <div className="fixed bottom-4 right-4 z-[80] w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <p className="text-sm font-semibold text-slate-900">
          Une nouvelle version de DentiSuite est disponible.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {snap.currentVersion} → {snap.availableVersion}
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border px-3 py-1.5 text-sm"
            onClick={() => setDismissed(true)}
          >
            Plus tard
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-clinic-700 px-3 py-1.5 text-sm text-white disabled:opacity-60"
            onClick={() => void onDownload()}
          >
            Télécharger
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-[80] w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-emerald-200 bg-white p-4 shadow-lg">
      <p className="text-sm font-semibold text-slate-900">Mise à jour prête.</p>
      <p className="mt-1 text-xs text-slate-500">
        Version {snap.availableVersion} téléchargée. Redémarrez pour installer.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          className="rounded-lg border px-3 py-1.5 text-sm"
          onClick={() => setDismissed(true)}
        >
          Plus tard
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          onClick={() => void onInstall()}
        >
          Redémarrer et installer
        </button>
      </div>
    </div>
  )
}
