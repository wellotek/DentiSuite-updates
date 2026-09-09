import { Hono } from 'hono';
import type { AuthService } from '../auth/service.js';
import type { ClinicalCareService } from '../consultations/service.js';
import {
  createConsultationSchema,
  createTreatmentSchema,
  listConsultationsQuerySchema,
  listTreatmentsQuerySchema,
  updateConsultationSchema,
  updateTreatmentSchema,
} from '../consultations/schemas.js';
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

export type ClinicalRouteDeps = {
  authService: AuthService;
  organizationService: OrganizationService;
  permissionService: PermissionService;
  clinicalCareService: ClinicalCareService;
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
 * Clinical sessions (local PatientSession) + treatments.
 * Mounted at application root so paths are absolute.
 */
export function createClinicalRoutes(deps: ClinicalRouteDeps) {
  const routes = new Hono<{ Variables: AuthVariables & Partial<TenantVariables> }>();
  const requireAuth = createAuthMiddleware(deps.authService);
  const requireTenant = createTenantMiddleware(deps.organizationService);
  const requireRead = createRequirePermission(
    deps.permissionService,
    'consultations.read',
  );
  const requireCreate = createRequirePermission(
    deps.permissionService,
    'consultations.create',
  );
  const requireUpdate = createRequirePermission(
    deps.permissionService,
    'consultations.update',
  );
  const requireDelete = createRequirePermission(
    deps.permissionService,
    'consultations.delete',
  );

  // —— Consultations (ClinicalSession) ——
  routes.get(
    '/patients/:patientId/consultations',
    requireAuth,
    requireTenant,
    requireRead,
    async (c) => {
      const query = listConsultationsQuerySchema.safeParse({
        date: c.req.query('date') || undefined,
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
      const result = await deps.clinicalCareService.listConsultations(
        tenantScope(c),
        c.req.param('patientId'),
        query.data,
      );
      return c.json({ ok: true as const, ...result });
    },
  );

  routes.post(
    '/patients/:patientId/consultations',
    requireAuth,
    requireTenant,
    requireCreate,
    async (c) => {
      const body = parseJson(
        createConsultationSchema,
        await c.req.json().catch(() => ({})),
      );
      const consultation = await deps.clinicalCareService.createConsultation(
        tenantScope(c),
        c.req.param('patientId'),
        body,
      );
      return c.json({ ok: true as const, consultation }, 201);
    },
  );

  routes.get(
    '/consultations/:id',
    requireAuth,
    requireTenant,
    requireRead,
    async (c) => {
      const consultation = await deps.clinicalCareService.getConsultation(
        tenantScope(c),
        c.req.param('id'),
      );
      return c.json({ ok: true as const, consultation });
    },
  );

  routes.patch(
    '/consultations/:id',
    requireAuth,
    requireTenant,
    requireUpdate,
    async (c) => {
      const body = parseJson(
        updateConsultationSchema,
        await c.req.json().catch(() => ({})),
      );
      const consultation = await deps.clinicalCareService.updateConsultation(
        tenantScope(c),
        c.req.param('id'),
        body,
      );
      return c.json({ ok: true as const, consultation });
    },
  );

  routes.delete(
    '/consultations/:id',
    requireAuth,
    requireTenant,
    requireDelete,
    async (c) => {
      await deps.clinicalCareService.deleteConsultation(
        tenantScope(c),
        c.req.param('id'),
      );
      return c.json({ ok: true as const });
    },
  );

  // —— Treatments (sibling of ClinicalSession, not nested) ——
  routes.get(
    '/patients/:patientId/treatments',
    requireAuth,
    requireTenant,
    requireRead,
    async (c) => {
      const query = listTreatmentsQuerySchema.safeParse({
        date: c.req.query('date') || undefined,
        careStatus: c.req.query('careStatus') || undefined,
        paymentStatus: c.req.query('paymentStatus') || undefined,
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
      const result = await deps.clinicalCareService.listTreatments(
        tenantScope(c),
        c.req.param('patientId'),
        query.data,
      );
      return c.json({ ok: true as const, ...result });
    },
  );

  routes.post(
    '/patients/:patientId/treatments',
    requireAuth,
    requireTenant,
    requireCreate,
    async (c) => {
      const body = parseJson(
        createTreatmentSchema,
        await c.req.json().catch(() => ({})),
      );
      const treatment = await deps.clinicalCareService.createTreatment(
        tenantScope(c),
        c.req.param('patientId'),
        body,
      );
      return c.json({ ok: true as const, treatment }, 201);
    },
  );

  routes.get(
    '/treatments/:id',
    requireAuth,
    requireTenant,
    requireRead,
    async (c) => {
      const treatment = await deps.clinicalCareService.getTreatment(
        tenantScope(c),
        c.req.param('id'),
      );
      return c.json({ ok: true as const, treatment });
    },
  );

  routes.patch(
    '/treatments/:id',
    requireAuth,
    requireTenant,
    requireUpdate,
    async (c) => {
      const body = parseJson(
        updateTreatmentSchema,
        await c.req.json().catch(() => ({})),
      );
      const treatment = await deps.clinicalCareService.updateTreatment(
        tenantScope(c),
        c.req.param('id'),
        body,
      );
      return c.json({ ok: true as const, treatment });
    },
  );

  routes.delete(
    '/treatments/:id',
    requireAuth,
    requireTenant,
    requireDelete,
    async (c) => {
      await deps.clinicalCareService.deleteTreatment(
        tenantScope(c),
        c.req.param('id'),
      );
      return c.json({ ok: true as const });
    },
  );

  return routes;
}
