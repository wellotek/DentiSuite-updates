import type { PrismaClient, Prosthesis } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { formatCalendarDate } from '../appointments/schemas.js';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import { PatientRepository, type TenantScope } from '../patients/repository.js';
import { ProsthesisRepository } from './repository.js';
import type {
  CreateProsthesisInput,
  ListProsthesesQuery,
  UpdateProsthesisInput,
} from './schemas.js';

export type PublicProsthesis = {
  id: string;
  organizationId: string;
  patientId: string;
  patientName: string;
  type: string;
  tooth: string;
  lab: string;
  sentAt: string;
  expectedAt: string | null;
  notes: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export class ProsthesisService {
  private readonly prostheses: ProsthesisRepository;
  private readonly patients: PatientRepository;

  constructor(
    prisma: PrismaClient,
    private readonly logger: Logger,
  ) {
    this.prostheses = new ProsthesisRepository(prisma);
    this.patients = new PatientRepository(prisma);
  }

  private async requireTenantPatient(scope: TenantScope, patientId: string) {
    const patient = await this.patients.findById(scope, patientId);
    if (!patient) {
      throw new AppError(404, 'NOT_FOUND', 'Patient not found');
    }
    return patient;
  }

  toPublic(row: Prosthesis): PublicProsthesis {
    return {
      id: row.id,
      organizationId: row.organizationId,
      patientId: row.patientId,
      patientName: row.patientName,
      type: row.type,
      tooth: row.tooth,
      lab: row.lab,
      sentAt: formatCalendarDate(row.sentAt),
      expectedAt: row.expectedAt ? formatCalendarDate(row.expectedAt) : null,
      notes: row.notes,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createForPatient(
    scope: TenantScope,
    patientId: string,
    input: CreateProsthesisInput,
  ) {
    const patient = await this.requireTenantPatient(scope, patientId);
    const patientName = `${patient.firstName} ${patient.lastName}`.trim();
    const row = await this.prostheses.create(
      scope,
      randomUUID(),
      patientId,
      patientName,
      input,
    );
    this.logger.info(
      {
        prosthesisEvent: 'prosthesis_created',
        organizationId: scope.organizationId,
        prosthesisId: row.id,
        patientId,
      },
      'Prosthesis created',
    );
    return this.toPublic(row);
  }

  async list(scope: TenantScope, query: ListProsthesesQuery) {
    if (query.patientId) {
      await this.requireTenantPatient(scope, query.patientId);
    }
    const { items, total } = await this.prostheses.list(scope, query);
    return {
      items: items.map((i) => this.toPublic(i)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit) || 1),
    };
  }

  async listForPatient(
    scope: TenantScope,
    patientId: string,
    query: ListProsthesesQuery,
  ) {
    await this.requireTenantPatient(scope, patientId);
    return this.list(scope, { ...query, patientId });
  }

  async get(scope: TenantScope, id: string) {
    const row = await this.prostheses.findById(scope, id);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Prosthesis not found');
    return this.toPublic(row);
  }

  async update(scope: TenantScope, id: string, input: UpdateProsthesisInput) {
    let patientName: string | undefined;
    if (input.patientId !== undefined) {
      const patient = await this.requireTenantPatient(scope, input.patientId);
      patientName = `${patient.firstName} ${patient.lastName}`.trim();
    }
    const row = await this.prostheses.update(scope, id, input, patientName);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Prosthesis not found');
    this.logger.info(
      {
        prosthesisEvent: 'prosthesis_updated',
        organizationId: scope.organizationId,
        prosthesisId: row.id,
      },
      'Prosthesis updated',
    );
    return this.toPublic(row);
  }

  async delete(scope: TenantScope, id: string) {
    const deleted = await this.prostheses.delete(scope, id);
    if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Prosthesis not found');
    this.logger.info(
      {
        prosthesisEvent: 'prosthesis_deleted',
        organizationId: scope.organizationId,
        prosthesisId: id,
      },
      'Prosthesis deleted',
    );
  }
}
