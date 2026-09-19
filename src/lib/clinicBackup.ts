import type { ClinicState } from '../types'
import { CLINIC_SCHEMA_VERSION, seedClinic } from '../data/seed'
import { migrateClinic } from './storage'

export const BACKUP_FORMAT = 'dentisuite-clinic-backup'
export const BACKUP_FORMAT_VERSION = 1

export type ClinicBackupPayload = {
  format: typeof BACKUP_FORMAT
  formatVersion: number
  createdAt: string
  appVersion: string
  mode: 'LEGACY' | 'CLOUD_EXPORT'
  clinic: ClinicState
  /** Media dataUrls may be large — included only when present on clinic.mediaFiles. */
  note: string
}

export function buildClinicBackup(
  clinic: ClinicState,
  options: { appVersion: string; mode: 'LEGACY' | 'CLOUD_EXPORT' },
): ClinicBackupPayload {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: options.appVersion,
    mode: options.mode,
    clinic: {
      ...clinic,
      schemaVersion: clinic.schemaVersion || CLINIC_SCHEMA_VERSION,
    },
    note:
      options.mode === 'CLOUD_EXPORT'
        ? 'Export cabinet Cloud — ne remplace pas un backup serveur PostgreSQL/R2.'
        : 'Sauvegarde LEGACY locale — restaurable dans Paramètres.',
  }
}

export function validateClinicBackup(raw: unknown):
  | { ok: true; data: ClinicBackupPayload }
  | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: 'Fichier invalide' }
  }
  const o = raw as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(o, '__proto__')) {
    return { ok: false, message: 'Fichier de sauvegarde refusé' }
  }
  if (o.format !== BACKUP_FORMAT) return { ok: false, message: 'Format de sauvegarde inconnu' }
  if (typeof o.formatVersion !== 'number' || o.formatVersion > BACKUP_FORMAT_VERSION) {
    return { ok: false, message: 'Version de sauvegarde non supportée' }
  }
  if (o.formatVersion < 1) return { ok: false, message: 'Version de sauvegarde non supportée' }
  if (!o.clinic || typeof o.clinic !== 'object' || Array.isArray(o.clinic)) {
    return { ok: false, message: 'Clinic manquante' }
  }
  const clinic = o.clinic as ClinicState
  if (!Array.isArray(clinic.patients)) return { ok: false, message: 'patients manquants' }
  return { ok: true, data: o as unknown as ClinicBackupPayload }
}

/** Migrate + normalize clinic from backup before applying. */
export function clinicFromBackup(payload: ClinicBackupPayload): ClinicState {
  const migrated = migrateClinic(payload.clinic)
  return {
    ...migrated,
    settings: { ...seedClinic.settings, ...migrated.settings },
    medicationCatalog: migrated.medicationCatalog ?? [],
  }
}

export function downloadJsonBackup(payload: ClinicBackupPayload, filename?: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    filename ||
    `dentisuite-backup-${payload.mode.toLowerCase()}-${payload.createdAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function readBackupFile(file: File): Promise<unknown> {
  const text = await file.text()
  return JSON.parse(text) as unknown
}
