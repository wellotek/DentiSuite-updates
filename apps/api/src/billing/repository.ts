import type { Invoice, Prisma, PrismaClient } from '@prisma/client';
import { parseCalendarDate } from '../appointments/schemas.js';
import type { TenantScope } from '../patients/repository.js';
import type {
  CreateInvoiceInput,
  ListInvoicesQuery,
  UpdateInvoiceInput,
} from './schemas.js';

export class InvoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    scope: TenantScope,
    id: string,
    patientId: string,
    patientName: string,
    data: CreateInvoiceInput,
  ): Promise<Invoice> {
    return this.prisma.invoice.create({
      data: {
        id,
        organizationId: scope.organizationId,
        patientId,
        patientName,
        label: data.label,
        amount: data.amount,
        paid: data.paid,
        date: parseCalendarDate(data.date),
        treatmentId: data.treatmentId,
        updatedAt: new Date(),
      },
    });
  }

  async findById(scope: TenantScope, id: string): Promise<Invoice | null> {
    return this.prisma.invoice.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  async list(
    scope: TenantScope,
    query: ListInvoicesQuery,
  ): Promise<{ items: Invoice[]; total: number }> {
    const where: Prisma.InvoiceWhereInput = {
      organizationId: scope.organizationId,
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.paid !== undefined ? { paid: query.paid } : {}),
      ...(query.date
        ? { date: parseCalendarDate(query.date) }
        : query.from || query.to
          ? {
              date: {
                ...(query.from ? { gte: parseCalendarDate(query.from) } : {}),
                ...(query.to ? { lte: parseCalendarDate(query.to) } : {}),
              },
            }
          : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
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
    data: UpdateInvoiceInput,
    patientName?: string,
  ): Promise<Invoice | null> {
    const existing = await this.findById(scope, id);
    if (!existing) return null;

    return this.prisma.invoice.update({
      where: { id: existing.id },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.paid !== undefined ? { paid: data.paid } : {}),
        ...(data.date !== undefined
          ? { date: parseCalendarDate(data.date) }
          : {}),
        ...(data.treatmentId !== undefined
          ? { treatmentId: data.treatmentId }
          : {}),
        ...(data.patientId !== undefined ? { patientId: data.patientId } : {}),
        ...(patientName !== undefined ? { patientName } : {}),
        updatedAt: new Date(),
      },
    });
  }

  async delete(scope: TenantScope, id: string): Promise<boolean> {
    const existing = await this.findById(scope, id);
    if (!existing) return false;
    await this.prisma.invoice.delete({ where: { id: existing.id } });
    return true;
  }
}
