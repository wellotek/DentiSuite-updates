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
import type { PrescriptionService } from '../prescriptions/service.js';
import {
  createPrescriptionSchema,
  listPrescriptionsQuerySchema,
  updatePrescriptionSchema,
} from '../prescriptions/schemas.js';

export type PrescriptionRouteDeps = {
  authService: AuthService;
  organizationService: OrganizationService;
  permissionService: PermissionService;
  prescriptionService: PrescriptionService;
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
 * Prescriptions (local clinic.prescriptions).
 * Mounted at application root for absolute paths.
 */
export function createPrescriptionRoutes(deps: PrescriptionRouteDeps) {
  const routes = new Hono<{ Variables: AuthVariables & Partial<TenantVariables> }>();
  const requireAuth = createAuthMiddleware(deps.authService);
  const requireTenant = createTenantMiddleware(deps.organizationService);
  const requireRead = createRequirePermission(
    deps.permissionService,
    'prescriptions.read',
  );
  const requireCreate = createRequirePermission(
    deps.permissionService,
    'prescriptions.create',
  );
  const requireUpdate = createRequirePermission(
    deps.permissionService,
    'prescriptions.update',
  );
  const requireDelete = createRequirePermission(
    deps.permissionService,
    'prescriptions.delete',
  );

  routes.get(
    '/patients/:patientId/prescriptions',
    requireAuth,
    requireTenant,
    requireRead,
    async (c) => {
      const query = listPrescriptionsQuerySchema.safeParse({
        date: c.req.query('date') || undefined,
        q: c.req.query('q') || undefined,
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
      const result = await deps.prescriptionService.listForPatient(
        tenantScope(c),
        c.req.param('patientId'),
        query.data,
      );
      return c.json({ ok: true as const, ...result });
    },
  );

  routes.post(
    '/patients/:patientId/prescriptions',
    requireAuth,
    requireTenant,
    requireCreate,
    async (c) => {
      const body = parseJson(
        createPrescriptionSchema,
        await c.req.json().catch(() => ({})),
      );
      const prescription = await deps.prescriptionService.create(
        tenantScope(c),
        c.req.param('patientId'),
        body,
      );
      return c.json({ ok: true as const, prescription }, 201);
    },
  );

  routes.get('/prescriptions', requireAuth, requireTenant, requireRead, async (c) => {
    const query = listPrescriptionsQuerySchema.safeParse({
      date: c.req.query('date') || undefined,
      q: c.req.query('q') || undefined,
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
    const result = await deps.prescriptionService.listForOrganization(
      tenantScope(c),
      query.data,
    );
    return c.json({ ok: true as const, ...result });
  });

  routes.get(
    '/prescriptions/:id',
    requireAuth,
    requireTenant,
    requireRead,
    async (c) => {
      const prescription = await deps.prescriptionService.get(
        tenantScope(c),
        c.req.param('id'),
      );
      return c.json({ ok: true as const, prescription });
    },
  );

  routes.patch(
    '/prescriptions/:id',
    requireAuth,
    requireTenant,
    requireUpdate,
    async (c) => {
      const body = parseJson(
        updatePrescriptionSchema,
        await c.req.json().catch(() => ({})),
      );
      const prescription = await deps.prescriptionService.update(
        tenantScope(c),
        c.req.param('id'),
        body,
      );
      return c.json({ ok: true as const, prescription });
    },
  );

  routes.delete(
    '/prescriptions/:id',
    requireAuth,
    requireTenant,
    requireDelete,
    async (c) => {
      await deps.prescriptionService.delete(tenantScope(c), c.req.param('id'));
      return c.json({ ok: true as const });
    },
  );

  return routes;
}
