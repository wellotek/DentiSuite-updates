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
import { writeAuditLog } from '../audit/service.js';
import type { PatientService } from '../patients/service.js';
import {
  createPatientSchema,
  listPatientsQuerySchema,
  updatePatientSchema,
} from '../patients/schemas.js';
import { routeAuditActor } from './audit.js';
import type { PrismaClient } from '@prisma/client';

export type PatientRouteDeps = {
  authService: AuthService;
  organizationService: OrganizationService;
  permissionService: PermissionService;
  patientService: PatientService;
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

export function createPatientRoutes(deps: PatientRouteDeps) {
  const routes = new Hono<{ Variables: AuthVariables & Partial<TenantVariables> }>();
  const requireAuth = createAuthMiddleware(deps.authService);
  const requireTenant = createTenantMiddleware(deps.organizationService);
  const requireRead = createRequirePermission(deps.permissionService, 'patients.read');
  const requireCreate = createRequirePermission(deps.permissionService, 'patients.create');
  const requireUpdate = createRequirePermission(deps.permissionService, 'patients.update');
  const requireDelete = createRequirePermission(deps.permissionService, 'patients.delete');

  routes.get('/', requireAuth, requireTenant, requireRead, async (c) => {
    const query = listPatientsQuerySchema.safeParse({
      search: c.req.query('search') ?? '',
      page: c.req.query('page') ?? '1',
      limit: c.req.query('limit') ?? '20',
      includeArchived: c.req.query('includeArchived') ?? 'false',
    });
    if (!query.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        query.error.issues[0]?.message ?? 'Invalid query',
      );
    }

    const result = await deps.patientService.list(tenantScope(c), query.data);
    return c.json({ ok: true as const, ...result });
  });

  routes.get('/:id', requireAuth, requireTenant, requireRead, async (c) => {
    const patient = await deps.patientService.get(tenantScope(c), c.req.param('id'));
    return c.json({ ok: true as const, patient });
  });

  routes.post('/', requireAuth, requireTenant, requireCreate, async (c) => {
    const body = parseJson(createPatientSchema, await c.req.json().catch(() => ({})));
    const scope = tenantScope(c);
    const patient = await deps.patientService.create(scope, body);
    await writeAuditLog(deps.prisma, {
      organizationId: scope.organizationId,
      actor: routeAuditActor(c),
      action: 'PATIENT_CREATED',
      module: 'patients',
      resourceType: 'patient',
      resourceId: patient.id,
      summary: `Patient créé : ${patient.firstName} ${patient.lastName}`,
    });
    return c.json({ ok: true as const, patient }, 201);
  });

  routes.patch('/:id', requireAuth, requireTenant, requireUpdate, async (c) => {
    const body = parseJson(updatePatientSchema, await c.req.json().catch(() => ({})));
    const scope = tenantScope(c);
    const patient = await deps.patientService.update(
      scope,
      c.req.param('id'),
      body,
    );
    await writeAuditLog(deps.prisma, {
      organizationId: scope.organizationId,
      actor: routeAuditActor(c),
      action: 'PATIENT_UPDATED',
      module: 'patients',
      resourceType: 'patient',
      resourceId: patient.id,
      summary: `Patient modifié : ${patient.firstName} ${patient.lastName}`,
    });
    return c.json({ ok: true as const, patient });
  });

  /** Soft-archive (preserves clinical history). Same permission as former hard delete. */
  routes.delete('/:id', requireAuth, requireTenant, requireDelete, async (c) => {
    const scope = tenantScope(c);
    const id = c.req.param('id');
    const actor = routeAuditActor(c);
    const patient = await deps.patientService.archive(
      scope,
      id,
      actor?.user?.id ?? null,
    );
    await writeAuditLog(deps.prisma, {
      organizationId: scope.organizationId,
      actor,
      action: 'PATIENT_ARCHIVED',
      module: 'patients',
      resourceType: 'patient',
      resourceId: id,
      summary: `Patient archivé : ${patient.firstName} ${patient.lastName}`,
    });
    return c.json({ ok: true as const, patient, archived: true as const });
  });

  routes.post('/:id/restore', requireAuth, requireTenant, requireUpdate, async (c) => {
    const scope = tenantScope(c);
    const id = c.req.param('id');
    const patient = await deps.patientService.restore(scope, id);
    await writeAuditLog(deps.prisma, {
      organizationId: scope.organizationId,
      actor: routeAuditActor(c),
      action: 'PATIENT_RESTORED',
      module: 'patients',
      resourceType: 'patient',
      resourceId: id,
      summary: `Patient restauré : ${patient.firstName} ${patient.lastName}`,
    });
    return c.json({ ok: true as const, patient });
  });

  /** Explicit physical purge — irreversible. */
  routes.post('/:id/purge', requireAuth, requireTenant, requireDelete, async (c) => {
    const scope = tenantScope(c);
    const id = c.req.param('id');
    await deps.patientService.purge(scope, id);
    await writeAuditLog(deps.prisma, {
      organizationId: scope.organizationId,
      actor: routeAuditActor(c),
      action: 'PATIENT_PURGED',
      module: 'patients',
      resourceType: 'patient',
      resourceId: id,
      summary: 'Patient purgé définitivement',
    });
    return c.json({ ok: true as const, purged: true as const });
  });

  return routes;
}
