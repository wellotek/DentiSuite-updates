import type { Membership, Organization, User } from '@prisma/client';
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
import type { TeamService } from '../team/service.js';
import {
  createTeamMemberSchema,
  listTeamQuerySchema,
  updateTeamMemberSchema,
} from '../team/schemas.js';

export type TeamRouteDeps = {
  authService: AuthService;
  organizationService: OrganizationService;
  permissionService: PermissionService;
  teamService: TeamService;
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

function teamActor(c: {
  get: (key: 'user' | 'membership' | 'organization') => unknown;
}) {
  const user = c.get('user') as User | undefined;
  const membership = c.get('membership') as Membership | undefined;
  const organization = c.get('organization') as Organization | undefined;
  if (!user || !membership || !organization) {
    throw new AppError(403, 'ORGANIZATION_REQUIRED', 'Organization access required');
  }
  return { user, membership, organization };
}

/**
 * Team / collaborator management.
 * Mounted at /team (same style as /dentists — no /api prefix in this codebase).
 */
export function createTeamRoutes(deps: TeamRouteDeps) {
  const routes = new Hono<{ Variables: AuthVariables & Partial<TenantVariables> }>();
  const requireAuth = createAuthMiddleware(deps.authService);
  const requireTenant = createTenantMiddleware(deps.organizationService);
  const requireRead = createRequirePermission(deps.permissionService, 'team.read');
  const requireCreate = createRequirePermission(deps.permissionService, 'team.create');
  const requireUpdate = createRequirePermission(deps.permissionService, 'team.update');
  const requireDelete = createRequirePermission(deps.permissionService, 'team.delete');

  routes.get('/', requireAuth, requireTenant, requireRead, async (c) => {
    const query = listTeamQuerySchema.safeParse({
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
    const result = await deps.teamService.list(teamActor(c), query.data);
    return c.json({ ok: true as const, ...result });
  });

  routes.post('/', requireAuth, requireTenant, requireCreate, async (c) => {
    const body = parseJson(createTeamMemberSchema, await c.req.json().catch(() => ({})));
    const member = await deps.teamService.create(teamActor(c), body);
    return c.json({ ok: true as const, member }, 201);
  });

  routes.patch('/:membershipId', requireAuth, requireTenant, requireUpdate, async (c) => {
    const body = parseJson(updateTeamMemberSchema, await c.req.json().catch(() => ({})));
    const member = await deps.teamService.update(
      teamActor(c),
      c.req.param('membershipId'),
      body,
    );
    return c.json({ ok: true as const, member });
  });

  routes.delete('/:membershipId', requireAuth, requireTenant, requireDelete, async (c) => {
    await deps.teamService.remove(teamActor(c), c.req.param('membershipId'));
    return c.json({ ok: true as const });
  });

  return routes;
}
