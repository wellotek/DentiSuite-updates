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

const birthDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must be YYYY-MM-DD')
  .nullable()
  .optional();

function ageFromBirthDate(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const now = new Date();
  let age = now.getFullYear() - y;
  const month = now.getMonth() - (mo - 1);
  if (month < 0 || (month === 0 && now.getDate() < d)) age -= 1;
  if (age < 0 || age > 150) return null;
  return age;
}

const patientFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(40),
  age: z.number().int().min(0).max(150),
  birthDate: birthDateSchema,
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
    id: z.unknown().optional(),
    organizationId: z.unknown().optional(),
    userId: z.unknown().optional(),
    membershipId: z.unknown().optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
    expectedUpdatedAt: z.unknown().optional(),
    archivedAt: z.unknown().optional(),
    archivedBy: z.unknown().optional(),
  })
  .transform((data) => {
    const birthDate = data.birthDate ?? null;
    const computed = ageFromBirthDate(birthDate);
    return {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      age: computed ?? data.age,
      birthDate,
      address: data.address,
      antecedents: data.antecedents,
      hasAllergies: data.hasAllergies,
      dentistId: data.dentistId ?? null,
      teeth: data.teeth,
      notes: data.notes ?? null,
    };
  });

export const updatePatientSchema = z
  .object({
    firstName: patientFields.firstName.optional(),
    lastName: patientFields.lastName.optional(),
    phone: patientFields.phone.optional(),
    age: patientFields.age.optional(),
    birthDate: birthDateSchema,
    address: patientFields.address.optional(),
    antecedents: patientFields.antecedents.optional(),
    hasAllergies: patientFields.hasAllergies.optional(),
    dentistId: z.string().trim().min(1).max(100).nullable().optional(),
    teeth: teethSchema.optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    /** Optimistic concurrency token (ISO string from last GET). */
    expectedUpdatedAt: z.string().trim().min(1).max(64).optional(),
    id: z.unknown().optional(),
    organizationId: z.unknown().optional(),
    userId: z.unknown().optional(),
    membershipId: z.unknown().optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
    archivedAt: z.unknown().optional(),
    archivedBy: z.unknown().optional(),
  })
  .refine(
    (data) =>
      data.firstName !== undefined ||
      data.lastName !== undefined ||
      data.phone !== undefined ||
      data.age !== undefined ||
      data.birthDate !== undefined ||
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
    if (data.birthDate !== undefined) {
      patch.birthDate = data.birthDate;
      const computed = ageFromBirthDate(data.birthDate);
      if (computed !== null) patch.age = computed;
      else if (data.age !== undefined) patch.age = data.age;
    } else if (data.age !== undefined) {
      patch.age = data.age;
    }
    if (data.address !== undefined) patch.address = data.address;
    if (data.antecedents !== undefined) patch.antecedents = data.antecedents;
    if (data.hasAllergies !== undefined) patch.hasAllergies = data.hasAllergies;
    if (data.dentistId !== undefined) patch.dentistId = data.dentistId;
    if (data.teeth !== undefined) patch.teeth = data.teeth;
    if (data.notes !== undefined) patch.notes = data.notes;
    return {
      patch: patch as {
        firstName?: string;
        lastName?: string;
        phone?: string;
        age?: number;
        birthDate?: string | null;
        address?: string;
        antecedents?: string;
        hasAllergies?: boolean;
        dentistId?: string | null;
        teeth?: z.infer<typeof teethSchema>;
        notes?: string | null;
      },
      expectedUpdatedAt: data.expectedUpdatedAt,
    };
  });

export const listPatientsQuerySchema = z.object({
  search: z.string().trim().max(200).optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  includeArchived: z
    .preprocess(
      (v) => (v === true || v === 'true' || v === '1' ? true : false),
      z.boolean(),
    )
    .default(false),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;
export type PatientPatch = UpdatePatientInput['patch'];
