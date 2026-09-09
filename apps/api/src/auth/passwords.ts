import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id via @node-rs/argon2 (default algorithm is Argon2id).
 * OWASP-oriented memory/time parameters.
 */
export const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function isArgon2idHash(value: string): boolean {
  return value.startsWith('$argon2id$');
}
