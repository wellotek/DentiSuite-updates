import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_POLL_MS = 25_000

function isDocumentVisible() {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible'
}

/**
 * Multi-poste sync helper:
 * - refetch on window focus / visibility
 * - light polling while visible (default 25s)
 * - manual refresh + lastSyncedAt
 */
export function useCloudLiveSync(options: {
  reload: () => void | Promise<void>
  enabled?: boolean
  pollIntervalMs?: number
  /** When false, skip background polling (still focus-refetch). */
  poll?: boolean
}) {
  const { reload, enabled = true, pollIntervalMs = DEFAULT_POLL_MS, poll = true } = options
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [syncing, setSyncing] = useState(false)
  const reloadRef = useRef(reload)
  reloadRef.current = reload

  const run = useCallback(async () => {
    if (!enabled) return
    setSyncing(true)
    try {
      await reloadRef.current()
      setLastSyncedAt(new Date())
    } finally {
      setSyncing(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const onFocus = () => {
      if (isDocumentVisible()) void run()
    }
    const onVisibility = () => {
      if (isDocumentVisible()) void run()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    let timer: number | undefined
    if (poll && pollIntervalMs > 0) {
      timer = window.setInterval(() => {
        if (isDocumentVisible()) void run()
      }, pollIntervalMs)
    }

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer) window.clearInterval(timer)
    }
  }, [enabled, poll, pollIntervalMs, run])

  return {
    lastSyncedAt,
    syncing,
    refresh: run,
  }
}

export function formatLastSync(at: Date | null): string {
  if (!at) return 'Jamais synchronisé'
  const sec = Math.max(0, Math.round((Date.now() - at.getTime()) / 1000))
  if (sec < 15) return 'À l’instant'
  if (sec < 60) return `Il y a ${sec}s`
  const min = Math.round(sec / 60)
  if (min < 60) return `Il y a ${min} min`
  return at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
