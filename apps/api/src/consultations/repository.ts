import type { ClinicalSession, Prisma, PrismaClient, Treatment } from '@prisma/client';
import { parseCalendarDate } from '../appointments/schemas.js';
import type { TenantScope } from '../patients/repository.js';
import type {
  CreateConsultationInput,
  CreateTreatmentInput,
  ListConsultationsQuery,
  ListTreatmentsQuery,
  UpdateConsultationInput,
  UpdateTreatmentInput,
} from './schemas.js';

export class ClinicalSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    scope: TenantScope,
    id: string,
    patientId: string,
    data: CreateConsultationInput,
  ): Promise<ClinicalSession> {
    return this.prisma.clinicalSession.create({
      data: {
        id,
        organizationId: scope.organizationId,
        patientId,
        date: parseCalendarDate(data.date),
        time: data.time,
        teeth: data.teeth as Prisma.InputJsonValue,
        acts: data.acts,
        notes: data.notes,
        prescription: data.prescription,
        updatedAt: new Date(),
      },
    });
  }

  async findById(scope: TenantScope, id: string): Promise<ClinicalSession | null> {
    return this.prisma.clinicalSession.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  async listForPatient(
    scope: TenantScope,
    patientId: string,
    query: ListConsultationsQuery,
  ): Promise<{ items: ClinicalSession[]; total: number }> {
    const where: Prisma.ClinicalSessionWhereInput = {
      organizationId: scope.organizationId,
      patientId,
      ...(query.date ? { date: parseCalendarDate(query.date) } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.clinicalSession.count({ where }),
      this.prisma.clinicalSession.findMany({
        where,
        orderBy: [{ date: 'desc' }, { time: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return { items, total };
  }

  async update(
    scope: TenantScope,
    id: string,
    data: UpdateConsultationInput,
  ): Promise<ClinicalSession | null> {
    const existing = await this.findById(scope, id);
    if (!existing) return null;

    return this.prisma.clinicalSession.update({
      where: { id: existing.id },
      data: {
        ...(data.date !== undefined ? { date: parseCalendarDate(data.date) } : {}),
        ...(data.time !== undefined ? { time: data.time } : {}),
        ...(data.teeth !== undefined
          ? { teeth: data.teeth as Prisma.InputJsonValue }
          : {}),
        ...(data.acts !== undefined ? { acts: data.acts } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.prescription !== undefined
          ? { prescription: data.prescription }
          : {}),
        ...(data.patientId !== undefined ? { patientId: data.patientId } : {}),
        updatedAt: new Date(),
      },
    });
  }

  async delete(scope: TenantScope, id: string): Promise<boolean> {
    const existing = await this.findById(scope, id);
    if (!existing) return false;
    await this.prisma.clinicalSession.delete({ where: { id: existing.id } });
    return true;
  }
}

export class TreatmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    scope: TenantScope,
    id: string,
    patientId: string,
    data: CreateTreatmentInput,
  ): Promise<Treatment> {
    return this.prisma.treatment.create({
      data: {
        id,
        organizationId: scope.organizationId,
        patientId,
        date: parseCalendarDate(data.date),
        tooth: data.tooth,
        act: data.act,
        code: data.code,
        cost: data.cost,
        comment: data.comment,
        careStatus: data.careStatus,
        paymentStatus: data.paymentStatus,
        actId: data.actId,
        updatedAt: new Date(),
      },
    });
  }

  async findById(scope: TenantScope, id: string): Promise<Treatment | null> {
    return this.prisma.treatment.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  async listForPatient(
    scope: TenantScope,
    patientId: string,
    query: ListTreatmentsQuery,
  ): Promise<{ items: Treatment[]; total: number }> {
    const where: Prisma.TreatmentWhereInput = {
      organizationId: scope.organizationId,
      patientId,
      ...(query.date ? { date: parseCalendarDate(query.date) } : {}),
      ...(query.careStatus ? { careStatus: query.careStatus } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.treatment.count({ where }),
      this.prisma.treatment.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return { items, total };
  }

  async update(
    scope: TenantScope,
    id: string,
    data: UpdateTreatmentInput,
  ): Promise<Treatment | null> {
    const existing = await this.findById(scope, id);
    if (!existing) return null;

    return this.prisma.treatment.update({
      where: { id: existing.id },
      data: {
        ...(data.date !== undefined ? { date: parseCalendarDate(data.date) } : {}),
        ...(data.tooth !== undefined ? { tooth: data.tooth } : {}),
        ...(data.act !== undefined ? { act: data.act } : {}),
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.cost !== undefined ? { cost: data.cost } : {}),
        ...(data.comment !== undefined ? { comment: data.comment } : {}),
        ...(data.careStatus !== undefined ? { careStatus: data.careStatus } : {}),
        ...(data.paymentStatus !== undefined
          ? { paymentStatus: data.paymentStatus }
          : {}),
        ...(data.actId !== undefined ? { actId: data.actId } : {}),
        ...(data.patientId !== undefined ? { patientId: data.patientId } : {}),
        updatedAt: new Date(),
      },
    });
  }

  async delete(scope: TenantScope, id: string): Promise<boolean> {
    const existing = await this.findById(scope, id);
    if (!existing) return false;
    await this.prisma.treatment.delete({ where: { id: existing.id } });
    return true;
  }
}
