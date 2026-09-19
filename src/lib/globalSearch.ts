import type { ClinicState } from '../types'

export type GlobalSearchKind =
  | 'patient'
  | 'appointment'
  | 'prescription'
  | 'invoice'
  | 'prosthesis'
  | 'dentist'
  | 'medication'

export type GlobalSearchHit = {
  id: string
  kind: GlobalSearchKind
  title: string
  subtitle?: string
  to: string
  state?: Record<string, unknown>
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

/** Fast in-memory search over already-hydrated clinic data (Legacy + Cloud mirror). */
export function searchClinic(
  clinic: ClinicState,
  rawQuery: string,
  limitPerGroup = 6,
): GlobalSearchHit[] {
  const q = norm(rawQuery.trim())
  if (q.length < 1) return []

  const hits: GlobalSearchHit[] = []

  const patients = (clinic.patients ?? []).filter((p) => !p.archivedAt)
  for (const p of patients) {
    const hay = norm(`${p.lastName} ${p.firstName} ${p.phone} ${p.birthDate ?? ''}`)
    if (!hay.includes(q)) continue
    hits.push({
      id: `patient:${p.id}`,
      kind: 'patient',
      title: `${p.firstName} ${p.lastName}`,
      subtitle: p.phone,
      to: `/patients/${p.id}`,
    })
    if (hits.filter((h) => h.kind === 'patient').length >= limitPerGroup) break
  }

  for (const a of clinic.appointments ?? []) {
    const hay = norm(`${a.patientName} ${a.patientPhone ?? ''} ${a.motif} ${a.date} ${a.time}`)
    if (!hay.includes(q)) continue
    hits.push({
      id: `appointment:${a.id}`,
      kind: 'appointment',
      title: `${a.patientName} · ${a.time}`,
      subtitle: `${a.date} — ${a.motif}`,
      to: a.patientId ? `/patients/${a.patientId}` : '/agenda',
      state: a.patientId
        ? { returnTo: '/agenda', returnLabel: undefined, fromPatientId: a.patientId }
        : undefined,
    })
    if (hits.filter((h) => h.kind === 'appointment').length >= limitPerGroup) break
  }

  for (const rx of clinic.prescriptions ?? []) {
    const drugs = rx.lines.map((l) => l.drug).join(' ')
    const hay = norm(`${rx.patientName} ${rx.title} ${drugs} ${rx.id}`)
    if (!hay.includes(q)) continue
    hits.push({
      id: `rx:${rx.id}`,
      kind: 'prescription',
      title: rx.title || `RX ${rx.id.slice(0, 8)}`,
      subtitle: `${rx.patientName} · ${rx.date}`,
      to: '/ordonnances',
      state: rx.patientId
        ? { fromPatientId: rx.patientId, returnTo: `/patients/${rx.patientId}` }
        : undefined,
    })
    if (hits.filter((h) => h.kind === 'prescription').length >= limitPerGroup) break
  }

  for (const tx of clinic.invoices ?? []) {
    const hay = norm(`${tx.patientName} ${tx.label} ${tx.id} ${tx.amount}`)
    if (!hay.includes(q)) continue
    hits.push({
      id: `invoice:${tx.id}`,
      kind: 'invoice',
      title: tx.label || `FAC ${tx.id.slice(0, 8)}`,
      subtitle: `${tx.patientName} · ${tx.amount}`,
      to: '/finances',
      state: tx.patientId
        ? { fromPatientId: tx.patientId, returnTo: `/patients/${tx.patientId}` }
        : undefined,
    })
    if (hits.filter((h) => h.kind === 'invoice').length >= limitPerGroup) break
  }

  for (const pr of clinic.prostheses ?? []) {
    const hay = norm(`${pr.patientName} ${pr.type} ${pr.lab} ${pr.id}`)
    if (!hay.includes(q)) continue
    hits.push({
      id: `prosthesis:${pr.id}`,
      kind: 'prosthesis',
      title: pr.type,
      subtitle: `${pr.patientName} · ${pr.status}`,
      to: '/protheses',
      state: pr.patientId
        ? { fromPatientId: pr.patientId, returnTo: `/patients/${pr.patientId}` }
        : undefined,
    })
    if (hits.filter((h) => h.kind === 'prosthesis').length >= limitPerGroup) break
  }

  for (const d of clinic.dentists ?? []) {
    const hay = norm(`${d.firstName} ${d.lastName} ${d.specialty}`)
    if (!hay.includes(q)) continue
    hits.push({
      id: `dentist:${d.id}`,
      kind: 'dentist',
      title: `Dr. ${d.firstName} ${d.lastName}`,
      subtitle: d.specialty,
      to: '/praticiens',
    })
    if (hits.filter((h) => h.kind === 'dentist').length >= limitPerGroup) break
  }

  const meds = clinic.medicationCatalog ?? []
  for (const m of meds) {
    if (m.status === 'inactive') continue
    const hay = norm(`${m.name} ${m.dci} ${m.form} ${m.dosage}`)
    if (!hay.includes(q)) continue
    hits.push({
      id: `med:${m.id}`,
      kind: 'medication',
      title: m.name,
      subtitle: [m.form, m.dosage].filter(Boolean).join(' · '),
      to: '/ordonnances',
    })
    if (hits.filter((h) => h.kind === 'medication').length >= limitPerGroup) break
  }

  return hits
}

export const GLOBAL_SEARCH_GROUP_ORDER: GlobalSearchKind[] = [
  'patient',
  'appointment',
  'prescription',
  'invoice',
  'prosthesis',
  'dentist',
  'medication',
]
