import { z } from 'zod';

/** Matches local DentiSuite ToothStatus. */
export const toothStatusSchema = z.enum([
  'saine',
  'carie',
  'a_traiter',
  'traitee',
  'obturation',
  'couronne',
  'extraction',
  'implant',
  'facette',
  'a_surveiller',
]);

export const toothRecordSchema = z.object({
  number: z.string().min(1).max(8),
  status: toothStatusSchema,
  note: z.string().max(2000).optional(),
});

export const teethSchema = z.record(z.string().min(1).max(8), toothRecordSchema);

const patientFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(40),
  age: z.number().int().min(0).max(150),
  address: z.string().trim().max(500).default(''),
  antecedents: z.string().trim().max(5000).default(''),
  hasAllergies: z.boolean().default(false),
  dentistId: z.string().trim().min(1).max(100).nullable().optional(),
  teeth: teethSchema.default({}),
  notes: z.string().trim().max(5000).nullable().optional(),
};

export const createPatientSchema = z
  .object({
    ...patientFields,
    // Ignored — never trusted from client.
    id: z.unknown().optional(),
    organizationId: z.unknown().optional(),
    userId: z.unknown().optional(),
    membershipId: z.unknown().optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
  })
  .transform((data) => ({
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    age: data.age,
    address: data.address,
    antecedents: data.antecedents,
    hasAllergies: data.hasAllergies,
    dentistId: data.dentistId ?? null,
    teeth: data.teeth,
    notes: data.notes ?? null,
  }));

export const updatePatientSchema = z
  .object({
    firstName: patientFields.firstName.optional(),
    lastName: patientFields.lastName.optional(),
    phone: patientFields.phone.optional(),
    age: patientFields.age.optional(),
    address: patientFields.address.optional(),
    antecedents: patientFields.antecedents.optional(),
    hasAllergies: patientFields.hasAllergies.optional(),
    dentistId: z.string().trim().min(1).max(100).nullable().optional(),
    teeth: teethSchema.optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    id: z.unknown().optional(),
    organizationId: z.unknown().optional(),
    userId: z.unknown().optional(),
    membershipId: z.unknown().optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
  })
  .refine(
    (data) =>
      data.firstName !== undefined ||
      data.lastName !== undefined ||
      data.phone !== undefined ||
      data.age !== undefined ||
      data.address !== undefined ||
      data.antecedents !== undefined ||
      data.hasAllergies !== undefined ||
      data.dentistId !== undefined ||
      data.teeth !== undefined ||
      data.notes !== undefined,
    { message: 'At least one updatable field is required' },
  )
  .transform((data) => {
    const patch: Record<string, unknown> = {};
    if (data.firstName !== undefined) patch.firstName = data.firstName;
    if (data.lastName !== undefined) patch.lastName = data.lastName;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.age !== undefined) patch.age = data.age;
    if (data.address !== undefined) patch.address = data.address;
    if (data.antecedents !== undefined) patch.antecedents = data.antecedents;
    if (data.hasAllergies !== undefined) patch.hasAllergies = data.hasAllergies;
    if (data.dentistId !== undefined) patch.dentistId = data.dentistId;
    if (data.teeth !== undefined) patch.teeth = data.teeth;
    if (data.notes !== undefined) patch.notes = data.notes;
    return patch as {
      firstName?: string;
      lastName?: string;
      phone?: string;
      age?: number;
      address?: string;
      antecedents?: string;
      hasAllergies?: boolean;
      dentistId?: string | null;
      teeth?: z.infer<typeof teethSchema>;
      notes?: string | null;
    };
  });

export const listPatientsQuerySchema = z.object({
  search: z.string().trim().max(200).optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;
