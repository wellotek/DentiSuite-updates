import { Hono } from 'hono';
import type { AuthService } from '../auth/service.js';
import {
  createBootstrapOrganizationSchema,
  createChangePasswordSchema,
  createLoginSchema,
  createRegisterSchema,
  onboardingStatusQuerySchema,
  revokeDeviceSchema,
  revokeSessionSchema,
} from '../auth/schemas.js';
import type { AppConfig } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import {
  createAuthMiddleware,
  extractBearer,
  type AuthVariables,
} from '../middleware/auth.js';
import { createRequirePermission } from '../middleware/permission.js';
import {
  createRateLimitMiddleware,
  type MemoryRateLimitStore,
} from '../middleware/rate-limit.js';
import {
  createTenantMiddleware,
  type TenantVariables,
} from '../middleware/tenant.js';
import type { OrganizationService } from '../organization/service.js';
import type { PermissionService } from '../permissions/service.js';
import { PERMISSIONS } from '../permissions/vocabulary.js';

export type AuthRouteDeps = {
  config: AppConfig;
  authService: AuthService;
  organizationService: OrganizationService;
  permissionService: PermissionService;
  rateLimitStore: MemoryRateLimitStore;
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

export function createAuthRoutes(deps: AuthRouteDeps) {
  const auth = new Hono<{ Variables: AuthVariables & Partial<TenantVariables> }>();
  const requireAuth = createAuthMiddleware(deps.authService);
  const requireTenant = createTenantMiddleware(deps.organizationService);
  const requireProfileRead = createRequirePermission(
    deps.permissionService,
    'profile.read',
  );

  const rateLimit = createRateLimitMiddleware({
    store: deps.rateLimitStore,
    windowMs: deps.config.authRateLimitWindowMs,
    max: deps.config.authRateLimitMax,
    keyPrefix: 'auth',
  });

  auth.post('/register', rateLimit, async (c) => {
    const body = parseJson(
      createRegisterSchema(deps.config.passwordMinLength),
      await c.req.json().catch(() => ({})),
    );
    const result = await deps.authService.register(body.email, body.password);
    return c.json({ ok: true as const, ...result }, 201);
  });

  auth.post('/login', rateLimit, async (c) => {
    const body = parseJson(createLoginSchema(), await c.req.json().catch(() => ({})));
    const result = await deps.authService.login(body.email, body.password, body.device);
    return c.json({
      ok: true as const,
      token: result.token,
      expiresAt: result.expiresAt,
      user: result.user,
      organization: null,
      membership: null,
    });
  });

  /**
   * Commercial onboarding — public, rate-limited.
   * Creates Organization + ADMIN User + Membership + LicenseBinding + Dentist, then session.
   */
  auth.post('/bootstrap-organization', rateLimit, async (c) => {
    const body = parseJson(
      createBootstrapOrganizationSchema(deps.config.passwordMinLength),
      await c.req.json().catch(() => ({})),
    );
    const result = await deps.authService.bootstrapOrganization(body);
    return c.json(
      {
        ok: true as const,
        token: result.token,
        expiresAt: result.expiresAt,
        user: result.user,
        organization: result.organization,
        membership: result.membership,
        dentist: result.dentist,
      },
      201,
    );
  });

  /** Public: whether a license key already has a clinic (decide LOGIN vs REGISTER UI). */
  auth.get('/onboarding-status', rateLimit, async (c) => {
    const parsed = onboardingStatusQuerySchema.safeParse({
      licenseKey: c.req.query('licenseKey') ?? '',
    });
    if (!parsed.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid request',
      );
    }
    const status = await deps.authService.getOnboardingStatus(parsed.data.licenseKey);
    return c.json({ ok: true as const, ...status });
  });

  auth.post('/logout', rateLimit, async (c) => {
    const rawToken = extractBearer(c.req.header('authorization'));
    await deps.authService.logoutByToken(rawToken);
    return c.json({ ok: true as const });
  });

  auth.post('/refresh', rateLimit, requireAuth, async (c) => {
    const user = c.get('user');
    const session = c.get('session');
    const rawToken = c.get('rawToken');
    const refreshed = await deps.authService.refresh(session, user);
    return c.json({
      ok: true as const,
      token: rawToken,
      expiresAt: refreshed.expiresAt,
      user: refreshed.user,
      organization: null,
      membership: null,
    });
  });

  auth.get('/me', requireAuth, async (c) => {
    return c.json({
      ok: true as const,
      user: c.get('publicUser'),
      auth: c.get('auth'),
      organization: null,
      membership: null,
    });
  });

  /**
   * Effective permissions for the authenticated membership's organization.
   * Client role / organizationId query/body hints are ignored.
   */
  auth.get(
    '/permissions',
    requireAuth,
    requireTenant,
    requireProfileRead,
    async (c) => {
      void c.req.query('role');
      void c.req.query('organizationId');
      void c.req.header('x-organization-id');

      const permissions = await deps.permissionService.getEffectivePermissions({
        user: c.get('user'),
        membership: c.get('membership')!,
        organization: c.get('organization')!,
      });

      return c.json({
        ok: true as const,
        organizationId: c.get('auth').organizationId,
        membershipId: c.get('auth').membershipId,
        role: c.get('auth').membershipRole,
        permissions,
        catalogSize: PERMISSIONS.length,
      });
    },
  );

  auth.post('/change-password', rateLimit, requireAuth, async (c) => {
    const body = parseJson(
      createChangePasswordSchema(deps.config.passwordMinLength),
      await c.req.json().catch(() => ({})),
    );
    const user = await deps.authService.changePassword(
      c.get('user'),
      c.get('auth').sessionId,
      body.currentPassword,
      body.newPassword,
    );
    return c.json({ ok: true as const, user });
  });

  auth.post('/revoke-session', requireAuth, async (c) => {
    const body = parseJson(revokeSessionSchema, await c.req.json().catch(() => ({})));
    await deps.authService.revokeSession(
      c.get('auth').userId,
      c.get('auth').sessionId,
      body.sessionId,
    );
    return c.json({ ok: true as const });
  });

  auth.post('/revoke-device', requireAuth, async (c) => {
    const body = parseJson(revokeDeviceSchema, await c.req.json().catch(() => ({})));
    await deps.authService.revokeDevice(c.get('auth').userId, body.deviceId);
    return c.json({ ok: true as const });
  });

  auth.get('/sessions', requireAuth, async (c) => {
    const sessions = await deps.authService.listSessions(c.get('auth').userId);
    return c.json({ ok: true as const, sessions });
  });

  auth.get('/devices', requireAuth, async (c) => {
    const devices = await deps.authService.listDevices(c.get('auth').userId);
    return c.json({ ok: true as const, devices });
  });

  return auth;
}
