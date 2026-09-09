import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useCloudAuth } from '../../cloud/CloudAuthContext'
import { createDentist, deleteDentist, listDentists, updateDentist, type CloudDentist } from '../../cloud/modules/dentists'
import { CloudBanner, CloudLoading, formatCloudError } from './ui'

export function CloudDentistsPage() {
  const { hasPermission } = useCloudAuth()
  const [items, setItems] = useState<CloudDentist[]>([])
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ firstName: '', lastName: '', specialty: 'Omnipratique', color: '#0ea5e9' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listDentists({ q, limit: 50 })
      setItems(list.items)
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
      await createDentist(form)
      setForm({ firstName: '', lastName: '', specialty: 'Omnipratique', color: '#0ea5e9' })
      await load()
    } catch (err) {
      setError(formatCloudError(err))
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Dentistes Cloud</h2>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche" className="rounded border px-2 py-1.5 text-sm" />
      {error ? <CloudBanner kind="error">{error}</CloudBanner> : null}
      {hasPermission('dentists.create') ? (
        <form onSubmit={(e) => void onCreate(e)} className="flex flex-wrap gap-2 rounded-xl border bg-white p-4">
          <input required placeholder="Prénom" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
          <input required placeholder="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
          <input required placeholder="Spécialité" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
          <button type="submit" className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white">Créer</button>
        </form>
      ) : null}
      {loading ? <CloudLoading /> : (
        <ul className="rounded-xl border bg-white divide-y">
          {items.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>{d.lastName} {d.firstName} — {d.specialty}</span>
              <span className="space-x-2">
                {hasPermission('dentists.update') ? (
                  <button type="button" className="text-xs text-sky-700" onClick={() => void updateDentist(d.id, { specialty: d.specialty + ' *' }).then(load)}>Maj</button>
                ) : null}
                {hasPermission('dentists.delete') ? (
                  <button type="button" className="text-xs text-rose-700" onClick={() => void deleteDentist(d.id).then(load)}>Suppr.</button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
