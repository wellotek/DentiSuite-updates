import { Hono } from 'hono';
import type { AuthService } from '../auth/service.js';
import { AppError } from '../lib/errors.js';
import {
  createAuthMiddleware,
  type AuthVariables,
} from '../middleware/auth.js';
import {
  createTenantMiddleware,
  requireAdminRole,
  type TenantVariables,
} from '../middleware/tenant.js';
import type { OrganizationService } from '../organization/service.js';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
} from '../organization/schemas.js';

export type OrganizationRouteDeps = {
  authService: AuthService;
  organizationService: OrganizationService;
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

/**
 * Organization API (Phase 3).
 * POST /organization — bootstrap cabinet + ADMIN membership
 * GET  /organization/me
 * PATCH /organization/me — ADMIN only
 * GET  /organization/me/membership
 */
export function createOrganizationRoutes(deps: OrganizationRouteDeps) {
  const routes = new Hono<{ Variables: AuthVariables & Partial<TenantVariables> }>();
  const requireAuth = createAuthMiddleware(deps.authService);
  const requireTenant = createTenantMiddleware(deps.organizationService);
  const requireAdmin = requireAdminRole();

  routes.post('/', requireAuth, async (c) => {
    const body = parseJson(
      createOrganizationSchema(),
      await c.req.json().catch(() => ({})),
    );

    // userId is always taken from authenticated context — never from body.
    const result = await deps.organizationService.createOrganizationForUser(
      c.get('user'),
      body.name,
    );

    return c.json(
      {
        ok: true as const,
        organization: result.organization,
        membership: result.membership,
        licenseBinding: null,
      },
      201,
    );
  });

  routes.get('/me', requireAuth, requireTenant, async (c) => {
    return c.json({
      ok: true as const,
      organization: deps.organizationService.toPublicOrganization(c.get('organization')!),
      auth: c.get('auth'),
    });
  });

  routes.patch('/me', requireAuth, requireTenant, requireAdmin, async (c) => {
    const body = parseJson(
      updateOrganizationSchema(),
      await c.req.json().catch(() => ({})),
    );

    const organization = await deps.organizationService.updateOrganizationAsAdmin(
      c.get('auth').userId,
      c.get('membership')!,
      c.get('organization')!,
      body.name,
    );

    return c.json({
      ok: true as const,
      organization,
    });
  });

  routes.get('/me/membership', requireAuth, requireTenant, async (c) => {
    return c.json({
      ok: true as const,
      membership: deps.organizationService.toPublicMembership(c.get('membership')!),
      auth: c.get('auth'),
    });
  });

  return routes;
}
