import { existsSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { buildPatientMediaStorageKey } from '../media/storage.js';
import { extensionFromOriginalName, MEDIA_MAX_BYTES } from '../media/schemas.js';
import type { Issue } from './issues.js';
import { issue } from './issues.js';
import { localNumber, localString, type LocalEntity } from './source-schema.js';

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.dcm', '.dicom']);

export type MediaResolution = {
  localId: string;
  localPatientId: string;
  filename: string;
  kind: string;
  mime: string;
  originalName: string;
  declaredSize: number | undefined;
  diskPath: string | null;
  diskSize: number | null;
  found: boolean;
  ext: string;
  storageKey: string | null;
  skip: boolean;
};

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '');
}

export function resolveMediaFile(
  sourceMediaRoot: string,
  localPatientId: string,
  filename: string,
): { path: string; size: number } | null {
  const file = basename(filename);
  const candidates = [localPatientId, safeSegment(localPatientId)].filter(Boolean);
  for (const folder of candidates) {
    const dest = join(sourceMediaRoot, folder, file);
    if (existsSync(dest)) {
      const st = statSync(dest);
      if (st.isFile()) return { path: dest, size: st.size };
    }
  }
  return null;
}

export function resolveMediaEntry(opts: {
  sourceMediaRoot: string;
  organizationId: string;
  cloudPatientId: string | undefined;
  cloudMediaId: string;
  row: LocalEntity;
  issues: Issue[];
}): MediaResolution {
  const localId = String(opts.row.id ?? '');
  const localPatientId = localString(opts.row.patientId) ?? '';
  const filename = localString(opts.row.filename) ?? '';
  const kind = localString(opts.row.kind) ?? '';
  const mime = localString(opts.row.mime) ?? '';
  const originalName = localString(opts.row.originalName) ?? filename;
  const declaredSize = localNumber(opts.row.size);
  const extFromName = extensionFromOriginalName(originalName) || extensionFromOriginalName(filename);
  const ext = ALLOWED_EXT.has(extFromName) ? extFromName : '';

  const disk = filename && localPatientId
    ? resolveMediaFile(opts.sourceMediaRoot, localPatientId, filename)
    : null;

  const storageKey =
    opts.cloudPatientId && ext
      ? buildPatientMediaStorageKey({
          organizationId: opts.organizationId,
          patientId: opts.cloudPatientId,
          mediaId: opts.cloudMediaId,
          ext,
        })
      : null;

  const result: MediaResolution = {
    localId,
    localPatientId,
    filename,
    kind,
    mime,
    originalName,
    declaredSize,
    diskPath: disk?.path ?? null,
    diskSize: disk?.size ?? null,
    found: Boolean(disk),
    ext,
    storageKey,
    skip: false,
  };

  if (kind === 'dicom') {
    opts.issues.push(
      issue('INFO', 'DICOM_GENERIC_MEDIA', 'media', 'DICOM stored as generic PatientMedia object (not DICOMWeb)', {
        localId,
      }),
    );
  }

  if (!ext) {
    result.skip = true;
    opts.issues.push(
      issue('SKIPPED', 'UNSUPPORTED_MEDIA', 'media', 'Unsupported or missing media extension', {
        localId,
        details: { filename, originalName },
      }),
    );
    return result;
  }

  if (!disk) {
    result.skip = true;
    opts.issues.push(
      issue('SKIPPED', 'MISSING_MEDIA', 'media', 'Media file not found on disk; no READY metadata planned', {
        localId,
        details: { filename, localPatientId },
      }),
    );
    return result;
  }

  if (declaredSize !== undefined && disk.size !== declaredSize) {
    result.skip = true;
    opts.issues.push(
      issue('SKIPPED', 'MEDIA_SIZE_MISMATCH', 'media', 'Declared size does not match disk file size', {
        localId,
        details: { declaredSize, diskSize: disk.size },
      }),
    );
    return result;
  }

  if (disk.size > MEDIA_MAX_BYTES) {
    result.skip = true;
    opts.issues.push(
      issue('SKIPPED', 'MEDIA_TOO_LARGE', 'media', `File exceeds ${MEDIA_MAX_BYTES} bytes`, {
        localId,
      }),
    );
    return result;
  }

  return result;
}
