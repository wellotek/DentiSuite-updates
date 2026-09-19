import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '../../i18n'

export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const t = useT()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, total)

  if (total <= pageSize) {
    return total > 0 ? (
      <p className="text-xs text-slate-500">
        {from}–{to} {t('ui.pagination.of')} {total}
      </p>
    ) : null
  }

  return (
    <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
      <p>
        {from}–{to} {t('ui.pagination.of')} {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
          aria-label={t('ui.pagination.prev')}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t('ui.pagination.prev')}
        </button>
        <span className="px-2 tabular-nums">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
          aria-label={t('ui.pagination.next')}
        >
          {t('ui.pagination.next')}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function paginateSlice<T>(items: T[], page: number, pageSize: number): T[] {
  const start = Math.max(0, (page - 1) * pageSize)
  return items.slice(start, start + pageSize)
}
