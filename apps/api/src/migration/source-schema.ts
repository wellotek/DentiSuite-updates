import { z } from 'zod';

export const SUPPORTED_CLINIC_SCHEMA_VERSION = 8;

const looseRecord = z.record(z.string(), z.unknown());

export const localToothStatuses = [
  'saine',
  'carie',
  'a_traiter',
  'traitee',
  'obturation',
  'couronne',
  'extraction',
  'implant',
  'facette',
  'a_surveiller',
] as const;

export const localAppointmentStatuses = ['confirme', 'en_salle', 'termine', 'annule'] as const;
export const localAppointmentCategories = [
  'urgence',
  'consultation',
  'controle',
  'soin',
  'extraction',
  'prothese',
] as const;
export const localCareStatuses = ['a_faire', 'fait'] as const;
export const localPaymentStatuses = ['paye', 'en_attente', 'partiel'] as const;
export const localStockCategories = ['consommable', 'prothese', 'hygiene', 'medicament'] as const;
export const localProsthesisStatuses = [
  'envoye',
  'fabrication',
  'recu',
  'pose',
  'annulee',
] as const;
export const localMediaKinds = ['image', 'dicom'] as const;

export const localClinicSchema = z
  .object({
    schemaVersion: z.number().int(),
    patients: z.array(looseRecord).default([]),
    appointments: z.array(looseRecord).default([]),
    sessions: z.array(looseRecord).default([]),
    treatments: z.array(looseRecord).default([]),
    prescriptions: z.array(looseRecord).default([]),
    dentists: z.array(looseRecord).default([]),
    mediaFiles: z.array(looseRecord).default([]),
    invoices: z.array(looseRecord).default([]),
    stockItems: z.array(looseRecord).default([]),
    prostheses: z.array(looseRecord).default([]),
    settings: z.record(z.string(), z.unknown()).optional(),
    actCatalog: z.array(z.unknown()).default([]),
  })
  .passthrough();

export const localStoreEnvelopeSchema = z
  .object({
    clinic: z.unknown(),
    zoomFactor: z.unknown().optional(),
  })
  .passthrough();

export type LocalClinic = z.infer<typeof localClinicSchema>;
export type LocalEntity = Record<string, unknown> & { id?: unknown };

export function asLocalEntity(raw: unknown): LocalEntity {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return raw as LocalEntity;
}

export function localString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value;
}

export function localNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

export function localBoolean(value: unknown): boolean | undefined {
  if (typeof value !== 'boolean') return undefined;
  return value;
}
