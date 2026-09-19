import type { PatientMedia, PatientMediaStatus, Prisma, PrismaClient } from '@prisma/client';
import type { TenantScope } from '../patients/repository.js';
import type { CreateMediaInput, ListMediaQuery } from './schemas.js';

export class PatientMediaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createPending(
    scope: TenantScope,
    id: string,
    patientId: string,
    storageKey: string,
    data: CreateMediaInput,
  ): Promise<PatientMedia> {
    return this.prisma.patientMedia.create({
      data: {
        id,
        organizationId: scope.organizationId,
        patientId,
        storageKey,
        title: data.title,
        kind: data.kind,
        mime: data.mime,
        originalName: data.originalName,
        size: data.size,
        status: 'PENDING',
        updatedAt: new Date(),
      },
    });
  }

  async findById(scope: TenantScope, id: string): Promise<PatientMedia | null> {
    return this.prisma.patientMedia.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  async listForPatient(
    scope: TenantScope,
    patientId: string,
    query: ListMediaQuery,
  ): Promise<{ items: PatientMedia[]; total: number }> {
    const where: Prisma.PatientMediaWhereInput = {
      organizationId: scope.organizationId,
      patientId,
      ...(query.kind ? { kind: query.kind } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.patientMedia.count({ where }),
      this.prisma.patientMedia.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return { items, total };
  }

  /** Metadata-only org list — public DTO never includes object bytes. */
  async listForOrganization(
    scope: TenantScope,
    query: ListMediaQuery,
  ): Promise<{ items: PatientMedia[]; total: number }> {
    const where: Prisma.PatientMediaWhereInput = {
      organizationId: scope.organizationId,
      ...(query.kind ? { kind: query.kind } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.patientMedia.count({ where }),
      this.prisma.patientMedia.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return { items, total };
  }

  async setStatus(
    scope: TenantScope,
    id: string,
    status: PatientMediaStatus,
    size?: number,
  ): Promise<PatientMedia | null> {
    const existing = await this.findById(scope, id);
    if (!existing) return null;
    return this.prisma.patientMedia.update({
      where: { id: existing.id },
      data: {
        status,
        ...(size !== undefined ? { size } : {}),
        updatedAt: new Date(),
      },
    });
  }

  async delete(scope: TenantScope, id: string): Promise<PatientMedia | null> {
    const existing = await this.findById(scope, id);
    if (!existing) return null;
    await this.prisma.patientMedia.delete({ where: { id: existing.id } });
    return existing;
  }

  /** All media rows for a patient (for R2 purge before cascade delete). */
  async listAllForPatient(
    scope: TenantScope,
    patientId: string,
  ): Promise<PatientMedia[]> {
    return this.prisma.patientMedia.findMany({
      where: { organizationId: scope.organizationId, patientId },
    });
  }
}
