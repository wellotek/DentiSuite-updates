import { asLocalEntity, localNumber, localString, type LocalClinic } from './source-schema.js';
import type { DryRunResult } from './dry-run.js';
import { mappedUuid } from './ids.js';

export type WalkInReport = {
  patientlessInvoices: number;
  patientlessPrescriptions: number;
  invoiceIds: string[];
  prescriptionIds: string[];
  migrated: false;
};

export type EmptyPhoneReport = {
  count: number;
  patientIds: string[];
  inventedPhone: false;
  sourceModified: false;
};

export type SettingsImpactRow = {
  key: string;
  classification: 'business-critical' | 'ui-only' | 'envelope-ui' | 'unknown-treat-as-business-critical';
  cloudDestination: string;
};

export type SettingsReport = {
  migrated: false;
  keys: SettingsImpactRow[];
  businessCritical: string[];
  uiOnly: string[];
  impact: string;
};

export type CatalogReport = {
  migrated: false;
  catalogEntryCount: number;
  catalogIds: string[];
  referencedActIds: string[];
  unusedCatalogIds: string[];
  usedActIdsWithoutCatalog: string[];
  treatmentsKeepActCodeActId: true;
  plannedTreatmentsWithAct: number;
  plannedTreatmentsWithCode: number;
  plannedTreatmentsWithActId: number;
};

export type DentistMappingReport = {
  localDentists: Array<{ localId: string; cloudId: string }>;
  unmappedReferences: Array<{ entity: string; localId: string; dentistId: string }>;
  resolved: boolean;
};

export type MoneyValueRow = { localId: string; original: unknown; integer: boolean; zeroOrNegative: boolean };

export type MoneyReport = {
  treatmentCosts: MoneyValueRow[];
  invoiceAmounts: MoneyValueRow[];
  nonIntegerTreatments: number;
  nonIntegerInvoices: number;
  zeroOrNegativeTreatments: number;
  zeroOrNegativeInvoices: number;
  silentConversion: false;
};

export type MediaPilotReport = {
  metadataCount: number;
  filesFound: number;
  filesMissing: number;
  sizeMismatch: number;
  unsupported: number;
  imageCount: number;
  dicomCount: number;
  uploaded: false;
};

const BUSINESS_SETTINGS = new Set(['name', 'address', 'phone', 'email', 'logo', 'adminPhoto']);
const UI_SETTINGS = new Set(['dateFormat', 'timeFormat', 'timezone', 'locale']);

function entityId(row: Record<string, unknown>): string {
  return localString(row.id)?.trim() || '(missing-id)';
}

export function walkInReport(clinic: LocalClinic): WalkInReport {
  const invoiceIds: string[] = [];
  for (const raw of clinic.invoices) {
    const row = asLocalEntity(raw);
    if (!localString(row.patientId)?.trim()) invoiceIds.push(entityId(row));
  }
  const prescriptionIds: string[] = [];
  for (const raw of clinic.prescriptions) {
    const row = asLocalEntity(raw);
    if (!localString(row.patientId)?.trim()) prescriptionIds.push(entityId(row));
  }
  return {
    patientlessInvoices: invoiceIds.length,
    patientlessPrescriptions: prescriptionIds.length,
    invoiceIds,
    prescriptionIds,
    migrated: false,
  };
}

export function emptyPhoneReport(clinic: LocalClinic): EmptyPhoneReport {
  const patientIds: string[] = [];
  for (const raw of clinic.patients) {
    const row = asLocalEntity(raw);
    const phone = localString(row.phone) ?? '';
    if (!phone.trim()) patientIds.push(entityId(row));
  }
  return { count: patientIds.length, patientIds, inventedPhone: false, sourceModified: false };
}

export function settingsReport(clinic: LocalClinic, zoomFactor: unknown): SettingsReport {
  const keys: SettingsImpactRow[] = [];
  const settings = clinic.settings ?? {};
  for (const key of Object.keys(settings)) {
    if (BUSINESS_SETTINGS.has(key)) {
      keys.push({
        key,
        classification: 'business-critical',
        cloudDestination: key === 'name' ? 'Organization.name only if --copy-organization-name (default off)' : 'none',
      });
    } else if (UI_SETTINGS.has(key)) {
      keys.push({ key, classification: 'ui-only', cloudDestination: 'none' });
    } else {
      keys.push({
        key,
        classification: 'unknown-treat-as-business-critical',
        cloudDestination: 'none',
      });
    }
  }
  keys.push({
    key: 'zoomFactor',
    classification: 'envelope-ui',
    cloudDestination: `none (value=${String(zoomFactor)})`,
  });
  return {
    migrated: false,
    keys,
    businessCritical: keys.filter((k) => k.classification !== 'ui-only' && k.classification !== 'envelope-ui').map((k) => k.key),
    uiOnly: keys.filter((k) => k.classification === 'ui-only' || k.classification === 'envelope-ui').map((k) => k.key),
    impact: 'ClinicSettings are not represented in Cloud. Nothing is copied except optional Organization.name.',
  };
}

export function catalogReport(clinic: LocalClinic, dry: DryRunResult): CatalogReport {
  const catalogIds: string[] = [];
  for (const raw of clinic.actCatalog) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const id = localString((raw as Record<string, unknown>).id)?.trim();
    if (id) catalogIds.push(id);
  }
  const catalogSet = new Set(catalogIds);
  const referenced: string[] = [];
  for (const raw of clinic.treatments) {
    const actId = localString(asLocalEntity(raw).actId)?.trim();
    if (actId) referenced.push(actId);
  }
  const referencedSet = new Set(referenced);
  return {
    migrated: false,
    catalogEntryCount: clinic.actCatalog.length,
    catalogIds,
    referencedActIds: [...referencedSet],
    unusedCatalogIds: catalogIds.filter((id) => !referencedSet.has(id)),
    usedActIdsWithoutCatalog: [...referencedSet].filter((id) => !catalogSet.has(id)),
    treatmentsKeepActCodeActId: true,
    plannedTreatmentsWithAct: dry.planned.treatments.filter((t) => t.act.length > 0).length,
    plannedTreatmentsWithCode: dry.planned.treatments.filter((t) => t.code.length > 0).length,
    plannedTreatmentsWithActId: dry.planned.treatments.filter((t) => t.actId).length,
  };
}

export function dentistMappingReport(clinic: LocalClinic, organizationId: string): DentistMappingReport {
  const localDentists: DentistMappingReport['localDentists'] = [];
  const known = new Set<string>();
  for (const raw of clinic.dentists) {
    const localId = localString(asLocalEntity(raw).id)?.trim();
    if (!localId) continue;
    known.add(localId);
    localDentists.push({ localId, cloudId: mappedUuid(organizationId, 'dentist', localId) });
  }
  const unmappedReferences: DentistMappingReport['unmappedReferences'] = [];
  const scan = (rows: unknown[], entity: string) => {
    for (const raw of rows) {
      const row = asLocalEntity(raw);
      const dentistId = localString(row.dentistId)?.trim();
      if (!dentistId) continue;
      if (!known.has(dentistId)) {
        unmappedReferences.push({ entity, localId: entityId(row), dentistId });
      }
    }
  };
  scan(clinic.patients, 'patient');
  scan(clinic.appointments, 'appointment');
  scan(clinic.prescriptions, 'prescription');
  return { localDentists, unmappedReferences, resolved: unmappedReferences.length === 0 };
}

function moneyRow(localId: string, raw: unknown): MoneyValueRow {
  const parsed = localNumber(raw);
  return {
    localId,
    original: raw,
    integer: parsed !== undefined && Number.isInteger(parsed),
    zeroOrNegative: parsed !== undefined && parsed <= 0,
  };
}

export function moneyReport(clinic: LocalClinic): MoneyReport {
  const treatmentCosts = clinic.treatments.map((raw) => {
    const row = asLocalEntity(raw);
    return moneyRow(entityId(row), row.cost);
  });
  const invoiceAmounts = clinic.invoices.map((raw) => {
    const row = asLocalEntity(raw);
    return moneyRow(entityId(row), row.amount);
  });
  return {
    treatmentCosts,
    invoiceAmounts,
    nonIntegerTreatments: treatmentCosts.filter((r) => typeof r.original === 'number' && !r.integer).length,
    nonIntegerInvoices: invoiceAmounts.filter((r) => typeof r.original === 'number' && !r.integer).length,
    zeroOrNegativeTreatments: treatmentCosts.filter((r) => r.zeroOrNegative).length,
    zeroOrNegativeInvoices: invoiceAmounts.filter((r) => r.zeroOrNegative).length,
    silentConversion: false,
  };
}

export function mediaPilotReport(dry: DryRunResult): MediaPilotReport {
  const resolutions = dry.mediaResolutions;
  return {
    metadataCount: dry.loaded.clinic.mediaFiles.length,
    filesFound: resolutions.filter((r) => r.found).length,
    filesMissing: dry.report.skipped.filter((i) => i.code === 'MISSING_MEDIA').length,
    sizeMismatch: dry.report.skipped.filter((i) => i.code === 'MEDIA_SIZE_MISMATCH').length,
    unsupported: dry.report.skipped.filter((i) => i.code === 'UNSUPPORTED_MEDIA').length,
    imageCount: dry.loaded.clinic.mediaFiles.filter((raw) => localString(asLocalEntity(raw).kind) === 'image').length,
    dicomCount: dry.loaded.clinic.mediaFiles.filter((raw) => localString(asLocalEntity(raw).kind) === 'dicom').length,
    uploaded: false,
  };
}
