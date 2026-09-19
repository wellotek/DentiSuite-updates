/** Local draft storage — never confused with saved clinical records. */

const PREFIX = 'dentisuite.draft.'

export type DraftEnvelope<T> = {
  kind: string
  key: string
  updatedAt: string
  /** Optional server updatedAt known when draft started — refuse auto-apply if server newer. */
  baseUpdatedAt?: string | null
  data: T
}

export function draftStorageKey(kind: string, key: string) {
  return `${PREFIX}${kind}.${key}`
}

export function saveDraft<T>(kind: string, key: string, data: T, baseUpdatedAt?: string | null) {
  if (typeof localStorage === 'undefined') return
  const envelope: DraftEnvelope<T> = {
    kind,
    key,
    updatedAt: new Date().toISOString(),
    baseUpdatedAt: baseUpdatedAt ?? null,
    data,
  }
  try {
    localStorage.setItem(draftStorageKey(kind, key), JSON.stringify(envelope))
  } catch {
    // Quota — ignore silently
  }
}

export function loadDraft<T>(kind: string, key: string): DraftEnvelope<T> | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(draftStorageKey(kind, key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftEnvelope<T>
    if (!parsed || parsed.kind !== kind || parsed.key !== key) return null
    return parsed
  } catch {
    return null
  }
}

export function clearDraft(kind: string, key: string) {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(draftStorageKey(kind, key))
}

/** True if draft should be offered (exists and not older than server if known). */
export function shouldOfferDraft(
  draft: DraftEnvelope<unknown> | null,
  serverUpdatedAt?: string | null,
): boolean {
  if (!draft) return false
  if (!serverUpdatedAt || !draft.baseUpdatedAt) return true
  const serverMs = Date.parse(serverUpdatedAt)
  const baseMs = Date.parse(draft.baseUpdatedAt)
  if (!Number.isFinite(serverMs) || !Number.isFinite(baseMs)) return true
  // Server moved ahead of what draft was based on → do not auto-offer overwrite
  return serverMs <= baseMs
}
