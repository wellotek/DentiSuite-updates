import { Hono } from 'hono';
import type { PrismaClient } from '@prisma/client';
import type { AppointmentService } from '../appointments/service.js';
import {
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  updateAppointmentSchema,
} from '../appointments/schemas.js';
import { writeAuditLog } from '../audit/service.js';
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
import { routeAuditActor } from './audit.js';

export type AppointmentRouteDeps = {
  authService: AuthService;
  organizationService: OrganizationService;
  permissionService: PermissionService;
  appointmentService: AppointmentService;
  prisma: PrismaClient;
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

export function createAppointmentRoutes(deps: AppointmentRouteDeps) {
  const routes = new Hono<{ Variables: AuthVariables & Partial<TenantVariables> }>();
  const requireAuth = createAuthMiddleware(deps.authService);
  const requireTenant = createTenantMiddleware(deps.organizationService);
  const requireRead = createRequirePermission(
    deps.permissionService,
    'appointments.read',
  );
  const requireCreate = createRequirePermission(
    deps.permissionService,
    'appointments.create',
  );
  const requireUpdate = createRequirePermission(
    deps.permissionService,
    'appointments.update',
  );
  const requireDelete = createRequirePermission(
    deps.permissionService,
    'appointments.delete',
  );

  routes.get('/', requireAuth, requireTenant, requireRead, async (c) => {
    const query = listAppointmentsQuerySchema.safeParse({
      date: c.req.query('date') || undefined,
      from: c.req.query('from') || undefined,
      to: c.req.query('to') || undefined,
      patientId: c.req.query('patientId') || undefined,
      dentistId: c.req.query('dentistId') || undefined,
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

    const result = await deps.appointmentService.list(tenantScope(c), query.data);
    return c.json({ ok: true as const, ...result });
  });

  routes.get('/:id', requireAuth, requireTenant, requireRead, async (c) => {
    const appointment = await deps.appointmentService.getById(
      tenantScope(c),
      c.req.param('id'),
    );
    return c.json({ ok: true as const, appointment });
  });

  routes.post('/', requireAuth, requireTenant, requireCreate, async (c) => {
    const body = parseJson(
      createAppointmentSchema,
      await c.req.json().catch(() => ({})),
    );
    const scope = tenantScope(c);
    const appointment = await deps.appointmentService.create(scope, body);
    await writeAuditLog(deps.prisma, {
      organizationId: scope.organizationId,
      actor: routeAuditActor(c),
      action: 'APPOINTMENT_CREATED',
      module: 'appointments',
      resourceType: 'appointment',
      resourceId: appointment.id,
      summary: `Rendez-vous créé (${appointment.date} ${appointment.time})`,
    });
    return c.json({ ok: true as const, appointment }, 201);
  });

  routes.patch('/:id', requireAuth, requireTenant, requireUpdate, async (c) => {
    const body = parseJson(
      updateAppointmentSchema,
      await c.req.json().catch(() => ({})),
    );
    const scope = tenantScope(c);
    const appointment = await deps.appointmentService.update(
      scope,
      c.req.param('id'),
      body,
    );
    await writeAuditLog(deps.prisma, {
      organizationId: scope.organizationId,
      actor: routeAuditActor(c),
      action: 'APPOINTMENT_UPDATED',
      module: 'appointments',
      resourceType: 'appointment',
      resourceId: appointment.id,
      summary: `Rendez-vous modifié`,
    });
    return c.json({ ok: true as const, appointment });
  });

  routes.delete('/:id', requireAuth, requireTenant, requireDelete, async (c) => {
    const scope = tenantScope(c);
    const id = c.req.param('id');
    await deps.appointmentService.delete(scope, id);
    await writeAuditLog(deps.prisma, {
      organizationId: scope.organizationId,
      actor: routeAuditActor(c),
      action: 'APPOINTMENT_DELETED',
      module: 'appointments',
      resourceType: 'appointment',
      resourceId: id,
      summary: 'Rendez-vous supprimé',
    });
    return c.json({ ok: true as const });
  });

  return routes;
}
