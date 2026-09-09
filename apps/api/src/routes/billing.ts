import { Hono } from 'hono';
import type { AuthService } from '../auth/service.js';
import type { BillingService } from '../billing/service.js';
import {
  createInvoiceSchema,
  listInvoicesQuerySchema,
  updateInvoiceSchema,
} from '../billing/schemas.js';
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

export type BillingRouteDeps = {
  authService: AuthService;
  organizationService: OrganizationService;
  permissionService: PermissionService;
  billingService: BillingService;
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
 * Billing / invoices (local clinic.invoices).
 * Mounted at application root for absolute paths + /invoices base.
 */
export function createBillingRoutes(deps: BillingRouteDeps) {
  const routes = new Hono<{ Variables: AuthVariables & Partial<TenantVariables> }>();
  const requireAuth = createAuthMiddleware(deps.authService);
  const requireTenant = createTenantMiddleware(deps.organizationService);
  const requireRead = createRequirePermission(
    deps.permissionService,
    'billing.read',
  );
  const requireCreate = createRequirePermission(
    deps.permissionService,
    'billing.create',
  );
  const requireUpdate = createRequirePermission(
    deps.permissionService,
    'billing.update',
  );
  const requireDelete = createRequirePermission(
    deps.permissionService,
    'billing.delete',
  );

  routes.get(
    '/patients/:patientId/invoices',
    requireAuth,
    requireTenant,
    requireRead,
    async (c) => {
      const query = listInvoicesQuerySchema.safeParse({
        date: c.req.query('date') || undefined,
        from: c.req.query('from') || undefined,
        to: c.req.query('to') || undefined,
        paid: c.req.query('paid') || undefined,
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
      const result = await deps.billingService.listForPatient(
        tenantScope(c),
        c.req.param('patientId'),
        query.data,
      );
      return c.json({ ok: true as const, ...result });
    },
  );

  routes.post(
    '/patients/:patientId/invoices',
    requireAuth,
    requireTenant,
    requireCreate,
    async (c) => {
      const body = parseJson(
        createInvoiceSchema,
        await c.req.json().catch(() => ({})),
      );
      const invoice = await deps.billingService.createForPatient(
        tenantScope(c),
        c.req.param('patientId'),
        body,
      );
      return c.json({ ok: true as const, invoice }, 201);
    },
  );

  routes.get('/invoices', requireAuth, requireTenant, requireRead, async (c) => {
    const query = listInvoicesQuerySchema.safeParse({
      date: c.req.query('date') || undefined,
      from: c.req.query('from') || undefined,
      to: c.req.query('to') || undefined,
      paid: c.req.query('paid') || undefined,
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
    const result = await deps.billingService.list(tenantScope(c), query.data);
    return c.json({ ok: true as const, ...result });
  });

  routes.get(
    '/invoices/:id',
    requireAuth,
    requireTenant,
    requireRead,
    async (c) => {
      const invoice = await deps.billingService.get(
        tenantScope(c),
        c.req.param('id'),
      );
      return c.json({ ok: true as const, invoice });
    },
  );

  routes.patch(
    '/invoices/:id',
    requireAuth,
    requireTenant,
    requireUpdate,
    async (c) => {
      const body = parseJson(
        updateInvoiceSchema,
        await c.req.json().catch(() => ({})),
      );
      const invoice = await deps.billingService.update(
        tenantScope(c),
        c.req.param('id'),
        body,
      );
      return c.json({ ok: true as const, invoice });
    },
  );

  routes.delete(
    '/invoices/:id',
    requireAuth,
    requireTenant,
    requireDelete,
    async (c) => {
      await deps.billingService.delete(tenantScope(c), c.req.param('id'));
      return c.json({ ok: true as const });
    },
  );

  return routes;
}
