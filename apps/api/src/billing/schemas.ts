import { z } from 'zod';
import { calendarDateSchema } from '../appointments/schemas.js';

/** Whole Algerian dinars (DA). Matches local Math.round(Number). */
export const invoiceAmountSchema = z
  .number()
  .int('amount must be a whole number of DA')
  .positive('amount must be greater than 0')
  .max(1_000_000_000, 'amount too large');

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

export const createInvoiceSchema = z
  .object({
    label: z.string().trim().min(1).max(500),
    amount: invoiceAmountSchema,
    paid: z.boolean().default(false),
    date: calendarDateSchema,
    treatmentId: z.string().uuid().nullable().optional(),
    ...ownershipIgnored,
  })
  .strict()
  .transform((data) => ({
    label: data.label,
    amount: data.amount,
    paid: data.paid,
    date: data.date,
    treatmentId: data.treatmentId ?? null,
  }));

export const updateInvoiceSchema = z
  .object({
    label: z.string().trim().min(1).max(500).optional(),
    amount: invoiceAmountSchema.optional(),
    paid: z.boolean().optional(),
    date: calendarDateSchema.optional(),
    treatmentId: z.string().uuid().nullable().optional(),
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
      data.label !== undefined ||
      data.amount !== undefined ||
      data.paid !== undefined ||
      data.date !== undefined ||
      data.treatmentId !== undefined ||
      data.patientId !== undefined,
    { message: 'At least one updatable field is required' },
  )
  .transform((data) => {
    const patch: {
      label?: string;
      amount?: number;
      paid?: boolean;
      date?: string;
      treatmentId?: string | null;
      patientId?: string;
    } = {};
    if (data.label !== undefined) patch.label = data.label;
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.paid !== undefined) patch.paid = data.paid;
    if (data.date !== undefined) patch.date = data.date;
    if (data.treatmentId !== undefined) patch.treatmentId = data.treatmentId;
    if (data.patientId !== undefined) patch.patientId = data.patientId;
    return patch;
  });

export const listInvoicesQuerySchema = z.object({
  date: calendarDateSchema.optional(),
  from: calendarDateSchema.optional(),
  to: calendarDateSchema.optional(),
  paid: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      return v === 'true' || v === '1';
    }),
  patientId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).superRefine((data, ctx) => {
  if (data.from && data.to && data.from > data.to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'from must be less than or equal to to',
      path: ['from'],
    });
  }
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
