import { describe, expect, it } from 'vitest'
import { fetchAllPages, HYDRATE_MAX_PAGES } from './fetchAllPages'

describe('fetchAllPages', () => {
  it('aggregates all pages without duplicates or silent truncation', async () => {
    const total = 250
    const pages = Math.ceil(total / 100)
    const calls: number[] = []
    const items = await fetchAllPages<{ id: string; n: number }>(
      async (q) => {
        const page = Number(q.page || 1)
        calls.push(page)
        const start = (page - 1) * 100
        const chunk = Array.from({ length: Math.min(100, total - start) }, (_, i) => ({
          id: `p${start + i}`,
          n: start + i,
        }))
        return { items: chunk, page, limit: 100, total, totalPages: pages }
      },
      {},
      { limit: 100, label: 'test' },
    )
    expect(items).toHaveLength(total)
    expect(new Set(items.map((x) => x.id)).size).toBe(total)
    expect(calls).toEqual([1, 2, 3])
  })

  it('stops when a page returns empty', async () => {
    const items = await fetchAllPages(
      async (q) => {
        const page = Number(q.page || 1)
        if (page === 1) return { items: [{ id: 'a' }], totalPages: 5, total: 5 }
        return { items: [], totalPages: 5, total: 5 }
      },
      {},
      { limit: 100 },
    )
    expect(items).toHaveLength(1)
  })

  it('respects HYDRATE_MAX_PAGES safety cap', async () => {
    const items = await fetchAllPages(
      async (q) => {
        const page = Number(q.page || 1)
        return {
          items: [{ id: `x${page}` }],
          page,
          limit: 1,
          total: HYDRATE_MAX_PAGES + 50,
          totalPages: HYDRATE_MAX_PAGES + 50,
        }
      },
      {},
      { limit: 1, maxPages: 3, label: 'cap' },
    )
    expect(items.length).toBe(3)
  })
})
