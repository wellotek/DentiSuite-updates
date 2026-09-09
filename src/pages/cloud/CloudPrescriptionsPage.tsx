import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCloudAuth } from '../../cloud/CloudAuthContext'
import { createPrescription, listPrescriptions } from '../../cloud/modules/prescriptions'
import { listCloudPatients } from '../../cloud/modules/patients'
import { CloudBanner, CloudLoading, formatCloudError, todayIso } from './ui'

export function CloudPrescriptionsPage() {
  const { hasPermission } = useCloudAuth()
  const [params, setParams] = useSearchParams()
  const patientId = params.get('patientId') || ''
  const [patients, setPatients] = useState<Array<{ id: string; label: string }>>([])
  const [items, setItems] = useState<Array<{ id: string; title: string; date: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void listCloudPatients({ limit: 100 }).then((l) => {
      setPatients(l.items.map((p) => ({ id: p.id, label: `${p.lastName} ${p.firstName}` })))
      if (!patientId && l.items[0]) setParams({ patientId: l.items[0].id })
    })
  }, [patientId, setParams])

  const load = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const list = await listPrescriptions(patientId, { limit: 50 })
      setItems(list.items.map((x) => ({ id: x.id, title: x.title, date: x.date })))
    } catch (e) {
      setError(formatCloudError(e))
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Ordonnances Cloud</h2>
      <select value={patientId} onChange={(e) => setParams({ patientId: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
        {patients.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      {error ? <CloudBanner kind="error">{error}</CloudBanner> : null}
      {hasPermission('prescriptions.create') && patientId ? (
        <button
          type="button"
          className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white"
          onClick={() =>
            void createPrescription(patientId, {
              date: todayIso(),
              title: 'Ordonnance SMOKE',
              lines: [{ drug: 'Paracétamol', posology: '1g x3/j', duration: '3j' }],
            })
              .then(load)
              .catch((e) => setError(formatCloudError(e)))
          }
        >
          + Ordonnance
        </button>
      ) : null}
      {loading ? <CloudLoading /> : (
        <ul className="rounded-xl border bg-white p-4 text-sm">
          {items.map((i) => <li key={i.id}>{i.date} — {i.title}</li>)}
        </ul>
      )}
    </div>
  )
}
