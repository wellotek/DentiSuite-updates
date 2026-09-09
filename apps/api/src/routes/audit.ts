import type { Membership, User } from '@prisma/client';
import { Hono } from 'hono';
import type { AuthService } from '../auth/service.js';
import { AuditService, listAuditQuerySchema } from '../audit/list.js';
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

export type AuditRouteDeps = {
  authService: AuthService;
  organizationService: OrganizationService;
  permissionService: PermissionService;
  auditService: AuditService;
};

export function createAuditRoutes(deps: AuditRouteDeps) {
  const routes = new Hono<{ Variables: AuthVariables & Partial<TenantVariables> }>();
  const requireAuth = createAuthMiddleware(deps.authService);
  const requireTenant = createTenantMiddleware(deps.organizationService);
  const requireRead = createRequirePermission(deps.permissionService, 'audit.read');

  routes.get('/', requireAuth, requireTenant, requireRead, async (c) => {
    const query = listAuditQuerySchema.safeParse({
      page: c.req.query('page') ?? '1',
      limit: c.req.query('limit') ?? '50',
      module: c.req.query('module') || undefined,
      resourceId: c.req.query('resourceId') || undefined,
    });
    if (!query.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        query.error.issues[0]?.message ?? 'Invalid query',
      );
    }
    const auth = c.get('auth');
    if (!auth.organizationId) {
      throw new AppError(403, 'ORGANIZATION_REQUIRED', 'Organization access required');
    }
    const result = await deps.auditService.list(auth.organizationId, query.data);
    return c.json({ ok: true as const, ...result });
  });

  return routes;
}

/** Helper for mutation routes to build audit actor. */
export function routeAuditActor(c: {
  get: (key: 'user' | 'membership') => unknown;
}): { user: User; membership: Membership } | null {
  const user = c.get('user') as User | undefined;
  const membership = c.get('membership') as Membership | undefined;
  if (!user || !membership) return null;
  return { user, membership };
}
