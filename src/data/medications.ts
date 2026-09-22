import type { MedicationItem } from '../types'
import { MIPH_NOMENCLATURE_META } from './miphNomenclatureMeta'
import miphPayload from './miph-nomenclature-aout-2026.json'

/**
 * Catalogue médicaments DentiSuite — source officielle MIPH (Algérie).
 * Ne contient aucune posologie, indication ou recommandation thérapeutique.
 */
export const MEDICATION_SOURCE_LABEL = MIPH_NOMENCLATURE_META.source

export const MEDICATION_SOURCE_VERSION = MIPH_NOMENCLATURE_META.sourceVersion

export const MEDICATION_SOURCE_URL = MIPH_NOMENCLATURE_META.sourceUrl

export const MEDICATION_IMPORT_DATE = MIPH_NOMENCLATURE_META.importedAt

export const CUSTOM_MEDICATION_SOURCE = 'Catalogue personnalisé cabinet'

/** Entrées officielles importées (Nomenclature Nationale). */
export const seedMedications: MedicationItem[] = (
  miphPayload.medications as MedicationItem[]
).map((m) => ({
  ...m,
  origin: m.origin ?? 'official',
  status: m.status ?? 'active',
}))
