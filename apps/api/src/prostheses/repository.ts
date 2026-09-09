import type { Prisma, PrismaClient, Prosthesis } from '@prisma/client';
import { parseCalendarDate } from '../appointments/schemas.js';
import type { TenantScope } from '../patients/repository.js';
import type {
  CreateProsthesisInput,
  ListProsthesesQuery,
  UpdateProsthesisInput,
} from './schemas.js';

export class ProsthesisRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    scope: TenantScope,
    id: string,
    patientId: string,
    patientName: string,
    data: CreateProsthesisInput,
  ): Promise<Prosthesis> {
    return this.prisma.prosthesis.create({
      data: {
        id,
        organizationId: scope.organizationId,
        patientId,
        patientName,
        type: data.type,
        tooth: data.tooth,
        lab: data.lab,
        sentAt: parseCalendarDate(data.sentAt),
        expectedAt: data.expectedAt ? parseCalendarDate(data.expectedAt) : null,
        notes: data.notes,
        status: data.status,
        updatedAt: new Date(),
      },
    });
  }

  async findById(scope: TenantScope, id: string): Promise<Prosthesis | null> {
    return this.prisma.prosthesis.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  async list(
    scope: TenantScope,
    query: ListProsthesesQuery,
  ): Promise<{ items: Prosthesis[]; total: number }> {
    const where: Prisma.ProsthesisWhereInput = {
      organizationId: scope.organizationId,
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { type: { contains: query.q, mode: 'insensitive' } },
              { lab: { contains: query.q, mode: 'insensitive' } },
              { patientName: { contains: query.q, mode: 'insensitive' } },
              { tooth: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.prosthesis.count({ where }),
      this.prisma.prosthesis.findMany({
        where,
        orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return { items, total };
  }

  async update(
    scope: TenantScope,
    id: string,
    data: UpdateProsthesisInput,
    patientName?: string,
  ): Promise<Prosthesis | null> {
    const existing = await this.findById(scope, id);
    if (!existing) return null;
    return this.prisma.prosthesis.update({
      where: { id: existing.id },
      data: {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.tooth !== undefined ? { tooth: data.tooth } : {}),
        ...(data.lab !== undefined ? { lab: data.lab } : {}),
        ...(data.sentAt !== undefined
          ? { sentAt: parseCalendarDate(data.sentAt) }
          : {}),
        ...(data.expectedAt !== undefined
          ? {
              expectedAt: data.expectedAt
                ? parseCalendarDate(data.expectedAt)
                : null,
            }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.patientId !== undefined ? { patientId: data.patientId } : {}),
        ...(patientName !== undefined ? { patientName } : {}),
        updatedAt: new Date(),
      },
    });
  }

  async delete(scope: TenantScope, id: string): Promise<boolean> {
    const existing = await this.findById(scope, id);
    if (!existing) return false;
    await this.prisma.prosthesis.delete({ where: { id: existing.id } });
    return true;
  }
}
