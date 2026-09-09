import { writeFileSync } from 'node:fs';
import type { ApplyReport } from './apply.js';
import type { EntityCounts, MigrationReport } from './dry-run.js';

function line(label: string, counts: EntityCounts): string {
  return `${label}:
  source ${counts.source}
  valid ${counts.valid}
  skipped ${counts.skipped}
  errors ${counts.errors}`;
}

export function formatHumanReport(report: MigrationReport): string {
  const c = report.counts;
  const lines = [
    `DentiSuite migration ${report.metadata.mode}`,
    `strict: ${report.metadata.strict}`,
    `schemaVersion: ${report.metadata.schemaVersion}`,
    `targetOrganizationId: ${report.metadata.targetOrganizationId}`,
    `ok: ${report.ok}`,
    '',
    line('Dentists', c.dentists),
    line('Patients', c.patients),
    line('Appointments', c.appointments),
    line('Sessions', c.sessions),
    line('Treatments', c.treatments),
    line('Prescriptions', c.prescriptions),
    line('Prescription lines', c.prescriptionLines),
    line('Invoices', c.invoices),
    line('Stock', c.stockItems),
    line('Prostheses', c.prostheses),
    line('Media', c.mediaFiles),
    '',
    `WARNINGS: ${report.warnings.length}`,
    `SKIPPED: ${report.skipped.length}`,
    `ERRORS: ${report.errors.length}`,
    `ORPHAN REFERENCES: ${report.orphanReferences.length}`,
    `MISSING MEDIA: ${report.missingMedia.length}`,
    '',
    'DEFERRED: settings, actCatalog',
    'IGNORE: zoomFactor',
    `DATABASE WRITES: ${report.databaseWrites}`,
    `STORAGE WRITES: ${report.storageWrites}`,
  ];
  return lines.join('\n');
}

export function writeReportJson(path: string, report: MigrationReport): void {
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export function formatApplyReport(report: ApplyReport): string {
  return [
    'DentiSuite migration APPLY (STAGING)',
    `ok: ${report.ok}`,
    `status: ${report.metadata.status}`,
    `targetOrganizationId: ${report.metadata.targetOrganizationId}`,
    `sourceJsonUnchanged: ${report.metadata.sourceJsonUnchanged}`,
    `sourceMediaUnchanged: ${report.metadata.sourceMediaUnchanged}`,
    `inserted: ${JSON.stringify(report.inserted)}`,
    `alreadyExists: ${JSON.stringify(report.alreadyExists)}`,
    `skipped: ${JSON.stringify(report.skipped)}`,
    `media: ${JSON.stringify(report.media)}`,
    `WARNINGS: ${report.warnings.length}`,
    `ERRORS: ${report.errors.length}`,
    `verification: ${report.verification?.ok ?? false}`,
  ].join('\n');
}

export function writeApplyReportJson(path: string, report: ApplyReport): void {
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export function writeProductionReportJson(path: string, report: unknown): void {
  if (reportLooksLikeItContainsSecrets(report)) {
    throw new Error('Refusing to write production report: payload looks like it contains secrets.');
  }
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

const SECRET_HINT =
  /password|passwd|secret|DATABASE_URL|DIRECT_URL|R2_ACCESS|R2_SECRET|R2_ACCOUNT|Bearer |APPDATA\\dentisuite|postgresql:\/\/|postgres:\/\//i;

export function reportLooksLikeItContainsSecrets(payload: unknown): boolean {
  return SECRET_HINT.test(JSON.stringify(payload));
}
