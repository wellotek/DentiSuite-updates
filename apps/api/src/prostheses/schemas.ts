import { z } from 'zod';
import { calendarDateSchema } from '../appointments/schemas.js';

export const prosthesisStatusSchema = z.enum([
  'envoye',
  'fabrication',
  'recu',
  'pose',
  'annulee',
]);

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
};

export const createProsthesisSchema = z
  .object({
    type: z.string().trim().min(1).max(200),
    tooth: z.string().trim().min(1).max(40),
    lab: z.string().trim().max(200).default(''),
    sentAt: calendarDateSchema,
    expectedAt: calendarDateSchema.nullable().optional(),
    notes: z.string().trim().max(5000).default(''),
    status: prosthesisStatusSchema.default('fabrication'),
    ...ownershipIgnored,
  })
  .strict()
  .transform((data) => ({
    type: data.type,
    tooth: data.tooth,
    lab: data.lab,
    sentAt: data.sentAt,
    expectedAt: data.expectedAt ?? null,
    notes: data.notes,
    status: data.status,
  }));

export const updateProsthesisSchema = z
  .object({
    type: z.string().trim().min(1).max(200).optional(),
    tooth: z.string().trim().min(1).max(40).optional(),
    lab: z.string().trim().max(200).optional(),
    sentAt: calendarDateSchema.optional(),
    expectedAt: calendarDateSchema.nullable().optional(),
    notes: z.string().trim().max(5000).optional(),
    status: prosthesisStatusSchema.optional(),
    patientId: z.string().uuid().optional(),
    id: z.unknown().optional(),
    organizationId: z.unknown().optional(),
    userId: z.unknown().optional(),
    membershipId: z.unknown().optional(),
    actorUserId: z.unknown().optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
    patientName: z.unknown().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.type !== undefined ||
      data.tooth !== undefined ||
      data.lab !== undefined ||
      data.sentAt !== undefined ||
      data.expectedAt !== undefined ||
      data.notes !== undefined ||
      data.status !== undefined ||
      data.patientId !== undefined,
    { message: 'At least one updatable field is required' },
  )
  .transform((data) => {
    const patch: {
      type?: string;
      tooth?: string;
      lab?: string;
      sentAt?: string;
      expectedAt?: string | null;
      notes?: string;
      status?: z.infer<typeof prosthesisStatusSchema>;
      patientId?: string;
    } = {};
    if (data.type !== undefined) patch.type = data.type;
    if (data.tooth !== undefined) patch.tooth = data.tooth;
    if (data.lab !== undefined) patch.lab = data.lab;
    if (data.sentAt !== undefined) patch.sentAt = data.sentAt;
    if (data.expectedAt !== undefined) patch.expectedAt = data.expectedAt;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.status !== undefined) patch.status = data.status;
    if (data.patientId !== undefined) patch.patientId = data.patientId;
    return patch;
  });

export const listProsthesesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: prosthesisStatusSchema.optional(),
  patientId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateProsthesisInput = z.infer<typeof createProsthesisSchema>;
export type UpdateProsthesisInput = z.infer<typeof updateProsthesisSchema>;
export type ListProsthesesQuery = z.infer<typeof listProsthesesQuerySchema>;
