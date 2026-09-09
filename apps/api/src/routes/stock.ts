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
import type { StockService } from '../stock/service.js';
import {
  createStockItemSchema,
  listStockQuerySchema,
  updateStockItemSchema,
} from '../stock/schemas.js';

export type StockRouteDeps = {
  authService: AuthService;
  organizationService: OrganizationService;
  permissionService: PermissionService;
  stockService: StockService;
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

export function createStockRoutes(deps: StockRouteDeps) {
  const routes = new Hono<{ Variables: AuthVariables & Partial<TenantVariables> }>();
  const requireAuth = createAuthMiddleware(deps.authService);
  const requireTenant = createTenantMiddleware(deps.organizationService);
  const requireRead = createRequirePermission(
    deps.permissionService,
    'stock.read',
  );
  const requireCreate = createRequirePermission(
    deps.permissionService,
    'stock.create',
  );
  const requireUpdate = createRequirePermission(
    deps.permissionService,
    'stock.update',
  );
  const requireDelete = createRequirePermission(
    deps.permissionService,
    'stock.delete',
  );

  routes.get('/', requireAuth, requireTenant, requireRead, async (c) => {
    const query = listStockQuerySchema.safeParse({
      q: c.req.query('q') || undefined,
      category: c.req.query('category') || undefined,
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
    const result = await deps.stockService.list(tenantScope(c), query.data);
    return c.json({ ok: true as const, ...result });
  });

  routes.get('/:id', requireAuth, requireTenant, requireRead, async (c) => {
    const item = await deps.stockService.get(tenantScope(c), c.req.param('id'));
    return c.json({ ok: true as const, item });
  });

  routes.post('/', requireAuth, requireTenant, requireCreate, async (c) => {
    const body = parseJson(
      createStockItemSchema,
      await c.req.json().catch(() => ({})),
    );
    const item = await deps.stockService.create(tenantScope(c), body);
    return c.json({ ok: true as const, item }, 201);
  });

  routes.patch('/:id', requireAuth, requireTenant, requireUpdate, async (c) => {
    const body = parseJson(
      updateStockItemSchema,
      await c.req.json().catch(() => ({})),
    );
    const item = await deps.stockService.update(
      tenantScope(c),
      c.req.param('id'),
      body,
    );
    return c.json({ ok: true as const, item });
  });

  routes.delete('/:id', requireAuth, requireTenant, requireDelete, async (c) => {
    await deps.stockService.delete(tenantScope(c), c.req.param('id'));
    return c.json({ ok: true as const });
  });

  return routes;
}
