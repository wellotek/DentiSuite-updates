import type { PrismaClient } from '@prisma/client';
import { Hono } from 'hono';
import { AppointmentService } from './appointments/service.js';
import { AuthService } from './auth/service.js';
import { BillingService } from './billing/service.js';
import { ClinicalCareService } from './consultations/service.js';
import { createObjectStorageFromConfig, type AppConfig } from './config/env.js';
import { DentistService } from './dentists/service.js';
import type { Logger } from './lib/logger.js';
import { PatientMediaService } from './media/service.js';
import type { ObjectStorage } from './media/storage.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { MemoryRateLimitStore } from './middleware/rate-limit.js';
import { OrganizationService } from './organization/service.js';
import { PatientService } from './patients/service.js';
import { PermissionService } from './permissions/service.js';
import { PrescriptionService } from './prescriptions/service.js';
import { ProsthesisService } from './prostheses/service.js';
import { StockService } from './stock/service.js';
import { TeamService } from './team/service.js';
import { AuditService } from './audit/list.js';
import { createAppointmentRoutes } from './routes/appointments.js';
import { createAuditRoutes } from './routes/audit.js';
import { createAuthRoutes } from './routes/auth.js';
import { createBillingRoutes } from './routes/billing.js';
import { createClinicalRoutes } from './routes/clinical.js';
import { createDentistRoutes } from './routes/dentists.js';
import { createHealthRoutes } from './routes/health.js';
import { createMediaRoutes } from './routes/media.js';
import { createOrganizationRoutes } from './routes/organization.js';
import { createPatientRoutes } from './routes/patients.js';
import { createPrescriptionRoutes } from './routes/prescriptions.js';
import { createProsthesisRoutes } from './routes/prostheses.js';
import { createStockRoutes } from './routes/stock.js';
import { createTeamRoutes } from './routes/team.js';

export type AppDeps = {
  config: AppConfig;
  logger: Logger;
  prisma: PrismaClient;
  rateLimitStore?: MemoryRateLimitStore;
  objectStorage?: ObjectStorage;
};

/**
 * Build the Hono application.
 * Phase 5H: clinical APIs including Stock and Prostheses.
 */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const rateLimitStore = deps.rateLimitStore ?? new MemoryRateLimitStore();
  const objectStorage =
    deps.objectStorage ?? createObjectStorageFromConfig(deps.config);
  const authService = new AuthService(deps.prisma, deps.config, deps.logger);
  const organizationService = new OrganizationService(deps.prisma, deps.logger);
  const permissionService = new PermissionService(deps.prisma, deps.logger);
  const mediaService = new PatientMediaService(
    deps.prisma,
    objectStorage,
    deps.logger,
    deps.config.mediaSignedUrlTtlSeconds,
  );
  const patientService = new PatientService(deps.prisma, deps.logger, mediaService);
  const appointmentService = new AppointmentService(deps.prisma, deps.logger);
  const clinicalCareService = new ClinicalCareService(deps.prisma, deps.logger);
  const prescriptionService = new PrescriptionService(deps.prisma, deps.logger);
  const dentistService = new DentistService(deps.prisma, deps.logger);
  const billingService = new BillingService(deps.prisma, deps.logger);
  const stockService = new StockService(deps.prisma, deps.logger);
  const prosthesisService = new ProsthesisService(deps.prisma, deps.logger);
  const teamService = new TeamService(
    deps.prisma,
    permissionService,
    deps.logger,
    deps.config.passwordMinLength,
  );
  const auditService = new AuditService(deps.prisma);

  app.onError(createErrorHandler(deps.logger, deps.config.isProduction));

  app.route('/health', createHealthRoutes(deps.config));
  app.route(
    '/auth',
    createAuthRoutes({
      config: deps.config,
      authService,
      organizationService,
      permissionService,
      rateLimitStore,
    }),
  );
  app.route(
    '/organization',
    createOrganizationRoutes({
      authService,
      organizationService,
      config: deps.config,
    }),
  );
  app.route(
    '/patients',
    createPatientRoutes({
      authService,
      organizationService,
      permissionService,
      patientService,
      prisma: deps.prisma,
    }),
  );
  app.route(
    '/appointments',
    createAppointmentRoutes({
      authService,
      organizationService,
      permissionService,
      appointmentService,
      prisma: deps.prisma,
    }),
  );
  app.route('/', createClinicalRoutes({
    authService,
    organizationService,
    permissionService,
    clinicalCareService,
  }));
  app.route('/', createPrescriptionRoutes({
    authService,
    organizationService,
    permissionService,
    prescriptionService,
  }));
  app.route(
    '/dentists',
    createDentistRoutes({
      authService,
      organizationService,
      permissionService,
      dentistService,
    }),
  );
  app.route('/', createMediaRoutes({
    authService,
    organizationService,
    permissionService,
    mediaService,
  }));
  app.route('/', createBillingRoutes({
    authService,
    organizationService,
    permissionService,
    billingService,
  }));
  app.route(
    '/stock',
    createStockRoutes({
      authService,
      organizationService,
      permissionService,
      stockService,
    }),
  );
  app.route('/', createProsthesisRoutes({
    authService,
    organizationService,
    permissionService,
    prosthesisService,
  }));
  app.route(
    '/team',
    createTeamRoutes({
      authService,
      organizationService,
      permissionService,
      teamService,
    }),
  );
  app.route(
    '/audit',
    createAuditRoutes({
      authService,
      organizationService,
      permissionService,
      auditService,
    }),
  );

  app.notFound((c) =>
    c.json(
      {
        ok: false as const,
        error: {
          code: 'NOT_FOUND',
          message: `Route not found: ${c.req.method} ${c.req.path}`,
        },
      },
      404,
    ),
  );

  return app;
}

export function createOrganizationService(
  prisma: PrismaClient,
  logger: Logger,
): OrganizationService {
  return new OrganizationService(prisma, logger);
}

export function createPermissionService(
  prisma: PrismaClient,
  logger: Logger,
): PermissionService {
  return new PermissionService(prisma, logger);
}

export function createPatientService(
  prisma: PrismaClient,
  logger: Logger,
): PatientService {
  return new PatientService(prisma, logger);
}

export function createAppointmentService(
  prisma: PrismaClient,
  logger: Logger,
): AppointmentService {
  return new AppointmentService(prisma, logger);
}

export function createClinicalCareService(
  prisma: PrismaClient,
  logger: Logger,
): ClinicalCareService {
  return new ClinicalCareService(prisma, logger);
}

export function createPrescriptionService(
  prisma: PrismaClient,
  logger: Logger,
): PrescriptionService {
  return new PrescriptionService(prisma, logger);
}

export function createDentistService(
  prisma: PrismaClient,
  logger: Logger,
): DentistService {
  return new DentistService(prisma, logger);
}

export function createBillingService(
  prisma: PrismaClient,
  logger: Logger,
): BillingService {
  return new BillingService(prisma, logger);
}
