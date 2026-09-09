import type { Dentist, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import type { TenantScope } from '../patients/repository.js';
import { DentistRepository } from './repository.js';
import type {
  CreateDentistInput,
  ListDentistsQuery,
  UpdateDentistInput,
} from './schemas.js';

export type PublicDentist = {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  specialty: string;
  photo: string;
  color: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export class DentistService {
  private readonly dentists: DentistRepository;

  constructor(
    prisma: PrismaClient,
    private readonly logger: Logger,
  ) {
    this.dentists = new DentistRepository(prisma);
  }

  toPublic(row: Dentist): PublicDentist {
    return {
      id: row.id,
      organizationId: row.organizationId,
      firstName: row.firstName,
      lastName: row.lastName,
      specialty: row.specialty,
      photo: row.photo,
      color: row.color,
      displayName: `Dr. ${row.firstName} ${row.lastName}`,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(
    scope: TenantScope,
    input: CreateDentistInput,
  ): Promise<PublicDentist> {
    const row = await this.dentists.create(scope, randomUUID(), input);
    this.logger.info(
      {
        clinicalEvent: 'dentist_created',
        organizationId: scope.organizationId,
        dentistId: row.id,
      },
      'Dentist created',
    );
    return this.toPublic(row);
  }

  async list(scope: TenantScope, query: ListDentistsQuery) {
    const { items, total } = await this.dentists.list(scope, query);
    return {
      items: items.map((i) => this.toPublic(i)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit) || 1),
    };
  }

  async get(scope: TenantScope, id: string): Promise<PublicDentist> {
    const row = await this.dentists.findById(scope, id);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Dentist not found');
    }
    return this.toPublic(row);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdateDentistInput,
  ): Promise<PublicDentist> {
    const row = await this.dentists.update(scope, id, input);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Dentist not found');
    }
    this.logger.info(
      {
        clinicalEvent: 'dentist_updated',
        organizationId: scope.organizationId,
        dentistId: row.id,
      },
      'Dentist updated',
    );
    return this.toPublic(row);
  }

  async delete(scope: TenantScope, id: string): Promise<void> {
    const deleted = await this.dentists.delete(scope, id);
    if (!deleted) {
      throw new AppError(404, 'NOT_FOUND', 'Dentist not found');
    }
    this.logger.info(
      {
        clinicalEvent: 'dentist_deleted',
        organizationId: scope.organizationId,
        dentistId: id,
      },
      'Dentist deleted',
    );
  }
}
