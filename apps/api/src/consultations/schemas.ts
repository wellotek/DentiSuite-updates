import { z } from 'zod';
import {
  calendarDateSchema,
  wallClockTimeSchema,
} from '../appointments/schemas.js';

export const careStatusSchema = z.enum(['a_faire', 'fait']);
export const paymentStatusSchema = z.enum(['paye', 'en_attente', 'partiel']);

const teethArraySchema = z
  .array(z.string().trim().min(1).max(8))
  .max(64)
  .default([]);

const ignored = {
  id: z.unknown().optional(),
  organizationId: z.unknown().optional(),
  userId: z.unknown().optional(),
  membershipId: z.unknown().optional(),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
  patientId: z.unknown().optional(),
};

export const createConsultationSchema = z
  .object({
    date: calendarDateSchema,
    time: wallClockTimeSchema,
    teeth: teethArraySchema,
    acts: z.string().trim().max(2000).default(''),
    notes: z.string().trim().max(10000).default(''),
    prescription: z.string().trim().max(10000).default(''),
    ...ignored,
  })
  .transform((data) => ({
    date: data.date,
    time: data.time,
    teeth: data.teeth,
    acts: data.acts,
    notes: data.notes,
    prescription: data.prescription,
  }));

export const updateConsultationSchema = z
  .object({
    date: calendarDateSchema.optional(),
    time: wallClockTimeSchema.optional(),
    teeth: teethArraySchema.optional(),
    acts: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(10000).optional(),
    prescription: z.string().trim().max(10000).optional(),
    patientId: z.string().uuid().optional(),
    id: z.unknown().optional(),
    organizationId: z.unknown().optional(),
    userId: z.unknown().optional(),
    membershipId: z.unknown().optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
  })
  .refine(
    (data) =>
      data.date !== undefined ||
      data.time !== undefined ||
      data.teeth !== undefined ||
      data.acts !== undefined ||
      data.notes !== undefined ||
      data.prescription !== undefined ||
      data.patientId !== undefined,
    { message: 'At least one updatable field is required' },
  )
  .transform((data) => {
    const patch: {
      date?: string;
      time?: string;
      teeth?: string[];
      acts?: string;
      notes?: string;
      prescription?: string;
      patientId?: string;
    } = {};
    if (data.date !== undefined) patch.date = data.date;
    if (data.time !== undefined) patch.time = data.time;
    if (data.teeth !== undefined) patch.teeth = data.teeth;
    if (data.acts !== undefined) patch.acts = data.acts;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.prescription !== undefined) patch.prescription = data.prescription;
    if (data.patientId !== undefined) patch.patientId = data.patientId;
    return patch;
  });

export const listConsultationsQuerySchema = z.object({
  date: calendarDateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const createTreatmentSchema = z
  .object({
    date: calendarDateSchema,
    tooth: z.string().trim().min(1).max(8),
    act: z.string().trim().min(1).max(200),
    code: z.string().trim().max(40).default(''),
    cost: z.number().min(0).max(1_000_000_000),
    comment: z.string().trim().max(5000).default(''),
    careStatus: careStatusSchema.default('a_faire'),
    paymentStatus: paymentStatusSchema.default('en_attente'),
    actId: z.string().trim().min(1).max(100).nullable().optional(),
    ...ignored,
  })
  .transform((data) => ({
    date: data.date,
    tooth: data.tooth,
    act: data.act,
    code: data.code,
    cost: data.cost,
    comment: data.comment,
    careStatus: data.careStatus,
    paymentStatus: data.paymentStatus,
    actId: data.actId ?? null,
  }));

export const updateTreatmentSchema = z
  .object({
    date: calendarDateSchema.optional(),
    tooth: z.string().trim().min(1).max(8).optional(),
    act: z.string().trim().min(1).max(200).optional(),
    code: z.string().trim().max(40).optional(),
    cost: z.number().min(0).max(1_000_000_000).optional(),
    comment: z.string().trim().max(5000).optional(),
    careStatus: careStatusSchema.optional(),
    paymentStatus: paymentStatusSchema.optional(),
    actId: z.string().trim().min(1).max(100).nullable().optional(),
    patientId: z.string().uuid().optional(),
    id: z.unknown().optional(),
    organizationId: z.unknown().optional(),
    userId: z.unknown().optional(),
    membershipId: z.unknown().optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
  })
  .refine(
    (data) =>
      data.date !== undefined ||
      data.tooth !== undefined ||
      data.act !== undefined ||
      data.code !== undefined ||
      data.cost !== undefined ||
      data.comment !== undefined ||
      data.careStatus !== undefined ||
      data.paymentStatus !== undefined ||
      data.actId !== undefined ||
      data.patientId !== undefined,
    { message: 'At least one updatable field is required' },
  )
  .transform((data) => {
    const patch: {
      date?: string;
      tooth?: string;
      act?: string;
      code?: string;
      cost?: number;
      comment?: string;
      careStatus?: z.infer<typeof careStatusSchema>;
      paymentStatus?: z.infer<typeof paymentStatusSchema>;
      actId?: string | null;
      patientId?: string;
    } = {};
    if (data.date !== undefined) patch.date = data.date;
    if (data.tooth !== undefined) patch.tooth = data.tooth;
    if (data.act !== undefined) patch.act = data.act;
    if (data.code !== undefined) patch.code = data.code;
    if (data.cost !== undefined) patch.cost = data.cost;
    if (data.comment !== undefined) patch.comment = data.comment;
    if (data.careStatus !== undefined) patch.careStatus = data.careStatus;
    if (data.paymentStatus !== undefined) patch.paymentStatus = data.paymentStatus;
    if (data.actId !== undefined) patch.actId = data.actId;
    if (data.patientId !== undefined) patch.patientId = data.patientId;
    return patch;
  });

export const listTreatmentsQuerySchema = z.object({
  date: calendarDateSchema.optional(),
  careStatus: careStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;
export type ListConsultationsQuery = z.infer<typeof listConsultationsQuerySchema>;
export type CreateTreatmentInput = z.infer<typeof createTreatmentSchema>;
export type UpdateTreatmentInput = z.infer<typeof updateTreatmentSchema>;
export type ListTreatmentsQuery = z.infer<typeof listTreatmentsQuerySchema>;
