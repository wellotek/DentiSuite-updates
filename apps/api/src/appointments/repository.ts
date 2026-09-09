import type { Appointment, Prisma, PrismaClient } from '@prisma/client';
import type { TenantScope } from '../patients/repository.js';
import {
  formatCalendarDate,
  parseCalendarDate,
  type CreateAppointmentInput,
  type ListAppointmentsQuery,
  type UpdateAppointmentInput,
} from './schemas.js';

export class AppointmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    scope: TenantScope,
    id: string,
    data: CreateAppointmentInput & { patientName: string; patientPhone: string },
  ): Promise<Appointment> {
    return this.prisma.appointment.create({
      data: {
        id,
        organizationId: scope.organizationId,
        patientId: data.patientId,
        date: parseCalendarDate(data.date),
        time: data.time,
        durationMin: data.durationMin,
        patientName: data.patientName,
        patientPhone: data.patientPhone,
        motif: data.motif,
        practitioner: data.practitioner,
        dentistId: data.dentistId,
        status: data.status,
        category: data.category,
        updatedAt: new Date(),
      },
    });
  }

  async findById(scope: TenantScope, id: string): Promise<Appointment | null> {
    return this.prisma.appointment.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  async list(
    scope: TenantScope,
    query: ListAppointmentsQuery,
  ): Promise<{ items: Appointment[]; total: number }> {
    const where = this.buildWhere(scope.organizationId, query);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where,
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return { items, total };
  }

  async update(
    scope: TenantScope,
    id: string,
    data: UpdateAppointmentInput & {
      patientName?: string;
      patientPhone?: string;
    },
  ): Promise<Appointment | null> {
    const existing = await this.findById(scope, id);
    if (!existing) {
      return null;
    }

    return this.prisma.appointment.update({
      where: { id: existing.id },
      data: {
        ...(data.date !== undefined ? { date: parseCalendarDate(data.date) } : {}),
        ...(data.time !== undefined ? { time: data.time } : {}),
        ...(data.durationMin !== undefined ? { durationMin: data.durationMin } : {}),
        ...(data.patientId !== undefined ? { patientId: data.patientId } : {}),
        ...(data.patientName !== undefined ? { patientName: data.patientName } : {}),
        ...(data.patientPhone !== undefined ? { patientPhone: data.patientPhone } : {}),
        ...(data.motif !== undefined ? { motif: data.motif } : {}),
        ...(data.practitioner !== undefined ? { practitioner: data.practitioner } : {}),
        ...(data.dentistId !== undefined ? { dentistId: data.dentistId } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        updatedAt: new Date(),
      },
    });
  }

  async delete(scope: TenantScope, id: string): Promise<boolean> {
    const existing = await this.findById(scope, id);
    if (!existing) {
      return false;
    }
    await this.prisma.appointment.delete({ where: { id: existing.id } });
    return true;
  }

  private buildWhere(
    organizationId: string,
    query: ListAppointmentsQuery,
  ): Prisma.AppointmentWhereInput {
    const where: Prisma.AppointmentWhereInput = { organizationId };

    if (query.date) {
      where.date = parseCalendarDate(query.date);
    } else if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: parseCalendarDate(query.from) } : {}),
        ...(query.to ? { lte: parseCalendarDate(query.to) } : {}),
      };
    }

    if (query.patientId) {
      where.patientId = query.patientId;
    }
    if (query.dentistId) {
      where.dentistId = query.dentistId;
    }
    if (query.status) {
      where.status = query.status;
    }

    return where;
  }
}

export { formatCalendarDate };
