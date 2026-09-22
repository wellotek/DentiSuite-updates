import type { MedicationItem, PrescriptionLine } from '../types'
import { seedMedications, CUSTOM_MEDICATION_SOURCE } from '../data/medications'
import { MIPH_NOMENCLATURE_META } from '../data/miphNomenclatureMeta'

export { CUSTOM_MEDICATION_SOURCE }

const foldCache = new Map<string, string>()

/** Normalise pour recherche : casse, accents, espaces. */
export function normalizeMedicationQuery(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+./%-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function searchBlob(m: MedicationItem): string {
  const cached = foldCache.get(m.id)
  if (cached) return cached
  const blob = normalizeMedicationQuery(
    [m.name, m.dci, m.form, m.dosage, m.packaging, m.laboratory, m.officialCode, m.registrationNumber]
      .filter(Boolean)
      .join(' '),
  )
  foldCache.set(m.id, blob)
  return blob
}

/**
 * Fusionne le catalogue officiel MIPH avec les entrées cabinet (personnalisées / overrides).
 * Les entrées clinic avec le même id remplacent le seed (ex. soft-disable).
 * Les médicaments custom (origin=custom) restent distincts.
 */
export function mergeMedicationCatalog(
  clinicCatalog: MedicationItem[] | undefined,
): MedicationItem[] {
  const custom = clinicCatalog || []
  const byId = new Map<string, MedicationItem>()
  for (const m of seedMedications) byId.set(m.id, m)
  for (const m of custom) byId.set(m.id, { ...m, origin: m.origin ?? 'custom' })
  return Array.from(byId.values())
}

export function searchMedications(
  catalog: MedicationItem[],
  query: string,
  limit = 12,
  options?: { favoriteIds?: string[] },
): MedicationItem[] {
  const q = normalizeMedicationQuery(query)
  if (!q) return []
  const tokens = q.split(' ').filter(Boolean)
  const fav = new Set(options?.favoriteIds ?? [])
  const active = catalog.filter((m) => m.status !== 'inactive')

  const scored = active
    .map((m) => {
      const name = normalizeMedicationQuery(m.name)
      const dci = normalizeMedicationQuery(m.dci)
      const form = normalizeMedicationQuery(m.form || '')
      const dosage = normalizeMedicationQuery(m.dosage || '')
      const blob = searchBlob(m)
      if (!tokens.every((t) => blob.includes(t))) return null

      let score = 0
      if (name.startsWith(q)) score += 120
      else if (name.includes(q)) score += 70
      if (dci.startsWith(q)) score += 100
      else if (dci.includes(q)) score += 55
      if (form.includes(q)) score += 25
      if (dosage.includes(q)) score += 25
      if (fav.has(m.id)) score += 40
      return { m, score }
    })
    .filter((x): x is { m: MedicationItem; score: number } => x != null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(fav.has(b.m.id)) - Number(fav.has(a.m.id)) ||
        a.m.name.localeCompare(b.m.name, 'fr'),
    )

  return scored.slice(0, limit).map((x) => x.m)
}

export function medicationLabel(m: MedicationItem): string {
  return [m.name, m.dosage, m.form].filter(Boolean).join(' · ')
}

export function medicationSuggestionSecondary(m: MedicationItem): string {
  return [m.dosage, m.form, m.dci, m.origin === 'custom' ? 'Personnalisé' : null]
    .filter(Boolean)
    .join(' · ')
}

/** Snapshot catalog fields onto a prescription line (does not mutate catalog / no posology). */
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
    // Conditionnement nomenclature = info produit, pas une posologie.
    quantity: line.quantity?.trim() ? line.quantity : med.packaging || line.quantity,
  }
}

/**
 * Réapplique une nouvelle nomenclature officielle sur le catalogue cabinet.
 * - upsert les entrées official par id
 * - ne touche pas aux custom
 * - soft-désactive les official absents de la nouvelle version (pas de purge)
 */
export function applyOfficialMedicationImport(
  clinicCatalog: MedicationItem[],
  official: MedicationItem[],
): MedicationItem[] {
  const officialIds = new Set(official.map((m) => m.id))
  const byId = new Map<string, MedicationItem>()

  for (const m of clinicCatalog) {
    if (m.origin === 'custom' || m.source === CUSTOM_MEDICATION_SOURCE) {
      byId.set(m.id, m)
    } else if (!officialIds.has(m.id)) {
      byId.set(m.id, { ...m, status: 'inactive', origin: 'official' })
    }
  }

  for (const m of official) {
    const prev = clinicCatalog.find((c) => c.id === m.id)
    byId.set(m.id, {
      ...m,
      origin: 'official',
      // conserver soft-disable local si déjà désactivé
      status: prev?.status === 'inactive' ? 'inactive' : m.status,
    })
  }

  return Array.from(byId.values())
}

export const MEDICATION_IMPORT_FIELDS = [
  'id',
  'name',
  'dci',
  'dosage',
  'form',
  'packaging',
  'laboratory',
  'officialCode',
  'registrationNumber',
  'origin',
  'status',
  'source',
  'sourceVersion',
  'importedAt',
] as const

export const OFFICIAL_NOMENCLATURE_META = MIPH_NOMENCLATURE_META
