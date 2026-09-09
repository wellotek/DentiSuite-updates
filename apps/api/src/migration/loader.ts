import { readFileSync, statSync } from 'node:fs';
import { issue, type Issue } from './issues.js';
import {
  localClinicSchema,
  localStoreEnvelopeSchema,
  SUPPORTED_CLINIC_SCHEMA_VERSION,
  type LocalClinic,
} from './source-schema.js';

export class MalformedStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedStoreError';
  }
}

export type LoadedStore = {
  sourcePath: string;
  sourceBytes: number;
  zoomFactor: unknown;
  clinic: LocalClinic;
  schemaVersion: number;
  organizationIdInSource: unknown;
  issues: Issue[];
};

/** Read-only. Never writes the source file. */
export function loadLocalStore(sourcePath: string): LoadedStore {
  let raw: string;
  try {
    raw = readFileSync(sourcePath, 'utf8');
  } catch {
    throw new MalformedStoreError(`Cannot read store JSON: ${sourcePath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new MalformedStoreError('Malformed JSON: dentisuite-store.json is not valid JSON');
  }

  const envelope = localStoreEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) {
    throw new MalformedStoreError('Store envelope must be an object with a clinic field');
  }
  if (envelope.data.clinic == null) {
    throw new MalformedStoreError('clinic is missing or null');
  }

  const clinicParsed = localClinicSchema.safeParse(envelope.data.clinic);
  if (!clinicParsed.success) {
    throw new MalformedStoreError('clinic does not match schemaVersion-8 collection shape');
  }

  const issues: Issue[] = [];
  const schemaVersion = clinicParsed.data.schemaVersion;
  if (schemaVersion !== SUPPORTED_CLINIC_SCHEMA_VERSION) {
    issues.push(
      issue(
        'ERROR',
        'SCHEMA_VERSION',
        'clinic',
        `schemaVersion ${schemaVersion} is not supported (expected ${SUPPORTED_CLINIC_SCHEMA_VERSION})`,
        { details: { schemaVersion } },
      ),
    );
  }

  const clinicObj = envelope.data.clinic as Record<string, unknown>;
  const organizationIdInSource =
    clinicObj.organizationId ??
    (parsed && typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>).organizationId
      : undefined);
  if (organizationIdInSource !== undefined) {
    issues.push(
      issue(
        'WARNING',
        'ORGANIZATION_ID_IN_SOURCE_IGNORED',
        'clinic',
        'organizationId in JSON is ignored; target comes from trusted migration config only',
      ),
    );
  }

  const sourceBytes = statSync(sourcePath).size;

  return {
    sourcePath,
    sourceBytes,
    zoomFactor: envelope.data.zoomFactor,
    clinic: clinicParsed.data,
    schemaVersion,
    organizationIdInSource,
    issues,
  };
}
