import type { Dentist, Prisma, PrismaClient } from '@prisma/client';
import type { TenantScope } from '../patients/repository.js';
import type {
  CreateDentistInput,
  ListDentistsQuery,
  UpdateDentistInput,
} from './schemas.js';

export class DentistRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    scope: TenantScope,
    id: string,
    data: CreateDentistInput,
  ): Promise<Dentist> {
    return this.prisma.dentist.create({
      data: {
        id,
        organizationId: scope.organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        specialty: data.specialty,
        photo: data.photo,
        color: data.color,
        updatedAt: new Date(),
      },
    });
  }

  async findById(scope: TenantScope, id: string): Promise<Dentist | null> {
    return this.prisma.dentist.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  async list(
    scope: TenantScope,
    query: ListDentistsQuery,
  ): Promise<{ items: Dentist[]; total: number }> {
    const where: Prisma.DentistWhereInput = {
      organizationId: scope.organizationId,
      ...(query.specialty
        ? { specialty: { equals: query.specialty, mode: 'insensitive' } }
        : {}),
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
              { specialty: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.dentist.count({ where }),
      this.prisma.dentist.findMany({
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
    data: UpdateDentistInput,
  ): Promise<Dentist | null> {
    const existing = await this.findById(scope, id);
    if (!existing) return null;

    return this.prisma.dentist.update({
      where: { id: existing.id },
      data: {
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.specialty !== undefined ? { specialty: data.specialty } : {}),
        ...(data.photo !== undefined ? { photo: data.photo } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Hard-delete dentist and clear opaque assignments on Patient / Appointment
   * (matches local deleteDentist). Prescription opaque refs are left unchanged.
   */
  async delete(scope: TenantScope, id: string): Promise<boolean> {
    const existing = await this.findById(scope, id);
    if (!existing) return false;

    await this.prisma.$transaction([
      this.prisma.patient.updateMany({
        where: {
          organizationId: scope.organizationId,
          dentistId: id,
        },
        data: { dentistId: null },
      }),
      this.prisma.appointment.updateMany({
        where: {
          organizationId: scope.organizationId,
          dentistId: id,
        },
        data: { dentistId: null, practitioner: '' },
      }),
      this.prisma.dentist.delete({ where: { id: existing.id } }),
    ]);

    return true;
  }
}
