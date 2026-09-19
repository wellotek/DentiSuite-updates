import type { MedicationItem, PrescriptionLine } from '../types'
import { seedMedications } from '../data/medications'

export function mergeMedicationCatalog(
  clinicCatalog: MedicationItem[] | undefined,
): MedicationItem[] {
  const custom = clinicCatalog || []
  const byId = new Map<string, MedicationItem>()
  for (const m of seedMedications) byId.set(m.id, m)
  for (const m of custom) byId.set(m.id, m)
  return Array.from(byId.values())
}

export function searchMedications(
  catalog: MedicationItem[],
  query: string,
  limit = 12,
): MedicationItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const active = catalog.filter((m) => m.status !== 'inactive')
  const scored = active
    .map((m) => {
      const name = m.name.toLowerCase()
      const dci = m.dci.toLowerCase()
      const dosage = (m.dosage || '').toLowerCase()
      let score = 0
      if (name.startsWith(q)) score += 100
      else if (name.includes(q)) score += 60
      if (dci.startsWith(q)) score += 80
      else if (dci.includes(q)) score += 40
      if (dosage.includes(q)) score += 20
      return { m, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.m.name.localeCompare(b.m.name))
  return scored.slice(0, limit).map((x) => x.m)
}

export function medicationLabel(m: MedicationItem): string {
  return [m.name, m.dosage, m.form].filter(Boolean).join(' · ')
}

/** Snapshot catalog fields onto a prescription line (does not mutate catalog). */
export function applyMedicationToLine(
  line: PrescriptionLine,
  med: MedicationItem,
): PrescriptionLine {
  const drug = [med.name, med.dosage, med.form].filter(Boolean).join(' ').trim()
  return {
    ...line,
    drug,
    medicationId: med.id,
    dci: med.dci,
    form: med.form,
    dosage: med.dosage,
  }
}

export const MEDICATION_IMPORT_FIELDS = [
  'id',
  'name',
  'dci',
  'dosage',
  'form',
  'route',
  'family',
  'market',
  'status',
  'source',
] as const
