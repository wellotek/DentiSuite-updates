import type {
  Prescription,
  PrescriptionItem,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { parseCalendarDate } from '../appointments/schemas.js';
import type { TenantScope } from '../patients/repository.js';
import type {
  CreatePrescriptionInput,
  ListPrescriptionsQuery,
  PrescriptionLineInput,
  UpdatePrescriptionInput,
} from './schemas.js';

export type PrescriptionWithLines = Prescription & { lines: PrescriptionItem[] };

export class PrescriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    scope: TenantScope,
    id: string,
    patientId: string,
    patientName: string,
    data: CreatePrescriptionInput,
  ): Promise<PrescriptionWithLines> {
    return this.prisma.$transaction(async (tx) => {
      const rx = await tx.prescription.create({
        data: {
          id,
          organizationId: scope.organizationId,
          patientId,
          patientName,
          date: parseCalendarDate(data.date),
          title: data.title,
          templateId: data.templateId,
          advice: data.advice,
          dentistId: data.dentistId,
          dentistName: data.dentistName,
          updatedAt: new Date(),
        },
      });
      await this.replaceLines(tx, scope.organizationId, rx.id, data.lines);
      return tx.prescription.findFirstOrThrow({
        where: { id: rx.id, organizationId: scope.organizationId },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
    });
  }

  async findById(
    scope: TenantScope,
    id: string,
  ): Promise<PrescriptionWithLines | null> {
    return this.prisma.prescription.findFirst({
      where: { id, organizationId: scope.organizationId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async listForPatient(
    scope: TenantScope,
    patientId: string,
    query: ListPrescriptionsQuery,
  ): Promise<{ items: PrescriptionWithLines[]; total: number }> {
    const where: Prisma.PrescriptionWhereInput = {
      organizationId: scope.organizationId,
      patientId,
      ...(query.date ? { date: parseCalendarDate(query.date) } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { patientName: { contains: query.q, mode: 'insensitive' } },
              {
                lines: {
                  some: {
                    drug: { contains: query.q, mode: 'insensitive' },
                    organizationId: scope.organizationId,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.prescription.count({ where }),
      this.prisma.prescription.findMany({
        where,
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
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
    data: UpdatePrescriptionInput,
    patientName?: string,
  ): Promise<PrescriptionWithLines | null> {
    const existing = await this.findById(scope, id);
    if (!existing) return null;

    return this.prisma.$transaction(async (tx) => {
      await tx.prescription.update({
        where: { id: existing.id },
        data: {
          ...(data.date !== undefined
            ? { date: parseCalendarDate(data.date) }
            : {}),
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.templateId !== undefined
            ? { templateId: data.templateId }
            : {}),
          ...(data.advice !== undefined ? { advice: data.advice } : {}),
          ...(data.dentistId !== undefined ? { dentistId: data.dentistId } : {}),
          ...(data.dentistName !== undefined
            ? { dentistName: data.dentistName }
            : {}),
          ...(data.patientId !== undefined ? { patientId: data.patientId } : {}),
          ...(patientName !== undefined ? { patientName } : {}),
          updatedAt: new Date(),
        },
      });

      if (data.lines !== undefined) {
        await this.replaceLines(tx, scope.organizationId, existing.id, data.lines);
      }

      return tx.prescription.findFirstOrThrow({
        where: { id: existing.id, organizationId: scope.organizationId },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
    });
  }

  async delete(scope: TenantScope, id: string): Promise<boolean> {
    const existing = await this.findById(scope, id);
    if (!existing) return false;
    // Cascade deletes PrescriptionItem rows.
    await this.prisma.prescription.delete({ where: { id: existing.id } });
    return true;
  }

  private async replaceLines(
    tx: Prisma.TransactionClient,
    organizationId: string,
    prescriptionId: string,
    lines: PrescriptionLineInput[],
  ): Promise<void> {
    await tx.prescriptionItem.deleteMany({
      where: { prescriptionId, organizationId },
    });
    await tx.prescriptionItem.createMany({
      data: lines.map((line, index) => ({
        id: line.id ?? randomUUID(),
        organizationId,
        prescriptionId,
        drug: line.drug,
        posology: line.posology,
        duration: line.duration,
        notes: line.notes,
        sortOrder: index,
      })),
    });
  }
}
