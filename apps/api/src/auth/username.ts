/** Normalize team login username: lowercase, trim, [a-z0-9._-] */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '.');
}

export function isValidUsername(raw: string): boolean {
  const u = normalizeUsername(raw);
  return /^[a-z0-9][a-z0-9._-]{1,39}$/.test(u);
}

/** Build a unique technical email when only username is provided. */
export function syntheticEmailForUsername(username: string, organizationId: string): string {
  const u = normalizeUsername(username);
  const org = organizationId.replace(/-/g, '').slice(0, 12);
  return `${u}.${org}@users.dentisuite.local`;
}
