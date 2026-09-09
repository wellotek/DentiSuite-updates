import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCloudAuth } from '../../cloud/CloudAuthContext'
import { createConsultation, createTreatment, listConsultations, listTreatments } from '../../cloud/modules/clinical'
import { listCloudPatients } from '../../cloud/modules/patients'
import { CloudBanner, CloudLoading, formatCloudError, todayIso } from './ui'

export function CloudClinicalPage() {
  const { hasPermission } = useCloudAuth()
  const [params, setParams] = useSearchParams()
  const patientId = params.get('patientId') || ''
  const [patients, setPatients] = useState<Array<{ id: string; label: string }>>([])
  const [consultations, setConsultations] = useState<unknown[]>([])
  const [treatments, setTreatments] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void listCloudPatients({ page: 1, limit: 100 }).then((list) => {
      setPatients(list.items.map((p) => ({ id: p.id, label: `${p.lastName} ${p.firstName}` })))
      if (!patientId && list.items[0]) setParams({ patientId: list.items[0].id })
    }).catch((e) => setError(formatCloudError(e)))
  }, [patientId, setParams])

  const load = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    setError(null)
    try {
      const [c, t] = await Promise.all([
        listConsultations(patientId, { limit: 50 }),
        listTreatments(patientId, { limit: 50 }),
      ])
      setConsultations(c.items)
      setTreatments(t.items)
    } catch (err) {
      setError(formatCloudError(err))
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void load()
  }, [load])

  const onConsult = async () => {
    if (!hasPermission('consultations.create') || !patientId) return
    try {
      await createConsultation(patientId, {
        date: todayIso(),
        time: '10:00',
        teeth: ['16'],
        acts: 'Examen SMOKE',
        notes: 'SMOKE/TEST clinical',
      })
      setMsg('Consultation créée')
      await load()
    } catch (err) {
      setError(formatCloudError(err))
    }
  }

  const onTreat = async () => {
    if (!hasPermission('consultations.create') || !patientId) return
    try {
      await createTreatment(patientId, {
        date: todayIso(),
        tooth: '16',
        act: 'Soin SMOKE',
        code: 'SMOKE',
        cost: 1000,
        careStatus: 'a_faire',
        paymentStatus: 'en_attente',
      })
      setMsg('Traitement créé')
      await load()
    } catch (err) {
      setError(formatCloudError(err))
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Clinique Cloud</h2>
      <select
        value={patientId}
        onChange={(e) => setParams({ patientId: e.target.value })}
        className="rounded border px-2 py-1.5 text-sm"
      >
        <option value="">Patient…</option>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      {error ? <CloudBanner kind="error">{error}</CloudBanner> : null}
      {msg ? <CloudBanner kind="success">{msg}</CloudBanner> : null}
      {hasPermission('consultations.create') && patientId ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => void onConsult()} className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white">
            + Consultation
          </button>
          <button type="button" onClick={() => void onTreat()} className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white">
            + Traitement
          </button>
        </div>
      ) : null}
      {loading ? <CloudLoading /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-white p-4">
            <h3 className="font-medium">Consultations ({consultations.length})</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {consultations.map((c) => {
                const row = c as { id: string; date: string; acts: string }
                return <li key={row.id}>{row.date} — {row.acts}</li>
              })}
            </ul>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <h3 className="font-medium">Traitements ({treatments.length})</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {treatments.map((t) => {
                const row = t as { id: string; act: string; tooth: string; cost: number }
                return <li key={row.id}>{row.tooth} {row.act} — {row.cost} DA</li>
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
