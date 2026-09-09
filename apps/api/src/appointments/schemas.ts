import { z } from 'zod';

export const appointmentStatusSchema = z.enum([
  'confirme',
  'en_salle',
  'termine',
  'annule',
]);

export const appointmentCategorySchema = z.enum([
  'urgence',
  'consultation',
  'controle',
  'soin',
  'extraction',
  'prothese',
]);

/** Calendar date YYYY-MM-DD (matches local DentiSuite). */
export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m! - 1 &&
      dt.getUTCDate() === d
    );
  }, 'Invalid calendar date');

/** Local wall-clock HH:mm (matches local DentiSuite). */
export const wallClockTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be HH:mm');

const durationSchema = z
  .number()
  .int()
  .min(1, 'durationMin must be at least 1')
  .max(24 * 60, 'durationMin must be at most 1440');

function parseCalendarDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function formatCalendarDate(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export { parseCalendarDate };

const ignoredTenantFields = {
  id: z.unknown().optional(),
  organizationId: z.unknown().optional(),
  userId: z.unknown().optional(),
  membershipId: z.unknown().optional(),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
  patientName: z.unknown().optional(),
  patientPhone: z.unknown().optional(),
};

export const createAppointmentSchema = z
  .object({
    date: calendarDateSchema,
    time: wallClockTimeSchema,
    durationMin: durationSchema,
    patientId: z.string().uuid(),
    motif: z.string().trim().min(1).max(500),
    practitioner: z.string().trim().max(200).default(''),
    dentistId: z.string().trim().min(1).max(100).nullable().optional(),
    status: appointmentStatusSchema.default('confirme'),
    category: appointmentCategorySchema,
    ...ignoredTenantFields,
  })
  .transform((data) => ({
    date: data.date,
    time: data.time,
    durationMin: data.durationMin,
    patientId: data.patientId,
    motif: data.motif,
    practitioner: data.practitioner,
    dentistId: data.dentistId ?? null,
    status: data.status,
    category: data.category,
  }));

export const updateAppointmentSchema = z
  .object({
    date: calendarDateSchema.optional(),
    time: wallClockTimeSchema.optional(),
    durationMin: durationSchema.optional(),
    patientId: z.string().uuid().optional(),
    motif: z.string().trim().min(1).max(500).optional(),
    practitioner: z.string().trim().max(200).optional(),
    dentistId: z.string().trim().min(1).max(100).nullable().optional(),
    status: appointmentStatusSchema.optional(),
    category: appointmentCategorySchema.optional(),
    ...ignoredTenantFields,
  })
  .refine(
    (data) =>
      data.date !== undefined ||
      data.time !== undefined ||
      data.durationMin !== undefined ||
      data.patientId !== undefined ||
      data.motif !== undefined ||
      data.practitioner !== undefined ||
      data.dentistId !== undefined ||
      data.status !== undefined ||
      data.category !== undefined,
    { message: 'At least one updatable field is required' },
  )
  .transform((data) => {
    const patch: {
      date?: string;
      time?: string;
      durationMin?: number;
      patientId?: string;
      motif?: string;
      practitioner?: string;
      dentistId?: string | null;
      status?: z.infer<typeof appointmentStatusSchema>;
      category?: z.infer<typeof appointmentCategorySchema>;
    } = {};
    if (data.date !== undefined) patch.date = data.date;
    if (data.time !== undefined) patch.time = data.time;
    if (data.durationMin !== undefined) patch.durationMin = data.durationMin;
    if (data.patientId !== undefined) patch.patientId = data.patientId;
    if (data.motif !== undefined) patch.motif = data.motif;
    if (data.practitioner !== undefined) patch.practitioner = data.practitioner;
    if (data.dentistId !== undefined) patch.dentistId = data.dentistId;
    if (data.status !== undefined) patch.status = data.status;
    if (data.category !== undefined) patch.category = data.category;
    return patch;
  });

export const listAppointmentsQuerySchema = z
  .object({
    date: calendarDateSchema.optional(),
    from: calendarDateSchema.optional(),
    to: calendarDateSchema.optional(),
    patientId: z.string().uuid().optional(),
    dentistId: z.string().trim().min(1).max(100).optional(),
    status: appointmentStatusSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to && data.from > data.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'from must be less than or equal to to',
        path: ['from'],
      });
    }
  });

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
