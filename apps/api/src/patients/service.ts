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
  address: string;
  antecedents: string;
  hasAllergies: boolean;
  dentistId: string | null;
  teeth: Record<string, unknown>;
  notes: string | null;
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
      address: patient.address,
      antecedents: patient.antecedents,
      hasAllergies: patient.hasAllergies,
      dentistId: patient.dentistId,
      teeth: (patient.teeth ?? {}) as Record<string, unknown>,
      notes: patient.notes,
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

  async getById(scope: TenantScope, id: string): Promise<PublicPatient> {
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
    const patient = await this.repo.update(scope, id, input);
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

  async delete(scope: TenantScope, id: string): Promise<void> {
    // Purge object storage before Prisma cascade removes PatientMedia rows.
    if (this.mediaPurge) {
      await this.mediaPurge.purgeObjectsForPatient(scope, id);
    }
    const deleted = await this.repo.delete(scope, id);
    if (!deleted) {
      throw new AppError(404, 'NOT_FOUND', 'Patient not found');
    }
    this.logger.info(
      {
        clinicalEvent: 'patient_deleted',
        organizationId: scope.organizationId,
        patientId: id,
      },
      'Patient deleted',
    );
  }
}
