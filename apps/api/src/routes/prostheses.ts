import { Hono } from 'hono';
import type { AuthService } from '../auth/service.js';
import { AppError } from '../lib/errors.js';
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
import type { ProsthesisService } from '../prostheses/service.js';
import {
  createProsthesisSchema,
  listProsthesesQuerySchema,
  updateProsthesisSchema,
} from '../prostheses/schemas.js';

export type ProsthesisRouteDeps = {
  authService: AuthService;
  organizationService: OrganizationService;
  permissionService: PermissionService;
  prosthesisService: ProsthesisService;
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
 * Prostheses use patients.* (no prostheses.* vocabulary; patient-scoped lab jobs).
 * Mounted at application root.
 */
export function createProsthesisRoutes(deps: ProsthesisRouteDeps) {
  const routes = new Hono<{ Variables: AuthVariables & Partial<TenantVariables> }>();
  const requireAuth = createAuthMiddleware(deps.authService);
  const requireTenant = createTenantMiddleware(deps.organizationService);
  const requireRead = createRequirePermission(
    deps.permissionService,
    'patients.read',
  );
  const requireCreate = createRequirePermission(
    deps.permissionService,
    'patients.create',
  );
  const requireUpdate = createRequirePermission(
    deps.permissionService,
    'patients.update',
  );
  const requireDelete = createRequirePermission(
    deps.permissionService,
    'patients.delete',
  );

  routes.get(
    '/patients/:patientId/prostheses',
    requireAuth,
    requireTenant,
    requireRead,
    async (c) => {
      const query = listProsthesesQuerySchema.safeParse({
        q: c.req.query('q') || undefined,
        status: c.req.query('status') || undefined,
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
      const result = await deps.prosthesisService.listForPatient(
        tenantScope(c),
        c.req.param('patientId'),
        query.data,
      );
      return c.json({ ok: true as const, ...result });
    },
  );

  routes.post(
    '/patients/:patientId/prostheses',
    requireAuth,
    requireTenant,
    requireCreate,
    async (c) => {
      const body = parseJson(
        createProsthesisSchema,
        await c.req.json().catch(() => ({})),
      );
      const prosthesis = await deps.prosthesisService.createForPatient(
        tenantScope(c),
        c.req.param('patientId'),
        body,
      );
      return c.json({ ok: true as const, prosthesis }, 201);
    },
  );

  routes.get(
    '/prostheses',
    requireAuth,
    requireTenant,
    requireRead,
    async (c) => {
      const query = listProsthesesQuerySchema.safeParse({
        q: c.req.query('q') || undefined,
        status: c.req.query('status') || undefined,
        patientId: c.req.query('patientId') || undefined,
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
      const result = await deps.prosthesisService.list(
        tenantScope(c),
        query.data,
      );
      return c.json({ ok: true as const, ...result });
    },
  );

  routes.get(
    '/prostheses/:id',
    requireAuth,
    requireTenant,
    requireRead,
    async (c) => {
      const prosthesis = await deps.prosthesisService.get(
        tenantScope(c),
        c.req.param('id'),
      );
      return c.json({ ok: true as const, prosthesis });
    },
  );

  routes.patch(
    '/prostheses/:id',
    requireAuth,
    requireTenant,
    requireUpdate,
    async (c) => {
      const body = parseJson(
        updateProsthesisSchema,
        await c.req.json().catch(() => ({})),
      );
      const prosthesis = await deps.prosthesisService.update(
        tenantScope(c),
        c.req.param('id'),
        body,
      );
      return c.json({ ok: true as const, prosthesis });
    },
  );

  routes.delete(
    '/prostheses/:id',
    requireAuth,
    requireTenant,
    requireDelete,
    async (c) => {
      await deps.prosthesisService.delete(tenantScope(c), c.req.param('id'));
      return c.json({ ok: true as const });
    },
  );

  return routes;
}
