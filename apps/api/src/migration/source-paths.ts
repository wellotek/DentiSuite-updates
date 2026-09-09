import { normalize, sep } from 'node:path';

/** True only for the live desktop store path — never used as a default source. */
export function isLiveAppDataStorePath(sourceJsonPath: string): boolean {
  const n = normalize(sourceJsonPath).split(sep).join('\\').toLowerCase();
  const live = n.endsWith('\\dentisuite\\dentisuite-store.json');
  const roaming = n.includes('\\appdata\\') || n.includes('\\application data\\');
  return live && roaming;
}

export function assertNotAutomaticLiveAppData(sourceJsonPath: string | undefined): void {
  if (!sourceJsonPath) {
    throw new Error(
      'Required: --source <COPY of dentisuite-store.json> --media <COPY of media-root> --organization-id <uuid>',
    );
  }
}
