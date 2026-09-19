import { z } from 'zod';
import { normalizeEmail } from './email.js';
import { parseLicenseKeyInput } from '../organization/license-key.js';

export function createPasswordSchema(minLength: number) {
  return z
    .string()
    .min(minLength, `Password must be at least ${minLength} characters`)
    .max(128, 'Password must be at most 128 characters');
}

export function createRegisterSchema(minLength: number) {
  return z.object({
    email: z
      .string()
      .transform((value) => normalizeEmail(value))
      .pipe(z.string().email()),
    password: createPasswordSchema(minLength),
  });
}

export function createLoginSchema() {
  return z.object({
    /** Login identifier: email OR username (field kept as `email` for API compat). */
    email: z.string().trim().min(1).max(320),
    password: z.string().min(1).max(128),
    device: z
      .object({
        deviceIdentifier: z.string().min(1).max(200),
        platform: z.string().max(64).optional(),
        name: z.string().max(120).optional(),
      })
      .optional(),
  });
}

export function createChangePasswordSchema(minLength: number) {
  return z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: createPasswordSchema(minLength),
  });
}

export const revokeSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const revokeDeviceSchema = z.object({
  deviceId: z.string().uuid(),
});

const licenseKeyField = z.string().superRefine((value, ctx) => {
  const parsed = parseLicenseKeyInput(value);
  if (!parsed.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.message });
  }
});

export function createBootstrapOrganizationSchema(minLength: number) {
  return z
    .object({
      licenseKey: licenseKeyField,
      organizationName: z.string().trim().min(2).max(120),
      adminEmail: z
        .string()
        .transform((value) => normalizeEmail(value))
        .pipe(z.string().email()),
      adminPassword: createPasswordSchema(minLength),
      adminName: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(40).optional(),
      city: z.string().trim().max(80).optional(),
      device: z
        .object({
          deviceIdentifier: z.string().min(1).max(200),
          platform: z.string().max(64).optional(),
          name: z.string().max(120).optional(),
        })
        .optional(),
    })
    .transform((data) => {
      const parsed = parseLicenseKeyInput(data.licenseKey);
      if (!parsed.ok) {
        throw new Error(parsed.message);
      }
      return {
        licenseKey: parsed.key,
        organizationName: data.organizationName.trim(),
        adminEmail: data.adminEmail,
        adminPassword: data.adminPassword,
        adminName: data.adminName.trim(),
        phone: data.phone && data.phone.length > 0 ? data.phone : undefined,
        city: data.city && data.city.length > 0 ? data.city : undefined,
        device: data.device,
      };
    });
}

export const onboardingStatusQuerySchema = z
  .object({
    licenseKey: licenseKeyField,
  })
  .transform((data) => {
    const parsed = parseLicenseKeyInput(data.licenseKey);
    if (!parsed.ok) {
      throw new Error(parsed.message);
    }
    return { licenseKey: parsed.key };
  });
