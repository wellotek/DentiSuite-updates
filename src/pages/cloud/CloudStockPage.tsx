import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useCloudAuth } from '../../cloud/CloudAuthContext'
import { createStockItem, listStock, updateStockItem, type CloudStockItem } from '../../cloud/modules/stock'
import { CloudBanner, CloudLoading, formatCloudError, todayIso } from './ui'

export function CloudStockPage() {
  const { hasPermission } = useCloudAuth()
  const [items, setItems] = useState<CloudStockItem[]>([])
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems((await listStock({ q, limit: 50 })).items)
    } catch (e) {
      setError(formatCloudError(e))
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => { void load() }, [load])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await createStockItem({
        code: `SMOKE-${Date.now().toString().slice(-6)}`,
        name: 'Article SMOKE',
        category: 'consommable',
        quantity: 10,
        minQuantity: 2,
        unitPrice: 100,
        addedAt: todayIso(),
      })
      await load()
    } catch (err) {
      setError(formatCloudError(err))
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Stock Cloud</h2>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche" className="rounded border px-2 py-1.5 text-sm" />
      {error ? <CloudBanner kind="error">{error}</CloudBanner> : null}
      {hasPermission('stock.create') ? (
        <button type="button" onClick={(e) => void onCreate(e as unknown as FormEvent)} className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white">+ Article</button>
      ) : null}
      {loading ? <CloudLoading /> : (
        <ul className="rounded-xl border bg-white divide-y text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between px-4 py-2">
              <span>{i.code} — {i.name} ({i.quantity})</span>
              {hasPermission('stock.update') ? (
                <button type="button" className="text-xs text-sky-700" onClick={() => void updateStockItem(i.id, { quantity: i.quantity + 1 }).then(load)}>+1</button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
