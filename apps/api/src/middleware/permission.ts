import type { MiddlewareHandler } from 'hono';
import { AppError } from '../lib/errors.js';
import type { PermissionService } from '../permissions/service.js';
import type { TenantVariables } from './tenant.js';

/**
 * authenticate → resolve tenant → require permission → handler
 */
export function createRequirePermission(
  permissionService: PermissionService,
  permission: string,
): MiddlewareHandler<{ Variables: TenantVariables }> {
  return async (c, next) => {
    const user = c.get('user');
    const membership = c.get('membership');
    const organization = c.get('organization');

    if (!user || !membership || !organization) {
      throw new AppError(403, 'ORGANIZATION_REQUIRED', 'Organization access required');
    }

    await permissionService.requirePermission(
      { user, membership, organization },
      permission,
    );

    await next();
  };
}
