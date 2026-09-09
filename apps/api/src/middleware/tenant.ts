import type { Membership, Organization } from '@prisma/client';
import type { MiddlewareHandler } from 'hono';
import { AppError } from '../lib/errors.js';
import type { OrganizationService } from '../organization/service.js';
import type { AuthContext, AuthVariables } from './auth.js';

export type TenantVariables = AuthVariables & {
  organization: Organization;
  membership: Membership;
  auth: AuthContext & {
    organizationId: string;
    membershipId: string;
    membershipRole: 'ADMIN' | 'ASSISTANT';
  };
};

/**
 * Resolve ACTIVE membership → organization from the authenticated user.
 * Never trusts client organizationId (header/body/query are ignored).
 * Enforces LicenseBinding ACTIVE + non-expired when a binding exists.
 */
export function createTenantMiddleware(
  organizationService: OrganizationService,
): MiddlewareHandler<{ Variables: TenantVariables }> {
  return async (c, next) => {
    const auth = c.get('auth');
    if (!auth?.userId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    // Explicitly discard any client-supplied tenant hints.
    void c.req.header('x-organization-id');
    void c.req.query('organizationId');

    const { organization, membership } =
      await organizationService.resolveTenantForUser(auth.userId);

    await organizationService.assertLicenseAllowsAccess(organization.id);

    const enriched: TenantVariables['auth'] = {
      ...auth,
      organizationId: organization.id,
      membershipId: membership.id,
      membershipRole: membership.role,
    };

    c.set('auth', enriched);
    c.set('organization', organization);
    c.set('membership', membership);

    await next();
  };
}

export function requireAdminRole(): MiddlewareHandler<{ Variables: TenantVariables }> {
  return async (c, next) => {
    const membership = c.get('membership');
    if (!membership || membership.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'Admin role required');
    }
    await next();
  };
}
