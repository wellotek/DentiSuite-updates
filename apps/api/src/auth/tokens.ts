import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 bytes → 256-bit entropy, base64url opaque bearer token. */
const TOKEN_BYTES = 32;

export function generateOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** SHA-256 hex digest of the raw bearer token. Never store the raw token. */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
