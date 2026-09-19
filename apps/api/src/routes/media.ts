import { Hono } from 'hono';
import type { AuthService } from '../auth/service.js';
import { AppError } from '../lib/errors.js';
import type { PatientMediaService } from '../media/service.js';
import {
  completeMediaSchema,
  createMediaSchema,
  listMediaQuerySchema,
} from '../media/schemas.js';
import {
  createAuthMiddleware,
  type AuthVariables,
} from '../middleware/auth.js';
import { createRequirePermission } from '../middleware/permission.js';
import {
  createTenantMiddleware,
  type TenantVariables,
} from '../middleware/tenant.js';
import type { OrganizationService } from '../organization/service.js';
import type { PermissionService } from '../permissions/service.js';

export type MediaRouteDeps = {
  authService: AuthService;
  organizationService: OrganizationService;
  permissionService: PermissionService;
  mediaService: PatientMediaService;
};

function parseJson<T>(
  schema: {
    safeParse: (
      data: unknown,
    ) =>
      | { success: true; data: T }
      | { success: false; error: { issues: { message: string }[] } };
  },
  body: unknown,
): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Invalid request',
    );
  }
  return parsed.data;
}

function tenantScope(c: { get: (k: 'auth') => AuthVariables['auth'] }) {
  const auth = c.get('auth');
  if (!auth.organizationId) {
    throw new AppError(403, 'ORGANIZATION_REQUIRED', 'Organization access required');
  }
  return { organizationId: auth.organizationId };
}

/**
 * Patient media / documents. Mounted at application root for absolute paths.
 */
export function createMediaRoutes(deps: MediaRouteDeps) {
  const routes = new Hono<{ Variables: AuthVariables & Partial<TenantVariables> }>();
  const requireAuth = createAuthMiddleware(deps.authService);
  const requireTenant = createTenantMiddleware(deps.organizationService);
  const requireRead = createRequirePermission(
    deps.permissionService,
    'documents.read',
  );
  const requireUpload = createRequirePermission(
    deps.permissionService,
    'documents.upload',
  );
  const requireDelete = createRequirePermission(
    deps.permissionService,
    'documents.delete',
  );

  routes.get(
    '/patients/:patientId/media',
    requireAuth,
    requireTenant,
    requireRead,
    async (c) => {
      const query = listMediaQuerySchema.safeParse({
        kind: c.req.query('kind') || undefined,
        page: c.req.query('page') ?? '1',
        limit: c.req.query('limit') ?? '50',
      });
      if (!query.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          query.error.issues[0]?.message ?? 'Invalid query',
        );
      }
      const result = await deps.mediaService.listForPatient(
        tenantScope(c),
        c.req.param('patientId'),
        query.data,
      );
      return c.json({ ok: true as const, ...result });
    },
  );

  routes.post(
    '/patients/:patientId/media',
    requireAuth,
    requireTenant,
    requireUpload,
    async (c) => {
      const body = parseJson(
        createMediaSchema,
        await c.req.json().catch(() => ({})),
      );
      const result = await deps.mediaService.createUpload(
        tenantScope(c),
        c.req.param('patientId'),
        body,
      );
      return c.json(
        {
          ok: true as const,
          media: result.media,
          upload: {
            url: result.upload.uploadUrl,
            method: result.upload.method,
            headers: result.upload.headers,
            expiresAt: result.upload.expiresAt.toISOString(),
          },
        },
        201,
      );
    },
  );

  routes.get('/media', requireAuth, requireTenant, requireRead, async (c) => {
    const query = listMediaQuerySchema.safeParse({
      kind: c.req.query('kind') || undefined,
      page: c.req.query('page') ?? '1',
      limit: c.req.query('limit') ?? '50',
    });
    if (!query.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        query.error.issues[0]?.message ?? 'Invalid query',
      );
    }
    const result = await deps.mediaService.listForOrganization(
      tenantScope(c),
      query.data,
    );
    return c.json({ ok: true as const, ...result });
  });

  routes.get('/media/:id', requireAuth, requireTenant, requireRead, async (c) => {
    const media = await deps.mediaService.get(tenantScope(c), c.req.param('id'));
    return c.json({ ok: true as const, media });
  });

  routes.get(
    '/media/:id/url',
    requireAuth,
    requireTenant,
    requireRead,
    async (c) => {
      const result = await deps.mediaService.getDownloadUrl(
        tenantScope(c),
        c.req.param('id'),
      );
      return c.json({ ok: true as const, ...result });
    },
  );

  routes.post(
    '/media/:id/complete',
    requireAuth,
    requireTenant,
    requireUpload,
    async (c) => {
      parseJson(completeMediaSchema, await c.req.json().catch(() => ({})));
      const media = await deps.mediaService.complete(
        tenantScope(c),
        c.req.param('id'),
      );
      return c.json({ ok: true as const, media });
    },
  );

  routes.delete(
    '/media/:id',
    requireAuth,
    requireTenant,
    requireDelete,
    async (c) => {
      await deps.mediaService.delete(tenantScope(c), c.req.param('id'));
      return c.json({ ok: true as const });
    },
  );

  return routes;
}
