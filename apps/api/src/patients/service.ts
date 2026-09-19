import type { Patient, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import { PatientRepository, type TenantScope } from './repository.js';
import type {
  CreatePatientInput,
  ListPatientsQuery,
  UpdatePatientInput,
} from './schemas.js';

export type PublicPatient = {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  phone: string;
  age: number;
  birthDate: string | null;
  address: string;
  antecedents: string;
  hasAllergies: boolean;
  dentistId: string | null;
  teeth: Record<string, unknown>;
  notes: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export class PatientService {
  private readonly repo: PatientRepository;

  constructor(
    prisma: PrismaClient,
    private readonly logger: Logger,
    private readonly mediaPurge?: {
      purgeObjectsForPatient(scope: TenantScope, patientId: string): Promise<number>;
    },
  ) {
    this.repo = new PatientRepository(prisma);
  }

  toPublic(patient: Patient): PublicPatient {
    return {
      id: patient.id,
      organizationId: patient.organizationId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      phone: patient.phone,
      age: patient.age,
      birthDate: patient.birthDate ?? null,
      address: patient.address,
      antecedents: patient.antecedents,
      hasAllergies: patient.hasAllergies,
      dentistId: patient.dentistId,
      teeth: (patient.teeth ?? {}) as Record<string, unknown>,
      notes: patient.notes,
      archivedAt: patient.archivedAt ? patient.archivedAt.toISOString() : null,
      archivedBy: patient.archivedBy ?? null,
      createdAt: patient.createdAt.toISOString(),
      updatedAt: patient.updatedAt.toISOString(),
    };
  }

  async create(scope: TenantScope, input: CreatePatientInput): Promise<PublicPatient> {
    const patient = await this.repo.create(scope, randomUUID(), input);
    this.logger.info(
      {
        clinicalEvent: 'patient_created',
        organizationId: scope.organizationId,
        patientId: patient.id,
      },
      'Patient created',
    );
    return this.toPublic(patient);
  }

  async list(
    scope: TenantScope,
    query: ListPatientsQuery,
  ): Promise<{
    items: PublicPatient[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const { items, total } = await this.repo.list(scope, query);
    return {
      items: items.map((p) => this.toPublic(p)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit) || 1),
    };
  }

  async get(scope: TenantScope, id: string): Promise<PublicPatient> {
    const patient = await this.repo.findById(scope, id);
    if (!patient) {
      throw new AppError(404, 'NOT_FOUND', 'Patient not found');
    }
    return this.toPublic(patient);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdatePatientInput,
  ): Promise<PublicPatient> {
    const existing = await this.repo.findById(scope, id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Patient not found');
    }

    if (input.expectedUpdatedAt) {
      const expectedMs = Date.parse(input.expectedUpdatedAt);
      const currentMs = existing.updatedAt.getTime();
      if (!Number.isFinite(expectedMs) || Math.abs(currentMs - expectedMs) > 1) {
        throw new AppError(
          409,
          'CONFLICT',
          'Cette donnée a été modifiée sur un autre poste. Rechargez les données avant de continuer.',
          { patient: this.toPublic(existing) },
        );
      }
    }

    const patient = await this.repo.update(scope, id, input.patch);
    if (!patient) {
      throw new AppError(404, 'NOT_FOUND', 'Patient not found');
    }
    this.logger.info(
      {
        clinicalEvent: 'patient_updated',
        organizationId: scope.organizationId,
        patientId: patient.id,
      },
      'Patient updated',
    );
    return this.toPublic(patient);
  }

  /** Soft-archive — retains clinical history. Replaces hard delete as default. */
  async archive(
    scope: TenantScope,
    id: string,
    archivedBy: string | null,
  ): Promise<PublicPatient> {
    const patient = await this.repo.archive(scope, id, archivedBy);
    if (!patient) {
      throw new AppError(404, 'NOT_FOUND', 'Patient not found');
    }
    this.logger.info(
      {
        clinicalEvent: 'patient_archived',
        organizationId: scope.organizationId,
        patientId: id,
      },
      'Patient archived',
    );
    return this.toPublic(patient);
  }

  async restore(scope: TenantScope, id: string): Promise<PublicPatient> {
    const patient = await this.repo.restore(scope, id);
    if (!patient) {
      throw new AppError(404, 'NOT_FOUND', 'Patient not found');
    }
    this.logger.info(
      {
        clinicalEvent: 'patient_restored',
        organizationId: scope.organizationId,
        patientId: id,
      },
      'Patient restored',
    );
    return this.toPublic(patient);
  }

  /** Physical purge — explicit only. Cascades clinical rows + R2 media. */
  async purge(scope: TenantScope, id: string): Promise<void> {
    const existing = await this.repo.findById(scope, id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Patient not found');
    }
    if (!existing.archivedAt) {
      throw new AppError(
        409,
        'NOT_ARCHIVED',
        'Patient must be soft-archived before purge',
      );
    }

    if (this.mediaPurge) {
      await this.mediaPurge.purgeObjectsForPatient(scope, id);
    }
    const deleted = await this.repo.hardDelete(scope, id);
    if (!deleted) {
      throw new AppError(404, 'NOT_FOUND', 'Patient not found');
    }
    this.logger.info(
      {
        clinicalEvent: 'patient_purged',
        organizationId: scope.organizationId,
        patientId: id,
      },
      'Patient purged',
    );
  }

  /** @deprecated Prefer archive(). Kept for callers that still invoke delete. */
  async delete(scope: TenantScope, id: string, archivedBy: string | null = null): Promise<void> {
    await this.archive(scope, id, archivedBy);
  }
}
