import { z } from 'zod';
import { isPermissionKey, PERMISSIONS } from '../permissions/vocabulary.js';
import { isValidUsername, normalizeUsername } from '../auth/username.js';

const ownershipIgnored = {
  id: z.unknown().optional(),
  organizationId: z.unknown().optional(),
  userId: z.unknown().optional(),
  membershipId: z.unknown().optional(),
  actorUserId: z.unknown().optional(),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
};

const permissionKeySchema = z
  .string()
  .trim()
  .refine((v) => isPermissionKey(v), 'Unknown permission key');

export const permissionsArraySchema = z
  .array(permissionKeySchema)
  .max(PERMISSIONS.length)
  .optional();

const usernameSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .refine((v) => isValidUsername(v), 'Invalid username');

export const createTeamMemberSchema = z
  .object({
    username: z.string().trim().min(2).max(40).optional(),
    displayName: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().max(320).optional(),
    password: z.string().min(8).max(128),
    role: z.enum(['ADMIN', 'ASSISTANT']).default('ASSISTANT'),
    permissions: permissionsArraySchema,
    customPermissions: permissionsArraySchema,
    ...ownershipIgnored,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.username && !data.email) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'username or email is required' });
    }
    if (data.username && !isValidUsername(data.username)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid username', path: ['username'] });
    }
    if (data.email && data.email.length > 0) {
      const emailOk = z.string().email().safeParse(data.email);
      if (!emailOk.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid email', path: ['email'] });
      }
    }
  })
  .transform((data) => {
    const email =
      data.email && data.email.trim().length > 0 ? data.email.trim().toLowerCase() : undefined;
    const username = data.username
      ? normalizeUsername(data.username)
      : normalizeUsername((email ?? 'user').split('@')[0] || 'user');
    return {
      username,
      displayName: data.displayName?.trim() || undefined,
      email,
      password: data.password,
      role: data.role,
      permissions: data.permissions ?? data.customPermissions,
    };
  });

export const updateTeamMemberSchema = z
  .object({
    username: usernameSchema.optional(),
    displayName: z.string().trim().min(1).max(120).nullable().optional(),
    email: z.string().trim().email().max(320).optional(),
    role: z.enum(['ADMIN', 'ASSISTANT']).optional(),
    status: z.enum(['ACTIVE', 'DISABLED']).optional(),
    permissions: permissionsArraySchema,
    customPermissions: permissionsArraySchema,
    password: z.string().min(8).max(128).optional(),
    ...ownershipIgnored,
  })
  .strict()
  .refine(
    (data) =>
      data.username !== undefined ||
      data.displayName !== undefined ||
      data.email !== undefined ||
      data.role !== undefined ||
      data.status !== undefined ||
      data.permissions !== undefined ||
      data.customPermissions !== undefined ||
      data.password !== undefined,
    { message: 'At least one updatable field is required' },
  )
  .transform((data) => ({
    username: data.username ? normalizeUsername(data.username) : undefined,
    displayName: data.displayName,
    email: data.email ? data.email.toLowerCase() : undefined,
    role: data.role,
    status: data.status,
    permissions: data.permissions ?? data.customPermissions,
    password: data.password,
  }));

export const listTeamQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
export type ListTeamQuery = z.infer<typeof listTeamQuerySchema>;
