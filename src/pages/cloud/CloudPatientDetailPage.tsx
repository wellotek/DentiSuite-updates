import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCloudPatient, type CloudPatient } from '../../cloud/modules/patients'
import { listConsultations, listTreatments } from '../../cloud/modules/clinical'
import { listPrescriptions } from '../../cloud/modules/prescriptions'
import { listMedia } from '../../cloud/modules/media'
import { CloudBanner, CloudLoading, formatCloudError } from './ui'

export function CloudPatientDetailPage() {
  const { id = '' } = useParams()
  const [patient, setPatient] = useState<CloudPatient | null>(null)
  const [stats, setStats] = useState({ consultations: 0, treatments: 0, prescriptions: 0, media: 0 })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = await getCloudPatient(id)
      setPatient(p)
      const [c, t, rx, m] = await Promise.all([
        listConsultations(id, { limit: 5 }),
        listTreatments(id, { limit: 5 }),
        listPrescriptions(id, { limit: 5 }),
        listMedia(id, { limit: 5 }),
      ])
      setStats({
        consultations: c.total,
        treatments: t.total,
        prescriptions: rx.total,
        media: m.total,
      })
    } catch (err) {
      setError(formatCloudError(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <CloudLoading />
  if (error) return <CloudBanner kind="error">{error}</CloudBanner>
  if (!patient) return <CloudBanner kind="info">Patient introuvable</CloudBanner>

  return (
    <div className="space-y-4">
      <Link to="/cloud/patients" className="text-sm text-sky-700">
        ← Patients
      </Link>
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">
          {patient.lastName} {patient.firstName}
        </h2>
        <p className="text-sm text-slate-600">
          {patient.phone} · {patient.age} ans
        </p>
        <p className="mt-1 font-mono text-[11px] text-slate-400">{patient.id}</p>
        <p className="mt-2 text-sm text-slate-600">{patient.address || '—'}</p>
        <p className="text-sm text-slate-600">Antécédents : {patient.antecedents || '—'}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Consultations', stats.consultations, `/cloud/clinical?patientId=${id}`],
          ['Traitements', stats.treatments, `/cloud/clinical?patientId=${id}`],
          ['Ordonnances', stats.prescriptions, `/cloud/prescriptions?patientId=${id}`],
          ['Documents', stats.media, `/cloud/documents?patientId=${id}`],
        ].map(([label, n, to]) => (
          <Link key={String(label)} to={String(to)} className="rounded-xl border bg-white p-4 hover:bg-slate-50">
            <p className="text-xs uppercase text-slate-400">{label}</p>
            <p className="text-2xl font-semibold">{n as number}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
