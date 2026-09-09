import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { ApplyGateError } from './apply-gate.js';
import { hashFile, mediaManifest } from './hash.js';

export const backupEvidenceSchema = z
  .object({
    sourceJsonBackupPath: z.string().min(1),
    sourceMediaBackupPath: z.string().min(1),
    backupTimestamp: z.string().min(1),
    jsonSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    mediaManifestHash: z.string().regex(/^[a-f0-9]{64}$/i),
    mediaFileCount: z.number().int().nonnegative(),
  })
  .strict();

export type BackupEvidence = z.infer<typeof backupEvidenceSchema>;

export function loadBackupEvidence(path: string): BackupEvidence {
  if (!existsSync(path)) {
    throw new ApplyGateError('Production APPLY refuses: backup evidence file is absent.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new ApplyGateError('Production APPLY refuses: backup evidence is not valid JSON.');
  }
  const result = backupEvidenceSchema.safeParse(parsed);
  if (!result.success) {
    throw new ApplyGateError('Production APPLY refuses: backup evidence is incomplete.');
  }
  return result.data;
}

export function assertBackupEvidenceMatchesSource(
  evidence: BackupEvidence,
  sourceJsonPath: string,
  sourceMediaRoot: string,
): void {
  if (evidence.sourceJsonBackupPath !== sourceJsonPath) {
    throw new ApplyGateError('Production APPLY refuses: backup JSON path does not match --source.');
  }
  if (evidence.sourceMediaBackupPath !== sourceMediaRoot) {
    throw new ApplyGateError('Production APPLY refuses: backup media path does not match --media.');
  }
  const jsonHash = hashFile(sourceJsonPath);
  if (jsonHash.toLowerCase() !== evidence.jsonSha256.toLowerCase()) {
    throw new ApplyGateError('Production APPLY refuses: source JSON SHA256 does not match backup evidence.');
  }
  const manifest = mediaManifest(sourceMediaRoot);
  if (manifest.hash.toLowerCase() !== evidence.mediaManifestHash.toLowerCase()) {
    throw new ApplyGateError('Production APPLY refuses: media manifest does not match backup evidence.');
  }
  if (manifest.count !== evidence.mediaFileCount) {
    throw new ApplyGateError('Production APPLY refuses: media file count does not match backup evidence.');
  }
}
