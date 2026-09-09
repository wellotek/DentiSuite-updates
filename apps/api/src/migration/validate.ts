import type { Issue } from './issues.js';
import { issue } from './issues.js';
import type { MappingEntityType } from './ids.js';
import {
  localAppointmentCategories,
  localAppointmentStatuses,
  localBoolean,
  localCareStatuses,
  localMediaKinds,
  localNumber,
  localPaymentStatuses,
  localProsthesisStatuses,
  localStockCategories,
  localString,
  localToothStatuses,
  type LocalEntity,
} from './source-schema.js';

export const CALENDAR_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const WALL_CLOCK_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isCivilDate(value: string): boolean {
  if (!CALENDAR_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}

export function requireId(row: LocalEntity, entity: string, issues: Issue[]): string | null {
  const id = localString(row.id)?.trim();
  if (!id) {
    issues.push(issue('ERROR', 'INVALID_ID', entity, 'Missing or empty id'));
    return null;
  }
  return id;
}

export function collectDuplicateIds(
  rows: unknown[],
  entity: MappingEntityType | string,
  issues: Issue[],
): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const id = localString((raw as LocalEntity).id);
    if (!id) continue;
    if (seen.has(id)) {
      duplicates.add(id);
      issues.push(
        issue('ERROR', 'DUPLICATE_ID', entity, `Duplicate local id ${id}`, { localId: id }),
      );
    }
    seen.add(id);
  }
  return duplicates;
}

export function emptyToNullDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  if (value.trim() === '') return null;
  return value;
}

export function validateCivilDate(
  value: unknown,
  field: string,
  entity: string,
  localId: string,
  issues: Issue[],
  strict: boolean,
): string | null {
  const s = localString(value);
  if (!s || !isCivilDate(s)) {
    const msg = `${field} must be a valid YYYY-MM-DD civil date`;
    issues.push(
      issue(strict ? 'ERROR' : 'SKIPPED', 'INVALID_DATE', entity, msg, {
        localId,
        details: { field, value },
      }),
    );
    return null;
  }
  return s;
}

export function validateWallClock(
  value: unknown,
  field: string,
  entity: string,
  localId: string,
  issues: Issue[],
  strict: boolean,
): string | null {
  const s = localString(value);
  if (!s || !WALL_CLOCK_RE.test(s)) {
    issues.push(
      issue(strict ? 'ERROR' : 'SKIPPED', 'INVALID_TIME', entity, `${field} must be HH:mm wall-clock`, {
        localId,
        details: { field, value },
      }),
    );
    return null;
  }
  return s;
}

export function inEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  entity: string,
  localId: string,
  issues: Issue[],
): T | null {
  const s = localString(value);
  if (!s || !(allowed as readonly string[]).includes(s)) {
    issues.push(
      issue('ERROR', 'INVALID_ENUM', entity, `${field} has unsupported value`, {
        localId,
        details: { field, value, allowed: [...allowed] },
      }),
    );
    return null;
  }
  return s as T;
}

export function validateTeeth(
  teeth: unknown,
  localId: string,
  issues: Issue[],
): Record<string, { number: string; status: string; note?: string }> | null {
  if (teeth === undefined || teeth === null) return {};
  if (typeof teeth !== 'object' || Array.isArray(teeth)) {
    issues.push(
      issue('ERROR', 'INVALID_TEETH', 'patient', 'teeth must be an object map', { localId }),
    );
    return null;
  }
  const out: Record<string, { number: string; status: string; note?: string }> = {};
  for (const [key, rec] of Object.entries(teeth as Record<string, unknown>)) {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
      issues.push(
        issue('ERROR', 'INVALID_TEETH', 'patient', `Invalid tooth record for ${key}`, { localId }),
      );
      return null;
    }
    const row = rec as Record<string, unknown>;
    const status = localString(row.status);
    if (!status || !(localToothStatuses as readonly string[]).includes(status)) {
      issues.push(
        issue('ERROR', 'INVALID_ENUM', 'patient', `Invalid tooth status on ${key}`, {
          localId,
          details: { status },
        }),
      );
      return null;
    }
    out[key] = {
      number: localString(row.number) ?? key,
      status,
      ...(localString(row.note) ? { note: localString(row.note) } : {}),
    };
  }
  return out;
}

export {
  localAppointmentCategories,
  localAppointmentStatuses,
  localBoolean,
  localCareStatuses,
  localMediaKinds,
  localNumber,
  localPaymentStatuses,
  localProsthesisStatuses,
  localStockCategories,
  localString,
};
