import { z } from 'zod';
import { calendarDateSchema } from '../appointments/schemas.js';

const ownershipIgnored = {
  id: z.unknown().optional(),
  organizationId: z.unknown().optional(),
  userId: z.unknown().optional(),
  membershipId: z.unknown().optional(),
  actorUserId: z.unknown().optional(),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
  patientId: z.unknown().optional(),
  patientName: z.unknown().optional(),
  patientBirthDate: z.unknown().optional(),
  patientAge: z.unknown().optional(),
};

export const prescriptionLineInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    drug: z.string().trim().min(1).max(500),
    posology: z.string().trim().max(2000).default(''),
    duration: z.string().trim().max(500).default(''),
    notes: z.string().trim().max(2000).default(''),
    medicationId: z.string().trim().max(100).nullable().optional(),
    dci: z.string().trim().max(200).nullable().optional(),
    form: z.string().trim().max(100).nullable().optional(),
    dosage: z.string().trim().max(100).nullable().optional(),
    quantity: z.string().trim().max(100).nullable().optional(),
  })
  .strict();

const linesSchema = z
  .array(prescriptionLineInputSchema)
  .min(1, 'At least one prescription line with a drug is required')
  .max(50);

export const createPrescriptionSchema = z
  .object({
    date: calendarDateSchema,
    title: z.string().trim().min(1).max(200).default('Ordonnance'),
    templateId: z.string().trim().min(1).max(100).nullable().optional(),
    advice: z.string().trim().max(10000).default(''),
    dentistId: z.string().trim().min(1).max(100).nullable().optional(),
    dentistName: z.string().trim().max(200).default(''),
    lines: linesSchema,
    ...ownershipIgnored,
  })
  .strict()
  .transform((data) => ({
    date: data.date,
    title: data.title,
    templateId: data.templateId ?? null,
    advice: data.advice,
    dentistId: data.dentistId ?? null,
    dentistName: data.dentistName,
    lines: data.lines,
  }));

export const updatePrescriptionSchema = z
  .object({
    date: calendarDateSchema.optional(),
    title: z.string().trim().min(1).max(200).optional(),
    templateId: z.string().trim().min(1).max(100).nullable().optional(),
    advice: z.string().trim().max(10000).optional(),
    dentistId: z.string().trim().min(1).max(100).nullable().optional(),
    dentistName: z.string().trim().max(200).optional(),
    lines: linesSchema.optional(),
    patientId: z.string().uuid().optional(),
    id: z.unknown().optional(),
    organizationId: z.unknown().optional(),
    userId: z.unknown().optional(),
    membershipId: z.unknown().optional(),
    actorUserId: z.unknown().optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
    patientName: z.unknown().optional(),
    patientBirthDate: z.unknown().optional(),
    patientAge: z.unknown().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.date !== undefined ||
      data.title !== undefined ||
      data.templateId !== undefined ||
      data.advice !== undefined ||
      data.dentistId !== undefined ||
      data.dentistName !== undefined ||
      data.lines !== undefined ||
      data.patientId !== undefined,
    { message: 'At least one updatable field is required' },
  )
  .transform((data) => {
    const patch: {
      date?: string;
      title?: string;
      templateId?: string | null;
      advice?: string;
      dentistId?: string | null;
      dentistName?: string;
      lines?: z.infer<typeof linesSchema>;
      patientId?: string;
    } = {};
    if (data.date !== undefined) patch.date = data.date;
    if (data.title !== undefined) patch.title = data.title;
    if (data.templateId !== undefined) patch.templateId = data.templateId;
    if (data.advice !== undefined) patch.advice = data.advice;
    if (data.dentistId !== undefined) patch.dentistId = data.dentistId;
    if (data.dentistName !== undefined) patch.dentistName = data.dentistName;
    if (data.lines !== undefined) patch.lines = data.lines;
    if (data.patientId !== undefined) patch.patientId = data.patientId;
    return patch;
  });

export const listPrescriptionsQuerySchema = z.object({
  date: calendarDateSchema.optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionSchema>;
export type ListPrescriptionsQuery = z.infer<typeof listPrescriptionsQuerySchema>;
export type PrescriptionLineInput = z.infer<typeof prescriptionLineInputSchema>;
