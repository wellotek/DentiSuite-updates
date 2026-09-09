import { z } from 'zod';

/** Matches local MEDIA_MAX_BYTES / electron limit. */
export const MEDIA_MAX_BYTES = 80 * 1024 * 1024;

export const mediaKindSchema = z.enum(['image', 'dicom']);

const ALLOWED_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.dcm',
  '.dicom',
]);

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const DICOM_MIME = new Set([
  'application/dicom',
  'application/octet-stream',
]);

export function extensionFromOriginalName(name: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(name.trim());
  if (!match) return '';
  const ext = `.${match[1]!.toLowerCase()}`;
  return ALLOWED_EXT.has(ext) ? ext : '';
}

export function isAllowedMediaMime(kind: 'image' | 'dicom', mime: string, ext: string): boolean {
  const m = mime.toLowerCase().trim();
  if (kind === 'image') {
    if (ext === '.dcm' || ext === '.dicom') return false;
    return IMAGE_MIME.has(m) || m.startsWith('image/');
  }
  if (ext !== '.dcm' && ext !== '.dicom' && m !== 'application/dicom') return false;
  return DICOM_MIME.has(m) || m === 'application/dicom';
}

const ownershipIgnored = {
  id: z.unknown().optional(),
  organizationId: z.unknown().optional(),
  userId: z.unknown().optional(),
  membershipId: z.unknown().optional(),
  actorUserId: z.unknown().optional(),
  storageKey: z.unknown().optional(),
  bucket: z.unknown().optional(),
  status: z.unknown().optional(),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
  patientId: z.unknown().optional(),
};

export const createMediaSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    kind: mediaKindSchema,
    mime: z.string().trim().min(1).max(200),
    originalName: z.string().trim().min(1).max(500),
    size: z
      .number()
      .int()
      .positive()
      .max(MEDIA_MAX_BYTES, `size must be at most ${MEDIA_MAX_BYTES} bytes`),
    ...ownershipIgnored,
  })
  .strict()
  .superRefine((data, ctx) => {
    const ext = extensionFromOriginalName(data.originalName);
    if (!ext) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'originalName must end with an allowed extension',
        path: ['originalName'],
      });
      return;
    }
    if (!isAllowedMediaMime(data.kind, data.mime, ext)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mime/kind/extension combination is not allowed',
        path: ['mime'],
      });
    }
  })
  .transform((data) => ({
    title: data.title,
    kind: data.kind,
    mime: data.mime.toLowerCase().trim(),
    originalName: data.originalName,
    size: data.size,
    ext: extensionFromOriginalName(data.originalName),
  }));

export const listMediaQuerySchema = z.object({
  kind: mediaKindSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const completeMediaSchema = z
  .object({
    ...ownershipIgnored,
  })
  .strict()
  .transform(() => ({}));

export type CreateMediaInput = z.infer<typeof createMediaSchema>;
export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;
export type CompleteMediaInput = z.infer<typeof completeMediaSchema>;
