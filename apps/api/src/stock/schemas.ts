import { z } from 'zod';
import { calendarDateSchema } from '../appointments/schemas.js';

export const stockCategorySchema = z.enum([
  'consommable',
  'prothese',
  'hygiene',
  'medicament',
]);

const nonNegInt = z
  .number()
  .int()
  .min(0)
  .max(1_000_000_000);

const unitPriceSchema = z
  .number()
  .int('unitPrice must be a whole number of DA')
  .min(0)
  .max(1_000_000_000);

const ownershipIgnored = {
  id: z.unknown().optional(),
  organizationId: z.unknown().optional(),
  userId: z.unknown().optional(),
  membershipId: z.unknown().optional(),
  actorUserId: z.unknown().optional(),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
};

export const createStockItemSchema = z
  .object({
    code: z.string().trim().min(1).max(80).transform((v) => v.toUpperCase()),
    name: z.string().trim().min(1).max(200),
    category: stockCategorySchema,
    quantity: nonNegInt,
    minQuantity: nonNegInt,
    unitPrice: unitPriceSchema,
    addedAt: calendarDateSchema,
    expiryDate: calendarDateSchema.nullable().optional(),
    supplier: z.string().trim().max(200).default(''),
    ...ownershipIgnored,
  })
  .strict()
  .transform((data) => ({
    code: data.code,
    name: data.name,
    category: data.category,
    quantity: data.quantity,
    minQuantity: data.minQuantity,
    unitPrice: data.unitPrice,
    addedAt: data.addedAt,
    expiryDate: data.expiryDate ?? null,
    supplier: data.supplier,
  }));

export const updateStockItemSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .transform((v) => v.toUpperCase())
      .optional(),
    name: z.string().trim().min(1).max(200).optional(),
    category: stockCategorySchema.optional(),
    quantity: nonNegInt.optional(),
    minQuantity: nonNegInt.optional(),
    unitPrice: unitPriceSchema.optional(),
    addedAt: calendarDateSchema.optional(),
    expiryDate: calendarDateSchema.nullable().optional(),
    supplier: z.string().trim().max(200).optional(),
    ...ownershipIgnored,
  })
  .strict()
  .refine(
    (data) =>
      data.code !== undefined ||
      data.name !== undefined ||
      data.category !== undefined ||
      data.quantity !== undefined ||
      data.minQuantity !== undefined ||
      data.unitPrice !== undefined ||
      data.addedAt !== undefined ||
      data.expiryDate !== undefined ||
      data.supplier !== undefined,
    { message: 'At least one updatable field is required' },
  )
  .transform((data) => {
    const patch: {
      code?: string;
      name?: string;
      category?: z.infer<typeof stockCategorySchema>;
      quantity?: number;
      minQuantity?: number;
      unitPrice?: number;
      addedAt?: string;
      expiryDate?: string | null;
      supplier?: string;
    } = {};
    if (data.code !== undefined) patch.code = data.code;
    if (data.name !== undefined) patch.name = data.name;
    if (data.category !== undefined) patch.category = data.category;
    if (data.quantity !== undefined) patch.quantity = data.quantity;
    if (data.minQuantity !== undefined) patch.minQuantity = data.minQuantity;
    if (data.unitPrice !== undefined) patch.unitPrice = data.unitPrice;
    if (data.addedAt !== undefined) patch.addedAt = data.addedAt;
    if (data.expiryDate !== undefined) patch.expiryDate = data.expiryDate;
    if (data.supplier !== undefined) patch.supplier = data.supplier;
    return patch;
  });

export const listStockQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: stockCategorySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateStockItemInput = z.infer<typeof createStockItemSchema>;
export type UpdateStockItemInput = z.infer<typeof updateStockItemSchema>;
export type ListStockQuery = z.infer<typeof listStockQuerySchema>;
