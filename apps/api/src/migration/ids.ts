import { createHash } from 'node:crypto';

/**
 * Deterministic UUID v5 mapping.
 *
 * name = `${targetOrganizationId}:${entityType}:${localId}`
 * Same org + same local JSON ids → same Cloud UUIDs on every rerun.
 * Local timestamp ids are never reused as Cloud primary keys.
 */
export const DENTISUITE_MIGRATION_NAMESPACE = 'a8e3c7b0-4f21-5d96-8c44-0b1d2e3f4a5b';

export const MAPPING_ENTITY_TYPES = [
  'dentist',
  'patient',
  'appointment',
  'session',
  'treatment',
  'prescription',
  'prescriptionLine',
  'invoice',
  'stock',
  'prosthesis',
  'media',
] as const;

export type MappingEntityType = (typeof MAPPING_ENTITY_TYPES)[number];

export type IdMaps = Record<MappingEntityType, Map<string, string>>;

function uuidToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) {
    throw new Error('Invalid UUID namespace');
  }
  return Buffer.from(hex, 'hex');
}

/** RFC 4122 UUID version 5 (SHA-1). */
export function uuidV5(name: string, namespace = DENTISUITE_MIGRATION_NAMESPACE): string {
  const hash = createHash('sha1')
    .update(uuidToBytes(namespace))
    .update(name, 'utf8')
    .digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function mappedUuid(
  organizationId: string,
  entityType: MappingEntityType,
  localId: string,
): string {
  return uuidV5(`${organizationId}:${entityType}:${localId}`);
}

export function emptyIdMaps(): IdMaps {
  return {
    dentist: new Map(),
    patient: new Map(),
    appointment: new Map(),
    session: new Map(),
    treatment: new Map(),
    prescription: new Map(),
    prescriptionLine: new Map(),
    invoice: new Map(),
    stock: new Map(),
    prosthesis: new Map(),
    media: new Map(),
  };
}

export function mappingCounts(maps: IdMaps): Record<MappingEntityType, number> {
  return {
    dentist: maps.dentist.size,
    patient: maps.patient.size,
    appointment: maps.appointment.size,
    session: maps.session.size,
    treatment: maps.treatment.size,
    prescription: maps.prescription.size,
    prescriptionLine: maps.prescriptionLine.size,
    invoice: maps.invoice.size,
    stock: maps.stock.size,
    prosthesis: maps.prosthesis.size,
    media: maps.media.size,
  };
}
