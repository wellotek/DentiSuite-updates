import type { MigrationConfig } from './config.js';
import { assertDryRunOnly } from './apply-gate.js';
import { issue, type Issue } from './issues.js';
import {
  emptyIdMaps,
  mappedUuid,
  mappingCounts,
  type IdMaps,
  type MappingEntityType,
} from './ids.js';
import { loadLocalStore, type LoadedStore } from './loader.js';
import { resolveMediaEntry, type MediaResolution } from './media.js';
import { toWholeDa } from './money.js';
import { MIGRATION_PLAN_ORDER } from './planner.js';
import { asLocalEntity, localString, type LocalClinic } from './source-schema.js';
import {
  collectDuplicateIds,
  emptyToNullDate,
  inEnum,
  localAppointmentCategories,
  localAppointmentStatuses,
  localBoolean,
  localCareStatuses,
  localMediaKinds,
  localNumber,
  localPaymentStatuses,
  localProsthesisStatuses,
  localStockCategories,
  requireId,
  validateCivilDate,
  validateTeeth,
  validateWallClock,
} from './validate.js';

export type EntityCounts = {
  source: number;
  valid: number;
  skipped: number;
  errors: number;
};

export type PlannedPatient = {
  localId: string;
  cloudId: string;
  firstName: string;
  lastName: string;
  phone: string;
  age: number;
  address: string;
  antecedents: string;
  hasAllergies: boolean;
  dentistId: string | null;
  teeth: Record<string, unknown>;
  notes: string | null;
};

export type PlannedAppointment = {
  localId: string;
  cloudId: string;
  patientId: string;
  date: string;
  time: string;
  durationMin: number;
  patientName: string;
  patientPhone: string;
  motif: string;
  practitioner: string;
  dentistId: string | null;
  status: string;
  category: string;
};

export type PlannedSession = {
  localId: string;
  cloudId: string;
  patientId: string;
  date: string;
  time: string;
  teeth: string[];
  acts: string;
  notes: string;
  prescription: string;
};

export type PlannedTreatment = {
  localId: string;
  cloudId: string;
  patientId: string;
  date: string;
  tooth: string;
  act: string;
  code: string;
  cost: number;
  comment: string;
  careStatus: string;
  paymentStatus: string;
  actId: string | null;
};

export type PlannedPrescription = {
  localId: string;
  cloudId: string;
  patientId: string;
  patientName: string;
  date: string;
  title: string;
  templateId: string | null;
  advice: string;
  dentistId: string | null;
  dentistName: string;
  lines: Array<{
    localId: string;
    cloudId: string;
    drug: string;
    posology: string;
    duration: string;
    notes: string;
    sortOrder: number;
  }>;
};

export type PlannedInvoice = {
  localId: string;
  cloudId: string;
  patientId: string;
  patientName: string;
  label: string;
  amount: number;
  paid: boolean;
  date: string;
  treatmentId: string | null;
};

export type PlannedStock = {
  localId: string;
  cloudId: string;
  code: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  addedAt: string;
  expiryDate: string | null;
  supplier: string;
};

export type PlannedProsthesis = {
  localId: string;
  cloudId: string;
  patientId: string;
  patientName: string;
  type: string;
  tooth: string;
  lab: string;
  sentAt: string;
  expectedAt: string | null;
  notes: string;
  status: string;
};

export type PlannedMedia = {
  localId: string;
  cloudId: string;
  patientId: string;
  title: string;
  kind: string;
  mime: string;
  originalName: string;
  size: number;
  storageKey: string;
};

export type PlannedEntities = {
  dentists: Array<{
    localId: string;
    cloudId: string;
    firstName: string;
    lastName: string;
    specialty: string;
    photo: string;
    color: string;
  }>;
  patients: PlannedPatient[];
  appointments: PlannedAppointment[];
  sessions: PlannedSession[];
  treatments: PlannedTreatment[];
  prescriptions: PlannedPrescription[];
  invoices: PlannedInvoice[];
  stock: PlannedStock[];
  prostheses: PlannedProsthesis[];
  media: PlannedMedia[];
};

export type MigrationReport = {
  metadata: {
    sourcePath: string;
    schemaVersion: number;
    targetOrganizationId: string;
    mode: 'DRY_RUN';
    startedAt: string;
    finishedAt: string;
    strict: boolean;
    copyOrganizationName: boolean;
  };
  counts: Record<string, EntityCounts>;
  mappings: ReturnType<typeof mappingCounts>;
  warnings: Issue[];
  skipped: Issue[];
  errors: Issue[];
  infos: Issue[];
  orphanReferences: Issue[];
  missingMedia: Issue[];
  deferred: {
    settings: 'DEFERRED';
    actCatalog: 'DEFERRED';
    zoomFactor: 'IGNORE';
  };
  plannedOrder: readonly string[];
  databaseWrites: 0;
  storageWrites: 0;
  ok: boolean;
};

export type DryRunResult = {
  report: MigrationReport;
  maps: IdMaps;
  planned: PlannedEntities;
  loaded: LoadedStore;
  mediaResolutions: MediaResolution[];
  organizationNameCopy: string | null;
};

const COUNT_KEYS = [
  'dentists',
  'patients',
  'appointments',
  'sessions',
  'treatments',
  'prescriptions',
  'prescriptionLines',
  'invoices',
  'stockItems',
  'prostheses',
  'mediaFiles',
] as const;

function emptyCounts(): EntityCounts {
  return { source: 0, valid: 0, skipped: 0, errors: 0 };
}

function bump(counts: EntityCounts, kind: 'valid' | 'skipped' | 'errors'): void {
  counts[kind] += 1;
}

function failOrSkip(
  strict: boolean,
  issues: Issue[],
  code: string,
  entity: string,
  message: string,
  localId?: string,
  details?: Record<string, unknown>,
): 'error' | 'skip' {
  issues.push(
    issue(strict ? 'ERROR' : 'SKIPPED', code, entity, message, { localId, details }),
  );
  return strict ? 'error' : 'skip';
}

function registerIds(
  maps: IdMaps,
  type: MappingEntityType,
  rows: unknown[],
  organizationId: string,
  duplicates: Set<string>,
): void {
  for (const raw of rows) {
    const row = asLocalEntity(raw);
    const id = localString(row.id)?.trim();
    if (!id || duplicates.has(id) && maps[type].has(id)) continue;
    if (!id) continue;
    if (maps[type].has(id)) continue;
    maps[type].set(id, mappedUuid(organizationId, type, id));
  }
}

function remapDentist(
  localDentistId: string | undefined,
  maps: IdMaps,
  issues: Issue[],
  entity: string,
  localId: string,
): string | null {
  if (!localDentistId) return null;
  const cloud = maps.dentist.get(localDentistId);
  if (!cloud) {
    issues.push(
      issue(
        'WARNING',
        'ORPHAN_DENTIST',
        entity,
        'dentistId does not match a local dentist; will be null (dentist not invented)',
        { localId, details: { dentistId: localDentistId } },
      ),
    );
    return null;
  }
  return cloud;
}

export function runDryRun(config: MigrationConfig): DryRunResult {
  assertDryRunOnly(config.dryRun);
  const startedAt = new Date().toISOString();
  const loaded = loadLocalStore(config.sourceJsonPath);
  const issues: Issue[] = [...loaded.issues];
  const clinic: LocalClinic = loaded.clinic;
  const strict = config.strict;
  const orgId = config.targetOrganizationId;

  issues.push(
    issue('INFO', 'ZOOM_FACTOR_IGNORED', 'zoomFactor', 'zoomFactor is UI-only and is not migrated', {
      details: { zoomFactor: loaded.zoomFactor },
    }),
  );
  issues.push(
    issue('INFO', 'SETTINGS_DEFERRED', 'settings', 'ClinicSettings has no Cloud model; DEFERRED', {
      details: { copyOrganizationName: config.copyOrganizationName },
    }),
  );
  issues.push(
    issue(
      'INFO',
      'ACT_CATALOG_DEFERRED',
      'actCatalog',
      'ActCatalog has no Cloud model; Treatment.act/code/actId stay opaque strings',
      { details: { count: clinic.actCatalog.length } },
    ),
  );

  const counts: Record<string, EntityCounts> = {};
  for (const key of COUNT_KEYS) counts[key] = emptyCounts();
  counts.dentists.source = clinic.dentists.length;
  counts.patients.source = clinic.patients.length;
  counts.appointments.source = clinic.appointments.length;
  counts.sessions.source = clinic.sessions.length;
  counts.treatments.source = clinic.treatments.length;
  counts.prescriptions.source = clinic.prescriptions.length;
  counts.invoices.source = clinic.invoices.length;
  counts.stockItems.source = clinic.stockItems.length;
  counts.prostheses.source = clinic.prostheses.length;
  counts.mediaFiles.source = clinic.mediaFiles.length;
  counts.prescriptionLines.source = clinic.prescriptions.reduce((n, raw) => {
    const lines = (asLocalEntity(raw).lines as unknown[] | undefined) ?? [];
    return n + (Array.isArray(lines) ? lines.length : 0);
  }, 0);

  const dupDentists = collectDuplicateIds(clinic.dentists, 'dentist', issues);
  const dupPatients = collectDuplicateIds(clinic.patients, 'patient', issues);
  const dupAppointments = collectDuplicateIds(clinic.appointments, 'appointment', issues);
  const dupSessions = collectDuplicateIds(clinic.sessions, 'session', issues);
  const dupTreatments = collectDuplicateIds(clinic.treatments, 'treatment', issues);
  const dupPrescriptions = collectDuplicateIds(clinic.prescriptions, 'prescription', issues);
  const dupInvoices = collectDuplicateIds(clinic.invoices, 'invoice', issues);
  const dupStock = collectDuplicateIds(clinic.stockItems, 'stock', issues);
  const dupProstheses = collectDuplicateIds(clinic.prostheses, 'prosthesis', issues);
  const dupMedia = collectDuplicateIds(clinic.mediaFiles, 'media', issues);

  const maps = emptyIdMaps();
  registerIds(maps, 'dentist', clinic.dentists, orgId, dupDentists);
  registerIds(maps, 'patient', clinic.patients, orgId, dupPatients);
  registerIds(maps, 'appointment', clinic.appointments, orgId, dupAppointments);
  registerIds(maps, 'session', clinic.sessions, orgId, dupSessions);
  registerIds(maps, 'treatment', clinic.treatments, orgId, dupTreatments);
  registerIds(maps, 'prescription', clinic.prescriptions, orgId, dupPrescriptions);
  registerIds(maps, 'invoice', clinic.invoices, orgId, dupInvoices);
  registerIds(maps, 'stock', clinic.stockItems, orgId, dupStock);
  registerIds(maps, 'prosthesis', clinic.prostheses, orgId, dupProstheses);
  registerIds(maps, 'media', clinic.mediaFiles, orgId, dupMedia);

  for (const raw of clinic.prescriptions) {
    const lines = (asLocalEntity(raw).lines as unknown[] | undefined) ?? [];
    if (!Array.isArray(lines)) continue;
    const dups = collectDuplicateIds(lines, 'prescriptionLine', issues);
    registerIds(maps, 'prescriptionLine', lines, orgId, dups);
  }

  const planned: PlannedEntities = {
    dentists: [],
    patients: [],
    appointments: [],
    sessions: [],
    treatments: [],
    prescriptions: [],
    invoices: [],
    stock: [],
    prostheses: [],
    media: [],
  };

  for (const raw of clinic.dentists) {
    const row = asLocalEntity(raw);
    const localId = requireId(row, 'dentist', issues);
    if (!localId || dupDentists.has(localId) && planned.dentists.some((d) => d.localId === localId)) {
      if (localId && dupDentists.has(localId)) bump(counts.dentists, 'errors');
      continue;
    }
    if (dupDentists.has(localId)) {
      bump(counts.dentists, 'errors');
      continue;
    }
    const firstName = localString(row.firstName)?.trim();
    const lastName = localString(row.lastName)?.trim();
    const color = localString(row.color)?.trim();
    if (!firstName || !lastName) {
      bump(counts.dentists, failOrSkip(strict, issues, 'INVALID_DENTIST', 'dentist', 'firstName and lastName are required', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      bump(counts.dentists, failOrSkip(strict, issues, 'INVALID_ENUM', 'dentist', 'color must be #RRGGBB', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    planned.dentists.push({
      localId,
      cloudId: maps.dentist.get(localId)!,
      firstName,
      lastName,
      specialty: localString(row.specialty)?.trim() || 'Omnipratique',
      photo: localString(row.photo) ?? '',
      color: (color ?? '#0e628e').toLowerCase(),
    });
    bump(counts.dentists, 'valid');
  }

  for (const raw of clinic.patients) {
    const row = asLocalEntity(raw);
    const localId = requireId(row, 'patient', issues);
    if (!localId || dupPatients.has(localId)) {
      if (localId) bump(counts.patients, 'errors');
      continue;
    }
    const firstName = localString(row.firstName)?.trim();
    const lastName = localString(row.lastName)?.trim();
    if (!firstName || !lastName) {
      bump(counts.patients, failOrSkip(strict, issues, 'INVALID_PATIENT', 'patient', 'firstName and lastName are required', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    const phone = localString(row.phone) ?? '';
    if (!phone.trim()) {
      bump(
        counts.patients,
        failOrSkip(
          strict,
          issues,
          'EMPTY_PHONE',
          'patient',
          'Empty phone is not invented; skipped/errored per policy',
          localId,
        ) === 'error'
          ? 'errors'
          : 'skipped',
      );
      continue;
    }
    const ageRaw = localNumber(row.age);
    if (ageRaw === undefined || ageRaw < 0 || ageRaw > 150) {
      bump(counts.patients, failOrSkip(strict, issues, 'INVALID_AGE', 'patient', 'age must be 0–150', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    if (!Number.isInteger(ageRaw)) {
      const d = failOrSkip(strict, issues, 'LOSSY_AGE', 'patient', 'Non-integer age is not silently rounded', localId, { age: ageRaw });
      bump(counts.patients, d === 'error' ? 'errors' : 'skipped');
      continue;
    }
    const teeth = validateTeeth(row.teeth, localId, issues);
    if (teeth === null) {
      bump(counts.patients, 'errors');
      continue;
    }
    const dentistId = remapDentist(localString(row.dentistId), maps, issues, 'patient', localId);
    planned.patients.push({
      localId,
      cloudId: maps.patient.get(localId)!,
      firstName,
      lastName,
      phone,
      age: ageRaw,
      address: localString(row.address) ?? '',
      antecedents: localString(row.antecedents) ?? '',
      hasAllergies: localBoolean(row.hasAllergies) ?? false,
      dentistId,
      teeth,
      notes: localString(row.notes) ?? null,
    });
    bump(counts.patients, 'valid');
  }

  for (const raw of clinic.appointments) {
    const row = asLocalEntity(raw);
    const localId = requireId(row, 'appointment', issues);
    if (!localId || dupAppointments.has(localId)) {
      if (localId) bump(counts.appointments, 'errors');
      continue;
    }
    const localPatientId = localString(row.patientId);
    const cloudPatientId = localPatientId ? maps.patient.get(localPatientId) : undefined;
    const patientValid = planned.patients.some((p) => p.localId === localPatientId);
    if (!localPatientId || !cloudPatientId || !patientValid) {
      bump(
        counts.appointments,
        failOrSkip(
          strict,
          issues,
          'ORPHAN_PATIENT',
          'appointment',
          'patientId does not resolve to a migratable patient',
          localId,
          { patientId: localPatientId },
        ) === 'error'
          ? 'errors'
          : 'skipped',
      );
      continue;
    }
    const date = validateCivilDate(row.date, 'date', 'appointment', localId, issues, strict);
    const time = validateWallClock(row.time, 'time', 'appointment', localId, issues, strict);
    if (!date || !time) {
      bump(counts.appointments, strict ? 'errors' : 'skipped');
      continue;
    }
    const durationMin = localNumber(row.durationMin);
    if (durationMin === undefined || !Number.isInteger(durationMin) || durationMin < 1 || durationMin > 1440) {
      bump(counts.appointments, failOrSkip(strict, issues, 'INVALID_DURATION', 'appointment', 'durationMin must be integer 1–1440', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    const status = inEnum(row.status, localAppointmentStatuses, 'status', 'appointment', localId, issues);
    const category = inEnum(row.category, localAppointmentCategories, 'category', 'appointment', localId, issues);
    if (!status || !category) {
      bump(counts.appointments, 'errors');
      continue;
    }
    planned.appointments.push({
      localId,
      cloudId: maps.appointment.get(localId)!,
      patientId: cloudPatientId,
      date,
      time,
      durationMin,
      patientName: localString(row.patientName) ?? '',
      patientPhone: localString(row.patientPhone) ?? '',
      motif: localString(row.motif) ?? '',
      practitioner: localString(row.practitioner) ?? '',
      dentistId: remapDentist(localString(row.dentistId), maps, issues, 'appointment', localId),
      status,
      category,
    });
    bump(counts.appointments, 'valid');
  }

  let sessionFreeText = 0;
  for (const raw of clinic.sessions) {
    const row = asLocalEntity(raw);
    const localId = requireId(row, 'session', issues);
    if (!localId || dupSessions.has(localId)) {
      if (localId) bump(counts.sessions, 'errors');
      continue;
    }
    const localPatientId = localString(row.patientId);
    const cloudPatientId = localPatientId ? maps.patient.get(localPatientId) : undefined;
    const patientValid = planned.patients.some((p) => p.localId === localPatientId);
    if (!localPatientId || !cloudPatientId || !patientValid) {
      bump(counts.sessions, failOrSkip(strict, issues, 'ORPHAN_PATIENT', 'session', 'patientId does not resolve', localId, { patientId: localPatientId }) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    const date = validateCivilDate(row.date, 'date', 'session', localId, issues, strict);
    const time = validateWallClock(row.time, 'time', 'session', localId, issues, strict);
    if (!date || !time) {
      bump(counts.sessions, strict ? 'errors' : 'skipped');
      continue;
    }
    const teeth = Array.isArray(row.teeth) ? row.teeth.map((t) => String(t)) : [];
    const prescription = localString(row.prescription) ?? '';
    if (prescription) sessionFreeText += 1;
    planned.sessions.push({
      localId,
      cloudId: maps.session.get(localId)!,
      patientId: cloudPatientId,
      date,
      time,
      teeth,
      acts: localString(row.acts) ?? '',
      notes: localString(row.notes) ?? '',
      prescription,
    });
    bump(counts.sessions, 'valid');
  }
  if (sessionFreeText > 0) {
    issues.push(
      issue(
        'INFO',
        'SESSION_PRESCRIPTION_NOT_MERGED',
        'session',
        'PatientSession.prescription remains free text on ClinicalSession and is not converted into Prescription rows',
        { details: { count: sessionFreeText } },
      ),
    );
  }

  for (const raw of clinic.treatments) {
    const row = asLocalEntity(raw);
    const localId = requireId(row, 'treatment', issues);
    if (!localId || dupTreatments.has(localId)) {
      if (localId) bump(counts.treatments, 'errors');
      continue;
    }
    const localPatientId = localString(row.patientId);
    const cloudPatientId = localPatientId ? maps.patient.get(localPatientId) : undefined;
    const patientValid = planned.patients.some((p) => p.localId === localPatientId);
    if (!localPatientId || !cloudPatientId || !patientValid) {
      bump(counts.treatments, failOrSkip(strict, issues, 'ORPHAN_PATIENT', 'treatment', 'patientId does not resolve', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    const date = validateCivilDate(row.date, 'date', 'treatment', localId, issues, strict);
    if (!date) {
      bump(counts.treatments, strict ? 'errors' : 'skipped');
      continue;
    }
    const tooth = localString(row.tooth)?.trim();
    const act = localString(row.act)?.trim();
    if (!tooth || !act) {
      bump(counts.treatments, failOrSkip(strict, issues, 'INVALID_TREATMENT', 'treatment', 'tooth and act are required', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    const money = toWholeDa(row.cost);
    if (!money.ok) {
      bump(counts.treatments, failOrSkip(strict, issues, 'INVALID_MONEY', 'treatment', money.reason, localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    if (money.lossy) {
      if (strict) {
        issues.push(
          issue('ERROR', 'LOSSY_MONEY', 'treatment', 'Non-integer cost is not silently rounded in strict mode', {
            localId,
            details: { original: money.original, rounded: money.value },
          }),
        );
        bump(counts.treatments, 'errors');
        continue;
      }
      issues.push(
        issue('WARNING', 'LOSSY_MONEY', 'treatment', 'Non-integer cost rounded to whole DA', {
          localId,
          details: { original: money.original, rounded: money.value },
        }),
      );
    }
    const careStatus = inEnum(row.careStatus, localCareStatuses, 'careStatus', 'treatment', localId, issues);
    const paymentStatus = inEnum(row.paymentStatus, localPaymentStatuses, 'paymentStatus', 'treatment', localId, issues);
    if (!careStatus || !paymentStatus) {
      bump(counts.treatments, 'errors');
      continue;
    }
    if (row.dentistId !== undefined) {
      issues.push(
        issue('INFO', 'UNSUPPORTED_FIELD', 'treatment', 'Treatment.dentistId is not in the local model and is ignored', {
          localId,
        }),
      );
    }
    planned.treatments.push({
      localId,
      cloudId: maps.treatment.get(localId)!,
      patientId: cloudPatientId,
      date,
      tooth,
      act,
      code: localString(row.code) ?? '',
      cost: money.value,
      comment: localString(row.comment) ?? '',
      careStatus,
      paymentStatus,
      actId: localString(row.actId) ?? null,
    });
    bump(counts.treatments, 'valid');
  }

  for (const raw of clinic.prescriptions) {
    const row = asLocalEntity(raw);
    const localId = requireId(row, 'prescription', issues);
    if (!localId || dupPrescriptions.has(localId)) {
      if (localId) bump(counts.prescriptions, 'errors');
      continue;
    }
    const localPatientId = localString(row.patientId);
    if (!localPatientId) {
      issues.push(
        issue('SKIPPED', 'WALK_IN_PRESCRIPTION', 'prescription', 'Walk-in prescription without patientId is skipped', {
          localId,
        }),
      );
      bump(counts.prescriptions, 'skipped');
      continue;
    }
    const cloudPatientId = maps.patient.get(localPatientId);
    const patientValid = planned.patients.some((p) => p.localId === localPatientId);
    if (!cloudPatientId || !patientValid) {
      bump(counts.prescriptions, failOrSkip(strict, issues, 'ORPHAN_PATIENT', 'prescription', 'patientId does not resolve', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    const date = validateCivilDate(row.date, 'date', 'prescription', localId, issues, strict);
    if (!date) {
      bump(counts.prescriptions, strict ? 'errors' : 'skipped');
      continue;
    }
    const rawLines = Array.isArray(row.lines) ? (row.lines as unknown[]) : [];
    const lines: PlannedPrescription['lines'] = [];
    for (const [index, lineRaw] of rawLines.entries()) {
      const line = asLocalEntity(lineRaw);
      const lineId = localString(line.id);
      const drug = localString(line.drug)?.trim();
      if (!lineId || !drug) {
        issues.push(
          issue('SKIPPED', 'INVALID_PRESCRIPTION_LINE', 'prescriptionLine', 'Line missing id or drug', {
            localId: lineId,
            details: { prescriptionId: localId },
          }),
        );
        bump(counts.prescriptionLines, 'skipped');
        continue;
      }
      if (!maps.prescriptionLine.has(lineId)) {
        maps.prescriptionLine.set(lineId, mappedUuid(orgId, 'prescriptionLine', lineId));
      }
      lines.push({
        localId: lineId,
        cloudId: maps.prescriptionLine.get(lineId)!,
        drug,
        posology: localString(line.posology) ?? '',
        duration: localString(line.duration) ?? '',
        notes: localString(line.notes) ?? '',
        sortOrder: index,
      });
      bump(counts.prescriptionLines, 'valid');
    }
    if (lines.length === 0) {
      issues.push(
        issue('SKIPPED', 'PRESCRIPTION_NO_LINES', 'prescription', 'Prescription with zero valid lines is skipped', {
          localId,
        }),
      );
      bump(counts.prescriptions, 'skipped');
      continue;
    }
    planned.prescriptions.push({
      localId,
      cloudId: maps.prescription.get(localId)!,
      patientId: cloudPatientId,
      patientName: localString(row.patientName) ?? '',
      date,
      title: localString(row.title)?.trim() || 'Ordonnance',
      templateId: localString(row.templateId) ?? null,
      advice: localString(row.advice) ?? '',
      dentistId: remapDentist(localString(row.dentistId), maps, issues, 'prescription', localId),
      dentistName: localString(row.dentistName) ?? '',
      lines,
    });
    bump(counts.prescriptions, 'valid');
  }

  for (const raw of clinic.invoices) {
    const row = asLocalEntity(raw);
    const localId = requireId(row, 'invoice', issues);
    if (!localId || dupInvoices.has(localId)) {
      if (localId) bump(counts.invoices, 'errors');
      continue;
    }
    const localPatientId = localString(row.patientId);
    if (!localPatientId) {
      issues.push(
        issue('SKIPPED', 'WALK_IN_INVOICE', 'invoice', 'Walk-in invoice without patientId is skipped', { localId }),
      );
      bump(counts.invoices, 'skipped');
      continue;
    }
    const cloudPatientId = maps.patient.get(localPatientId);
    const patientValid = planned.patients.some((p) => p.localId === localPatientId);
    if (!cloudPatientId || !patientValid) {
      bump(counts.invoices, failOrSkip(strict, issues, 'ORPHAN_PATIENT', 'invoice', 'patientId does not resolve', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    const money = toWholeDa(row.amount);
    if (!money.ok) {
      bump(counts.invoices, failOrSkip(strict, issues, 'INVALID_MONEY', 'invoice', money.reason, localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    if (money.lossy) {
      if (strict) {
        issues.push(
          issue('ERROR', 'LOSSY_MONEY', 'invoice', 'Non-integer amount is not silently rounded in strict mode', {
            localId,
            details: { original: money.original, rounded: money.value },
          }),
        );
        bump(counts.invoices, 'errors');
        continue;
      }
      issues.push(
        issue('WARNING', 'LOSSY_MONEY', 'invoice', 'Non-integer amount rounded to whole DA', {
          localId,
          details: { original: money.original, rounded: money.value },
        }),
      );
    }
    if (money.value <= 0) {
      issues.push(
        issue('SKIPPED', 'ZERO_INVOICE', 'invoice', 'Invoice amount <= 0 is skipped', {
          localId,
          details: { amount: money.value },
        }),
      );
      bump(counts.invoices, 'skipped');
      continue;
    }
    const date = validateCivilDate(row.date, 'date', 'invoice', localId, issues, strict);
    if (!date) {
      bump(counts.invoices, strict ? 'errors' : 'skipped');
      continue;
    }
    const localTreatmentId = localString(row.treatmentId);
    let treatmentId: string | null = null;
    if (localTreatmentId) {
      const mapped = maps.treatment.get(localTreatmentId);
      const treatmentValid = planned.treatments.some((t) => t.localId === localTreatmentId);
      if (!mapped || !treatmentValid) {
        issues.push(
          issue(
            'WARNING',
            'UNMAPPED_TREATMENT',
            'invoice',
            'treatmentId does not resolve; Cloud treatmentId will be null',
            { localId, details: { treatmentId: localTreatmentId } },
          ),
        );
        treatmentId = null;
      } else {
        treatmentId = mapped;
      }
    }
    planned.invoices.push({
      localId,
      cloudId: maps.invoice.get(localId)!,
      patientId: cloudPatientId,
      patientName: localString(row.patientName) ?? '',
      label: localString(row.label)?.trim() || 'Facture',
      amount: money.value,
      paid: localBoolean(row.paid) ?? false,
      date,
      treatmentId,
    });
    bump(counts.invoices, 'valid');
  }

  for (const raw of clinic.stockItems) {
    const row = asLocalEntity(raw);
    const localId = requireId(row, 'stock', issues);
    if (!localId || dupStock.has(localId)) {
      if (localId) bump(counts.stockItems, 'errors');
      continue;
    }
    const code = localString(row.code)?.trim();
    const name = localString(row.name)?.trim();
    if (!code || !name) {
      bump(counts.stockItems, failOrSkip(strict, issues, 'INVALID_STOCK', 'stock', 'code and name are required', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    const category = inEnum(row.category, localStockCategories, 'category', 'stock', localId, issues);
    if (!category) {
      bump(counts.stockItems, 'errors');
      continue;
    }
    const quantity = localNumber(row.quantity);
    const minQuantity = localNumber(row.minQuantity);
    if (
      quantity === undefined ||
      minQuantity === undefined ||
      !Number.isInteger(quantity) ||
      !Number.isInteger(minQuantity) ||
      quantity < 0 ||
      minQuantity < 0
    ) {
      bump(counts.stockItems, failOrSkip(strict, issues, 'INVALID_QUANTITY', 'stock', 'quantity/minQuantity must be integers ≥ 0', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    const money = toWholeDa(row.unitPrice);
    if (!money.ok || money.value < 0) {
      bump(counts.stockItems, failOrSkip(strict, issues, 'INVALID_MONEY', 'stock', 'unitPrice must be whole DA ≥ 0', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    if (money.lossy) {
      if (strict) {
        issues.push(issue('ERROR', 'LOSSY_MONEY', 'stock', 'Non-integer unitPrice in strict mode', { localId }));
        bump(counts.stockItems, 'errors');
        continue;
      }
      issues.push(issue('WARNING', 'LOSSY_MONEY', 'stock', 'unitPrice rounded to whole DA', { localId, details: { original: money.original } }));
    }
    const addedAt = validateCivilDate(row.addedAt, 'addedAt', 'stock', localId, issues, strict);
    if (!addedAt) {
      bump(counts.stockItems, strict ? 'errors' : 'skipped');
      continue;
    }
    const expiryRaw = emptyToNullDate(row.expiryDate);
    let expiryDate: string | null = null;
    if (expiryRaw === undefined) {
      expiryDate = null;
    } else if (expiryRaw === null) {
      expiryDate = null;
    } else {
      const exp = validateCivilDate(expiryRaw, 'expiryDate', 'stock', localId, issues, strict);
      if (!exp) {
        bump(counts.stockItems, strict ? 'errors' : 'skipped');
        continue;
      }
      expiryDate = exp;
    }
    planned.stock.push({
      localId,
      cloudId: maps.stock.get(localId)!,
      code,
      name,
      category,
      quantity,
      minQuantity,
      unitPrice: money.value,
      addedAt,
      expiryDate,
      supplier: localString(row.supplier) ?? '',
    });
    bump(counts.stockItems, 'valid');
  }

  for (const raw of clinic.prostheses) {
    const row = asLocalEntity(raw);
    const localId = requireId(row, 'prosthesis', issues);
    if (!localId || dupProstheses.has(localId)) {
      if (localId) bump(counts.prostheses, 'errors');
      continue;
    }
    const localPatientId = localString(row.patientId);
    const cloudPatientId = localPatientId ? maps.patient.get(localPatientId) : undefined;
    const patientValid = planned.patients.some((p) => p.localId === localPatientId);
    if (!localPatientId || !cloudPatientId || !patientValid) {
      bump(counts.prostheses, failOrSkip(strict, issues, 'ORPHAN_PATIENT', 'prosthesis', 'patientId does not resolve', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    const status = inEnum(row.status, localProsthesisStatuses, 'status', 'prosthesis', localId, issues);
    if (!status) {
      bump(counts.prostheses, 'errors');
      continue;
    }
    const sentAt = validateCivilDate(row.sentAt, 'sentAt', 'prosthesis', localId, issues, strict);
    if (!sentAt) {
      bump(counts.prostheses, strict ? 'errors' : 'skipped');
      continue;
    }
    const expectedRaw = emptyToNullDate(row.expectedAt);
    let expectedAt: string | null = null;
    if (typeof expectedRaw === 'string') {
      const exp = validateCivilDate(expectedRaw, 'expectedAt', 'prosthesis', localId, issues, strict);
      if (!exp) {
        bump(counts.prostheses, strict ? 'errors' : 'skipped');
        continue;
      }
      expectedAt = exp;
    }
    const type = localString(row.type)?.trim();
    const tooth = localString(row.tooth)?.trim();
    if (!type || !tooth) {
      bump(counts.prostheses, failOrSkip(strict, issues, 'INVALID_PROSTHESIS', 'prosthesis', 'type and tooth are required', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    planned.prostheses.push({
      localId,
      cloudId: maps.prosthesis.get(localId)!,
      patientId: cloudPatientId,
      patientName: localString(row.patientName) ?? '',
      type,
      tooth,
      lab: localString(row.lab) ?? '',
      sentAt,
      expectedAt,
      notes: localString(row.notes) ?? '',
      status,
    });
    bump(counts.prostheses, 'valid');
  }

  const mediaResolutions: MediaResolution[] = [];
  for (const raw of clinic.mediaFiles) {
    const row = asLocalEntity(raw);
    const localId = requireId(row, 'media', issues);
    if (!localId || dupMedia.has(localId)) {
      if (localId) bump(counts.mediaFiles, 'errors');
      continue;
    }
    const localPatientId = localString(row.patientId);
    const cloudPatientId = localPatientId ? maps.patient.get(localPatientId) : undefined;
    const patientValid = planned.patients.some((p) => p.localId === localPatientId);
    if (!localPatientId || !cloudPatientId || !patientValid) {
      bump(counts.mediaFiles, failOrSkip(strict, issues, 'ORPHAN_PATIENT', 'media', 'patientId does not resolve', localId) === 'error' ? 'errors' : 'skipped');
      continue;
    }
    const kind = inEnum(row.kind, localMediaKinds, 'kind', 'media', localId, issues);
    if (!kind) {
      bump(counts.mediaFiles, 'errors');
      continue;
    }
    const cloudMediaId = maps.media.get(localId)!;
    const resolved = resolveMediaEntry({
      sourceMediaRoot: config.sourceMediaRoot,
      organizationId: orgId,
      cloudPatientId,
      cloudMediaId,
      row,
      issues,
    });
    mediaResolutions.push(resolved);
    if (resolved.skip || !resolved.storageKey || resolved.diskSize == null) {
      bump(counts.mediaFiles, 'skipped');
      continue;
    }
    planned.media.push({
      localId,
      cloudId: cloudMediaId,
      patientId: cloudPatientId,
      title: localString(row.title)?.trim() || localString(row.originalName) || localId,
      kind,
      mime: localString(row.mime) ?? '',
      originalName: resolved.originalName,
      size: resolved.diskSize,
      storageKey: resolved.storageKey,
    });
    bump(counts.mediaFiles, 'valid');
  }

  const settingsName =
    clinic.settings && typeof clinic.settings.name === 'string' ? clinic.settings.name.trim() : '';
  const organizationNameCopy =
    config.copyOrganizationName && settingsName ? settingsName : null;

  const errors = issues.filter((i) => i.severity === 'ERROR');
  const warnings = issues.filter((i) => i.severity === 'WARNING');
  const skipped = issues.filter((i) => i.severity === 'SKIPPED');
  const infos = issues.filter((i) => i.severity === 'INFO');
  const orphanReferences = issues.filter(
    (i) => i.code === 'ORPHAN_PATIENT' || i.code === 'ORPHAN_DENTIST' || i.code === 'UNMAPPED_TREATMENT',
  );
  const missingMedia = issues.filter((i) => i.code === 'MISSING_MEDIA' || i.code === 'MEDIA_SIZE_MISMATCH');

  const report: MigrationReport = {
    metadata: {
      sourcePath: loaded.sourcePath,
      schemaVersion: loaded.schemaVersion,
      targetOrganizationId: orgId,
      mode: 'DRY_RUN',
      startedAt,
      finishedAt: new Date().toISOString(),
      strict,
      copyOrganizationName: config.copyOrganizationName,
    },
    counts,
    mappings: mappingCounts(maps),
    warnings,
    skipped,
    errors,
    infos,
    orphanReferences,
    missingMedia,
    deferred: {
      settings: 'DEFERRED',
      actCatalog: 'DEFERRED',
      zoomFactor: 'IGNORE',
    },
    plannedOrder: MIGRATION_PLAN_ORDER,
    databaseWrites: 0,
    storageWrites: 0,
    ok: errors.length === 0 && loaded.schemaVersion === 8,
  };

  void config.policies;

  return {
    report,
    maps,
    planned,
    loaded,
    mediaResolutions,
    organizationNameCopy,
  };
}
