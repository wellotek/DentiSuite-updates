import { useCallback, useEffect, useState } from 'react'
import { useCloudAuth } from '../../cloud/CloudAuthContext'
import { createProsthesis, listProstheses, updateProsthesis, type CloudProsthesis } from '../../cloud/modules/prostheses'
import { listCloudPatients } from '../../cloud/modules/patients'
import { CloudBanner, CloudLoading, formatCloudError, todayIso } from './ui'

export function CloudProsthesesPage() {
  const { hasPermission } = useCloudAuth()
  const [items, setItems] = useState<CloudProsthesis[]>([])
  const [patientId, setPatientId] = useState('')
  const [patients, setPatients] = useState<Array<{ id: string; label: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, pats] = await Promise.all([
        listProstheses({ limit: 50 }),
        listCloudPatients({ limit: 100 }),
      ])
      setItems(list.items)
      setPatients(pats.items.map((p) => ({ id: p.id, label: `${p.lastName} ${p.firstName}` })))
      setPatientId((cur) => cur || pats.items[0]?.id || '')
    } catch (e) {
      setError(formatCloudError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Prothèses Cloud</h2>
      {error ? <CloudBanner kind="error">{error}</CloudBanner> : null}
      {hasPermission('patients.create') ? (
        <div className="flex gap-2">
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="rounded border px-2 py-1.5 text-sm">
            {patients.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button
            type="button"
            className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white"
            onClick={() =>
              void createProsthesis(patientId, {
                type: 'Couronne SMOKE',
                tooth: '16',
                lab: 'Lab TEST',
                sentAt: todayIso(),
                status: 'envoye',
              }).then(load).catch((e) => setError(formatCloudError(e)))
            }
          >
            + Prothèse
          </button>
        </div>
      ) : null}
      {loading ? <CloudLoading /> : (
        <ul className="rounded-xl border bg-white divide-y text-sm">
          {items.map((p) => (
            <li key={p.id} className="flex justify-between px-4 py-2">
              <span>{p.type} · {p.tooth} · {p.status}</span>
              {hasPermission('patients.update') ? (
                <button type="button" className="text-xs text-sky-700" onClick={() => void updateProsthesis(p.id, { status: 'fabrication' }).then(load)}>Fabrication</button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
