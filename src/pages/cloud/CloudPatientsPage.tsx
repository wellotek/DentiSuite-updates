import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCloudAuth } from '../../cloud/CloudAuthContext'
import {
  createCloudPatient,
  deleteCloudPatient,
  listCloudPatients,
  updateCloudPatient,
  type CloudPatient,
} from '../../cloud/modules/patients'
import { CloudBanner, CloudLoading, CloudSyncBar, formatCloudError } from './ui'
import { useCloudLiveSync } from '../../cloud/useCloudLiveSync'

export function CloudPatientsPage() {
  const { hasPermission } = useCloudAuth()
  const [items, setItems] = useState<CloudPatient[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    age: 30,
    address: '',
    notes: '',
  })
  const [editId, setEditId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listCloudPatients({ search, page: 1, limit: 50 })
      setItems(list.items)
      setTotal(list.total)
    } catch (err) {
      setError(formatCloudError(err))
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    void load()
  }, [load])

  const { lastSyncedAt, syncing, refresh } = useCloudLiveSync({
    reload: load,
    enabled: hasPermission('patients.read'),
    pollIntervalMs: 30_000,
    poll: true,
  })

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setMsg(null)
    setError(null)
    try {
      if (editId) {
        await updateCloudPatient({ id: editId, ...form })
        setMsg('Patient modifié')
      } else {
        await createCloudPatient(form)
        setMsg('Patient créé')
      }
      setEditId(null)
      setForm({ firstName: '', lastName: '', phone: '', age: 30, address: '', notes: '' })
      await load()
    } catch (err) {
      setError(formatCloudError(err))
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!hasPermission('patients.delete')) return
    if (!window.confirm('Supprimer définitivement ce patient ? Cette action est irréversible.')) return
    setBusy(true)
    try {
      await deleteCloudPatient(id)
      setMsg('Patient supprimé')
      await load()
    } catch (err) {
      setError(formatCloudError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Patients Cloud</h2>
          <p className="text-sm text-slate-500">{total} patient(s)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CloudSyncBar
            lastSyncedAt={lastSyncedAt}
            syncing={syncing}
            onRefresh={() => void refresh()}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche"
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error ? <CloudBanner kind="error">{error}</CloudBanner> : null}
      {msg ? <CloudBanner kind="success">{msg}</CloudBanner> : null}

      {(hasPermission('patients.create') || hasPermission('patients.update')) && (
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-2 rounded-xl border bg-white p-4 sm:grid-cols-3">
          <input required placeholder="Prénom" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="rounded border px-2 py-1.5 text-sm" disabled={busy} />
          <input required placeholder="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="rounded border px-2 py-1.5 text-sm" disabled={busy} />
          <input required placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded border px-2 py-1.5 text-sm" disabled={busy} />
          <input type="number" required placeholder="Âge" value={form.age} onChange={(e) => setForm({ ...form, age: Number(e.target.value) })} className="rounded border px-2 py-1.5 text-sm" disabled={busy} />
          <input placeholder="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded border px-2 py-1.5 text-sm sm:col-span-2" disabled={busy} />
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" disabled={busy} className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-60">
              {busy ? '…' : editId ? 'Enregistrer' : 'Créer'}
            </button>
            {editId ? (
              <button type="button" onClick={() => setEditId(null)} className="rounded-lg border px-3 py-2 text-sm">
                Annuler
              </button>
            ) : null}
          </div>
        </form>
      )}

      {loading ? (
        <CloudLoading />
      ) : items.length === 0 ? (
        <CloudBanner kind="info">Aucun patient</CloudBanner>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Nom</th>
                <th className="px-3 py-2">Tél</th>
                <th className="px-3 py-2">Âge</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link className="font-medium text-sky-800 hover:underline" to={`/cloud/patients/${p.id}`}>
                      {p.lastName} {p.firstName}
                    </Link>
                    <div className="font-mono text-[10px] text-slate-400">{p.id}</div>
                  </td>
                  <td className="px-3 py-2">{p.phone}</td>
                  <td className="px-3 py-2">{p.age}</td>
                  <td className="px-3 py-2 space-x-2">
                    {hasPermission('patients.update') ? (
                      <button
                        type="button"
                        className="text-xs text-sky-700"
                        onClick={() => {
                          setEditId(p.id)
                          setForm({
                            firstName: p.firstName,
                            lastName: p.lastName,
                            phone: p.phone,
                            age: p.age,
                            address: p.address,
                            notes: p.notes ?? '',
                          })
                        }}
                      >
                        Modifier
                      </button>
                    ) : null}
                    {hasPermission('patients.delete') ? (
                      <button type="button" className="text-xs text-rose-700" onClick={() => void onDelete(p.id)}>
                        Supprimer
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
