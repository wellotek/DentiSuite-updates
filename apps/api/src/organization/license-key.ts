/**
 * Commercial license key normalization + format gates.
 * No DRM — blocks empty/trivial/weak keys while accepting existing DS-/LIC- style keys.
 */

import { AppError } from '../lib/errors.js';

export const LICENSE_KEY_MIN_LENGTH = 12;
export const LICENSE_KEY_MAX_LENGTH = 120;

/** Charset after normalize: A-Z, 0-9, . _ - */
const LICENSE_KEY_RE = /^[A-Z0-9][A-Z0-9._-]{11,119}$/;

/**
 * Normalize for storage + lookup (trim, strip spaces, uppercase).
 * Preserves DS- / LIC- style separators.
 */
export function normalizeLicenseKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

/** Public-safe fingerprint for logs/audit — never the full key. */
export function licenseKeyFingerprint(normalizedKey: string): string {
  const k = normalizeLicenseKey(normalizedKey);
  if (k.length < 8) return '****';
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

/**
 * Reject empty, short, charset-invalid, and trivial keys (all same alnum).
 * Throws AppError 400 VALIDATION_ERROR.
 */
export function assertValidLicenseKeyFormat(raw: string): string {
  const key = normalizeLicenseKey(raw);
  if (!key) {
    throw new AppError(400, 'VALIDATION_ERROR', 'licenseKey is required');
  }
  if (key.length < LICENSE_KEY_MIN_LENGTH || key.length > LICENSE_KEY_MAX_LENGTH) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `licenseKey must be ${LICENSE_KEY_MIN_LENGTH}–${LICENSE_KEY_MAX_LENGTH} characters`,
    );
  }
  if (!LICENSE_KEY_RE.test(key)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'licenseKey format is invalid',
    );
  }
  const alnum = key.replace(/[^A-Z0-9]/g, '');
  if (alnum.length >= LICENSE_KEY_MIN_LENGTH && /^(.)\1+$/.test(alnum)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'licenseKey is too weak');
  }
  return key;
}

/** Zod refine helper — returns normalized key or throws via safeParse issues. */
export function parseLicenseKeyInput(raw: unknown):
  | { ok: true; key: string }
  | { ok: false; message: string } {
  if (typeof raw !== 'string') {
    return { ok: false, message: 'licenseKey is required' };
  }
  try {
    return { ok: true, key: assertValidLicenseKeyFormat(raw) };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: 'licenseKey is invalid' };
  }
}
