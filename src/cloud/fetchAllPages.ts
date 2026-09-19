import type { CloudListResult } from './api'

/** Max pages to fetch during hydrate — prevents runaway loops while covering large cabinets. */
export const HYDRATE_MAX_PAGES = 200

type PageQuery = Record<string, string | number | undefined>

/**
 * Fetch every page of an offset-paginated Cloud list (API max limit = 100).
 * Dedupes by id when present. Deterministic order = page order then item order.
 */
export async function fetchAllPages<T extends { id?: string }>(
  fetchPage: (query: PageQuery) => Promise<CloudListResult<T> | { items: T[]; totalPages?: number; total?: number; page?: number; limit?: number }>,
  baseQuery: PageQuery = {},
  options?: { limit?: number; maxPages?: number; label?: string },
): Promise<T[]> {
  const limit = options?.limit ?? 100
  const maxPages = options?.maxPages ?? HYDRATE_MAX_PAGES
  const seen = new Set<string>()
  const all: T[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages && page <= maxPages) {
    const res = await fetchPage({ ...baseQuery, page, limit })
    const items = Array.isArray(res.items) ? res.items : []
    for (const item of items) {
      const id = typeof item.id === 'string' ? item.id : undefined
      if (id) {
        if (seen.has(id)) continue
        seen.add(id)
      }
      all.push(item)
    }
    const reportedTotalPages =
      typeof res.totalPages === 'number' && res.totalPages > 0
        ? res.totalPages
        : typeof res.total === 'number' && res.total > 0
          ? Math.max(1, Math.ceil(res.total / limit))
          : items.length < limit
            ? page
            : page + 1
    totalPages = reportedTotalPages
    if (items.length === 0) break
    page += 1
  }

  if (page > maxPages && totalPages > maxPages) {
    console.warn(
      `[clinicMirror] ${options?.label || 'list'} truncated at ${maxPages} pages (${all.length} items). Increase HYDRATE_MAX_PAGES if needed.`,
    )
  }

  return all
}
