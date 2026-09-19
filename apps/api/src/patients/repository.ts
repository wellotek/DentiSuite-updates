import type { Patient, Prisma, PrismaClient } from '@prisma/client';
import type {
  CreatePatientInput,
  ListPatientsQuery,
  PatientPatch,
} from './schemas.js';

export type TenantScope = {
  organizationId: string;
};

/**
 * All patient queries require organizationId — never query by id alone for access.
 */
export class PatientRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(scope: TenantScope, id: string, data: CreatePatientInput): Promise<Patient> {
    return this.prisma.patient.create({
      data: {
        id,
        organizationId: scope.organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        age: data.age,
        birthDate: data.birthDate,
        address: data.address,
        antecedents: data.antecedents,
        hasAllergies: data.hasAllergies,
        dentistId: data.dentistId,
        teeth: data.teeth as Prisma.InputJsonValue,
        notes: data.notes,
        updatedAt: new Date(),
      },
    });
  }

  async findById(scope: TenantScope, id: string): Promise<Patient | null> {
    return this.prisma.patient.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
      },
    });
  }

  async list(
    scope: TenantScope,
    query: ListPatientsQuery,
  ): Promise<{ items: Patient[]; total: number }> {
    const where = this.buildSearchWhere(scope.organizationId, query.search, query.includeArchived);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.patient.count({ where }),
      this.prisma.patient.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return { items, total };
  }

  async update(
    scope: TenantScope,
    id: string,
    data: PatientPatch,
  ): Promise<Patient | null> {
    const existing = await this.findById(scope, id);
    if (!existing) {
      return null;
    }

    return this.prisma.patient.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...(data.teeth !== undefined
          ? { teeth: data.teeth as Prisma.InputJsonValue }
          : {}),
        updatedAt: new Date(),
      },
    });
  }

  async archive(
    scope: TenantScope,
    id: string,
    archivedBy: string | null,
  ): Promise<Patient | null> {
    const existing = await this.findById(scope, id);
    if (!existing) return null;
    if (existing.archivedAt) return existing;
    return this.prisma.patient.update({
      where: { id: existing.id },
      data: {
        archivedAt: new Date(),
        archivedBy,
        updatedAt: new Date(),
      },
    });
  }

  async restore(scope: TenantScope, id: string): Promise<Patient | null> {
    const existing = await this.findById(scope, id);
    if (!existing) return null;
    return this.prisma.patient.update({
      where: { id: existing.id },
      data: {
        archivedAt: null,
        archivedBy: null,
        updatedAt: new Date(),
      },
    });
  }

  /** Physical delete — only after explicit purge. Cascades clinical rows. */
  async hardDelete(scope: TenantScope, id: string): Promise<boolean> {
    const existing = await this.findById(scope, id);
    if (!existing) {
      return false;
    }

    await this.prisma.patient.delete({ where: { id: existing.id } });
    return true;
  }

  private buildSearchWhere(
    organizationId: string,
    search: string,
    includeArchived: boolean,
  ): Prisma.PatientWhereInput {
    const base: Prisma.PatientWhereInput = {
      organizationId,
      ...(includeArchived ? {} : { archivedAt: null }),
    };
    const q = search.trim();
    if (!q) {
      return base;
    }

    const phoneCompact = q.replace(/\s+/g, '');

    return {
      ...base,
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        ...(phoneCompact !== q
          ? [{ phone: { contains: phoneCompact, mode: 'insensitive' as const } }]
          : []),
      ],
    };
  }
}
