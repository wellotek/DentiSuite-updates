import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useCloudAuth } from '../../cloud/CloudAuthContext'
import {
  createAppointment,
  deleteAppointment,
  listAppointments,
  updateAppointment,
  type CloudAppointment,
} from '../../cloud/modules/appointments'
import { listCloudPatients } from '../../cloud/modules/patients'
import { CloudBanner, CloudLoading, CloudSyncBar, formatCloudError, todayIso } from './ui'
import { useCloudLiveSync } from '../../cloud/useCloudLiveSync'

export function CloudAppointmentsPage() {
  const { hasPermission } = useCloudAuth()
  const [items, setItems] = useState<CloudAppointment[]>([])
  const [patients, setPatients] = useState<Array<{ id: string; label: string }>>([])
  const [date, setDate] = useState(todayIso())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    patientId: '',
    time: '09:00',
    durationMin: 30,
    motif: 'Consultation',
    practitioner: 'Dr',
    status: 'confirme',
    category: 'consultation',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, pats] = await Promise.all([
        listAppointments({ date, page: 1, limit: 50 }),
        listCloudPatients({ page: 1, limit: 100 }),
      ])
      setItems(list.items)
      setPatients(pats.items.map((p) => ({ id: p.id, label: `${p.lastName} ${p.firstName}` })))
      setForm((f) => (f.patientId || !pats.items[0] ? f : { ...f, patientId: pats.items[0]!.id }))
    } catch (err) {
      setError(formatCloudError(err))
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    void load()
  }, [load])

  const { lastSyncedAt, syncing, refresh } = useCloudLiveSync({
    reload: load,
    enabled: hasPermission('appointments.read'),
    pollIntervalMs: 25_000,
    poll: true,
  })

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !hasPermission('appointments.create')) return
    setBusy(true)
    setError(null)
    try {
      await createAppointment({ ...form, date })
      setMsg('RDV créé')
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
        <h2 className="text-lg font-semibold">Rendez-vous Cloud</h2>
        <div className="flex flex-wrap items-center gap-3">
          <CloudSyncBar
            lastSyncedAt={lastSyncedAt}
            syncing={syncing}
            onRefresh={() => void refresh()}
          />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border px-2 py-1.5 text-sm" />
        </div>
      </div>
      {error ? <CloudBanner kind="error">{error}</CloudBanner> : null}
      {msg ? <CloudBanner kind="success">{msg}</CloudBanner> : null}

      {hasPermission('appointments.create') ? (
        <form onSubmit={(e) => void onCreate(e)} className="grid gap-2 rounded-xl border bg-white p-4 sm:grid-cols-4">
          <select required value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} className="rounded border px-2 py-1.5 text-sm sm:col-span-2">
            <option value="">Patient…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="rounded border px-2 py-1.5 text-sm" />
          <input required value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} className="rounded border px-2 py-1.5 text-sm" placeholder="Motif" />
          <button type="submit" disabled={busy} className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white sm:col-span-4 disabled:opacity-60">
            Créer RDV
          </button>
        </form>
      ) : null}

      {loading ? (
        <CloudLoading />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Heure</th>
                <th className="px-3 py-2 text-left">Patient</th>
                <th className="px-3 py-2 text-left">Motif</th>
                <th className="px-3 py-2 text-left">Statut</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2">{a.time}</td>
                  <td className="px-3 py-2">{a.patientName || a.patientId.slice(0, 8)}</td>
                  <td className="px-3 py-2">{a.motif}</td>
                  <td className="px-3 py-2">{a.status}</td>
                  <td className="px-3 py-2 space-x-2">
                    {hasPermission('appointments.update') ? (
                      <button
                        type="button"
                        className="text-xs text-sky-700"
                        onClick={() =>
                          void updateAppointment(a.id, { status: 'termine' }).then(load).catch((e) => setError(formatCloudError(e)))
                        }
                      >
                        Terminer
                      </button>
                    ) : null}
                    {hasPermission('appointments.delete') ? (
                      <button
                        type="button"
                        className="text-xs text-rose-700"
                        onClick={() =>
                          void deleteAppointment(a.id).then(load).catch((e) => setError(formatCloudError(e)))
                        }
                      >
                        Suppr.
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
