/**
 * Historical data policy (Phase 1) — LIVE vs SNAPSHOT.
 *
 * SNAPSHOT (immutable after save — do not rewrite from live catalogs):
 * - Prescription.patientName, patientBirthDate, patientAge
 * - PrescriptionItem.drug, posology, duration, notes, medicationId, dci, form, dosage, quantity
 * - Treatment.act, code, cost (point-in-time tariff)
 * - Invoice.patientName, amount, label
 * - Appointment.patientName, patientPhone, practitioner (denormalized display)
 *
 * LIVE (may change when source changes):
 * - Patient identity on chart / lists
 * - actCatalog / medicationCatalog entries (reference only)
 * - Clinic settings (name/logo) used at print time for NEW prints
 *   (already-printed PDFs are not regenerated automatically)
 *
 * Catalog changes MUST NOT mutate historical PrescriptionItem rows.
 */
export const HISTORICAL_SNAPSHOT_POLICY = {
  prescriptionIdentity: 'SNAPSHOT',
  prescriptionLines: 'SNAPSHOT',
  treatmentTariff: 'SNAPSHOT',
  invoiceAmount: 'SNAPSHOT',
  appointmentPatientName: 'SNAPSHOT',
  medicationCatalog: 'LIVE_REFERENCE',
  actCatalog: 'LIVE_REFERENCE',
} as const
