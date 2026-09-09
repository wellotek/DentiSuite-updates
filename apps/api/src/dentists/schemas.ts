import { z } from 'zod';

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'color must be a hex value like #0e628e');

const ownershipIgnored = {
  id: z.unknown().optional(),
  organizationId: z.unknown().optional(),
  userId: z.unknown().optional(),
  membershipId: z.unknown().optional(),
  actorUserId: z.unknown().optional(),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
};

export const createDentistSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    specialty: z.string().trim().min(1).max(200).default('Omnipratique'),
    photo: z.string().max(5_000_000).default(''),
    color: hexColorSchema.default('#0e628e'),
    ...ownershipIgnored,
  })
  .strict()
  .transform((data) => ({
    firstName: data.firstName,
    lastName: data.lastName,
    specialty: data.specialty,
    photo: data.photo,
    color: data.color.toLowerCase(),
  }));

export const updateDentistSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    specialty: z.string().trim().min(1).max(200).optional(),
    photo: z.string().max(5_000_000).optional(),
    color: hexColorSchema.optional(),
    ...ownershipIgnored,
  })
  .strict()
  .refine(
    (data) =>
      data.firstName !== undefined ||
      data.lastName !== undefined ||
      data.specialty !== undefined ||
      data.photo !== undefined ||
      data.color !== undefined,
    { message: 'At least one updatable field is required' },
  )
  .transform((data) => {
    const patch: {
      firstName?: string;
      lastName?: string;
      specialty?: string;
      photo?: string;
      color?: string;
    } = {};
    if (data.firstName !== undefined) patch.firstName = data.firstName;
    if (data.lastName !== undefined) patch.lastName = data.lastName;
    if (data.specialty !== undefined) patch.specialty = data.specialty;
    if (data.photo !== undefined) patch.photo = data.photo;
    if (data.color !== undefined) patch.color = data.color.toLowerCase();
    return patch;
  });

export const listDentistsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  specialty: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateDentistInput = z.infer<typeof createDentistSchema>;
export type UpdateDentistInput = z.infer<typeof updateDentistSchema>;
export type ListDentistsQuery = z.infer<typeof listDentistsQuerySchema>;
