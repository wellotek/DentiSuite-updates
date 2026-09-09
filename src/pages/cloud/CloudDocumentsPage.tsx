import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCloudAuth } from '../../cloud/CloudAuthContext'
import {
  completeMedia,
  createMediaUpload,
  deleteMedia,
  getMediaDownloadUrl,
  listMedia,
  putToSignedUrl,
  type CloudMedia,
} from '../../cloud/modules/media'
import { listCloudPatients } from '../../cloud/modules/patients'
import { CloudBanner, CloudLoading, formatCloudError } from './ui'

export function CloudDocumentsPage() {
  const { hasPermission } = useCloudAuth()
  const [params, setParams] = useSearchParams()
  const patientId = params.get('patientId') || ''
  const [patients, setPatients] = useState<Array<{ id: string; label: string }>>([])
  const [items, setItems] = useState<CloudMedia[]>([])
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
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
      setItems((await listMedia(patientId, { limit: 50 })).items)
    } catch (e) {
      setError(formatCloudError(e))
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => { void load() }, [load])

  const onUpload = async (file: File | null) => {
    if (!file || !patientId || !hasPermission('documents.upload')) return
    setError(null)
    try {
      const created = await createMediaUpload(patientId, {
        title: file.name,
        kind: 'image',
        mime: file.type || 'application/octet-stream',
        originalName: file.name,
        size: file.size,
      })
      await putToSignedUrl(created.upload, file)
      await completeMedia(created.media.id)
      setMsg('Document uploadé')
      await load()
    } catch (e) {
      setError(formatCloudError(e))
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Documents Cloud</h2>
      <p className="text-xs text-slate-500">Upload via signed URL — credentials R2 jamais exposés.</p>
      <select value={patientId} onChange={(e) => setParams({ patientId: e.target.value })} className="rounded border px-2 py-1.5 text-sm">
        {patients.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      {error ? <CloudBanner kind="error">{error}</CloudBanner> : null}
      {msg ? <CloudBanner kind="success">{msg}</CloudBanner> : null}
      {hasPermission('documents.upload') && patientId ? (
        <input type="file" accept="image/*" onChange={(e) => void onUpload(e.target.files?.[0] ?? null)} />
      ) : null}
      {loading ? <CloudLoading /> : (
        <ul className="rounded-xl border bg-white divide-y text-sm">
          {items.map((m) => (
            <li key={m.id} className="flex justify-between px-4 py-2">
              <span>{m.title} · {m.status} · {m.kind}</span>
              <span className="space-x-2">
                {hasPermission('documents.read') ? (
                  <button
                    type="button"
                    className="text-xs text-sky-700"
                    onClick={() =>
                      void getMediaDownloadUrl(m.id).then((r) => window.open(r.url, '_blank')).catch((e) => setError(formatCloudError(e)))
                    }
                  >
                    Voir
                  </button>
                ) : null}
                {hasPermission('documents.delete') ? (
                  <button type="button" className="text-xs text-rose-700" onClick={() => void deleteMedia(m.id).then(load)}>Suppr.</button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
