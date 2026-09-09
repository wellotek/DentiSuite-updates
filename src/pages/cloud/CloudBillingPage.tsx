import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useCloudAuth } from '../../cloud/CloudAuthContext'
import { createInvoice, listInvoices, updateInvoice, type CloudInvoice } from '../../cloud/modules/billing'
import { listCloudPatients } from '../../cloud/modules/patients'
import { CloudBanner, CloudLoading, formatCloudError, todayIso } from './ui'

export function CloudBillingPage() {
  const { hasPermission } = useCloudAuth()
  const [items, setItems] = useState<CloudInvoice[]>([])
  const [patients, setPatients] = useState<Array<{ id: string; label: string }>>([])
  const [patientId, setPatientId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [inv, pats] = await Promise.all([
        listInvoices({ limit: 50 }),
        listCloudPatients({ limit: 100 }),
      ])
      setItems(inv.items)
      setPatients(pats.items.map((p) => ({ id: p.id, label: `${p.lastName} ${p.firstName}` })))
      setPatientId((cur) => cur || pats.items[0]?.id || '')
    } catch (e) {
      setError(formatCloudError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!patientId || !hasPermission('billing.create')) return
    try {
      await createInvoice(patientId, {
        label: 'Facture SMOKE',
        amount: 2500,
        paid: false,
        date: todayIso(),
      })
      await load()
    } catch (err) {
      setError(formatCloudError(err))
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Facturation Cloud</h2>
      {error ? <CloudBanner kind="error">{error}</CloudBanner> : null}
      {hasPermission('billing.create') ? (
        <form onSubmit={(e) => void onCreate(e)} className="flex flex-wrap gap-2">
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="rounded border px-2 py-1.5 text-sm">
            {patients.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button type="submit" className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white">+ Facture 2500 DA</button>
        </form>
      ) : null}
      {loading ? <CloudLoading /> : (
        <ul className="rounded-xl border bg-white divide-y text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between px-4 py-2">
              <span>{i.date} — {i.label} — {i.amount} DA {i.paid ? '(payé)' : ''}</span>
              {hasPermission('billing.update') && !i.paid ? (
                <button type="button" className="text-xs text-sky-700" onClick={() => void updateInvoice(i.id, { paid: true }).then(load)}>Marquer payé</button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
