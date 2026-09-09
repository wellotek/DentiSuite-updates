import type { DryRunResult } from './dry-run.js';
import type { ApplyReport } from './apply.js';

export const STAGING_6C_ORG_ID = 'c6c6c6c6-c6c6-46c6-86c6-c6c6c6c6c6c6';

export type OperatorReviewRow = {
  category: string;
  policy: string;
  count: number;
  action: 'SKIP' | 'WARNING' | 'DEFERRED' | 'INFO' | 'NONE';
};

function countCode(result: DryRunResult, severity: 'warnings' | 'skipped' | 'errors' | 'infos', code: string): number {
  return result.report[severity].filter((i) => i.code === code).length;
}

/**
 * Operator review of dry-run issues. Policies are not changed here.
 */
export function classifyOperatorReview(result: DryRunResult): OperatorReviewRow[] {
  return [
    {
      category: 'walk-in prescriptions',
      policy: 'SKIP — no Prescription row (Cloud requires patientId)',
      count: countCode(result, 'skipped', 'WALK_IN_PRESCRIPTION'),
      action: countCode(result, 'skipped', 'WALK_IN_PRESCRIPTION') ? 'SKIP' : 'NONE',
    },
    {
      category: 'walk-in invoices',
      policy: 'SKIP — no Invoice row (Cloud requires patientId)',
      count: countCode(result, 'skipped', 'WALK_IN_INVOICE'),
      action: countCode(result, 'skipped', 'WALK_IN_INVOICE') ? 'SKIP' : 'NONE',
    },
    {
      category: 'empty phone',
      policy: 'ERROR strict / SKIP non-strict — never invent a phone',
      count: countCode(result, 'errors', 'EMPTY_PHONE') + countCode(result, 'skipped', 'EMPTY_PHONE'),
      action: countCode(result, 'errors', 'EMPTY_PHONE') ? 'WARNING' : countCode(result, 'skipped', 'EMPTY_PHONE') ? 'SKIP' : 'NONE',
    },
    {
      category: 'zero amount invoice',
      policy: 'SKIP amount <= 0',
      count: countCode(result, 'skipped', 'ZERO_INVOICE'),
      action: countCode(result, 'skipped', 'ZERO_INVOICE') ? 'SKIP' : 'NONE',
    },
    {
      category: 'float treatment cost',
      policy: 'ERROR in strict — no silent rounding',
      count: result.report.errors.filter((i) => i.code === 'LOSSY_MONEY' && i.entity === 'treatment').length,
      action: result.report.errors.some((i) => i.code === 'LOSSY_MONEY' && i.entity === 'treatment')
        ? 'WARNING'
        : 'NONE',
    },
    {
      category: 'missing dentist',
      policy: 'dentistId null + WARNING — UUID not invented',
      count: countCode(result, 'warnings', 'ORPHAN_DENTIST'),
      action: countCode(result, 'warnings', 'ORPHAN_DENTIST') ? 'WARNING' : 'NONE',
    },
    {
      category: 'unmapped treatment',
      policy: 'Invoice.treatmentId null + WARNING',
      count: countCode(result, 'warnings', 'UNMAPPED_TREATMENT'),
      action: countCode(result, 'warnings', 'UNMAPPED_TREATMENT') ? 'WARNING' : 'NONE',
    },
    {
      category: 'missing media',
      policy: 'SKIP — no READY metadata',
      count: countCode(result, 'skipped', 'MISSING_MEDIA'),
      action: countCode(result, 'skipped', 'MISSING_MEDIA') ? 'SKIP' : 'NONE',
    },
    {
      category: 'deferred settings',
      policy: 'DEFERRED — not copied onto Organization',
      count: countCode(result, 'infos', 'SETTINGS_DEFERRED'),
      action: 'DEFERRED',
    },
    {
      category: 'deferred act catalog',
      policy: 'DEFERRED — Treatment.act/code/actId preserved as opaque values',
      count: countCode(result, 'infos', 'ACT_CATALOG_DEFERRED'),
      action: 'DEFERRED',
    },
  ];
}

export function moneyParity(result: DryRunResult): { ok: boolean; nonIntegerTreatments: number; nonIntegerInvoices: number } {
  const nonIntegerTreatments = result.planned.treatments.filter((t) => !Number.isInteger(t.cost)).length;
  const nonIntegerInvoices = result.planned.invoices.filter((i) => !Number.isInteger(i.amount)).length;
  return {
    ok: nonIntegerTreatments === 0 && nonIntegerInvoices === 0,
    nonIntegerTreatments,
    nonIntegerInvoices,
  };
}

export function differenceFail(report: ApplyReport): string[] {
  return Object.entries(report.difference)
    .filter(([, n]) => n !== 0)
    .map(([key, n]) => `${key}: ${n}`);
}
