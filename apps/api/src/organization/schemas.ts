import { randomBytes } from 'node:crypto';
import { z } from 'zod';

export function createOrganizationSchema() {
  return z
    .object({
      name: z.string().trim().min(2).max(120),
      // Ignored if present — tenant is never taken from the client.
      organizationId: z.unknown().optional(),
      userId: z.unknown().optional(),
      licenseId: z.unknown().optional(),
      maxUsers: z.unknown().optional(),
      expiresAt: z.unknown().optional(),
      status: z.unknown().optional(),
    })
    .transform((data) => ({ name: data.name }));
}

export function updateOrganizationSchema() {
  return z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      organizationId: z.unknown().optional(),
      userId: z.unknown().optional(),
      maxUsers: z.unknown().optional(),
      licenseId: z.unknown().optional(),
    })
    .refine((data) => data.name !== undefined, {
      message: 'At least one updatable field is required',
    })
    .transform((data) => ({ name: data.name! }));
}

/** Generate a unique slug from organization name. */
export function buildOrganizationSlug(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');

  const suffix = randomBytes(3).toString('hex');
  return `${base || 'cabinet'}-${suffix}`;
}
