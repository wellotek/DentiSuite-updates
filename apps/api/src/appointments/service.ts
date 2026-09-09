import type { Appointment, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import { PatientRepository, type TenantScope } from '../patients/repository.js';
import { AppointmentRepository, formatCalendarDate } from './repository.js';
import type {
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from './schemas.js';

export type PublicAppointment = {
  id: string;
  organizationId: string;
  patientId: string;
  date: string;
  time: string;
  durationMin: number;
  patientName: string;
  patientPhone: string;
  motif: string;
  practitioner: string;
  dentistId: string | null;
  status: string;
  category: string;
  createdAt: string;
  updatedAt: string;
};

export class AppointmentService {
  private readonly appointments: AppointmentRepository;
  private readonly patients: PatientRepository;

  constructor(
    prisma: PrismaClient,
    private readonly logger: Logger,
  ) {
    this.appointments = new AppointmentRepository(prisma);
    this.patients = new PatientRepository(prisma);
  }

  toPublic(row: Appointment): PublicAppointment {
    return {
      id: row.id,
      organizationId: row.organizationId,
      patientId: row.patientId,
      date: formatCalendarDate(row.date),
      time: row.time,
      durationMin: row.durationMin,
      patientName: row.patientName,
      patientPhone: row.patientPhone,
      motif: row.motif,
      practitioner: row.practitioner,
      dentistId: row.dentistId,
      status: row.status,
      category: row.category,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Tenant-scoped patient lookup. Never use patientId alone.
   */
  private async requireTenantPatient(scope: TenantScope, patientId: string) {
    const patient = await this.patients.findById(scope, patientId);
    if (!patient) {
      throw new AppError(404, 'NOT_FOUND', 'Patient not found');
    }
    return patient;
  }

  async create(
    scope: TenantScope,
    input: CreateAppointmentInput,
  ): Promise<PublicAppointment> {
    const patient = await this.requireTenantPatient(scope, input.patientId);
    const patientName = `${patient.firstName} ${patient.lastName}`.trim();
    const row = await this.appointments.create(scope, randomUUID(), {
      ...input,
      patientName,
      patientPhone: patient.phone,
    });
    this.logger.info(
      {
        clinicalEvent: 'appointment_created',
        organizationId: scope.organizationId,
        appointmentId: row.id,
        patientId: row.patientId,
      },
      'Appointment created',
    );
    return this.toPublic(row);
  }

  async list(scope: TenantScope, query: ListAppointmentsQuery) {
    // If filtering by patientId, ensure that patient is in-tenant (no leak via empty other-tenant results vs noise).
    if (query.patientId) {
      await this.requireTenantPatient(scope, query.patientId);
    }

    const { items, total } = await this.appointments.list(scope, query);
    return {
      items: items.map((item) => this.toPublic(item)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit) || 1),
    };
  }

  async getById(scope: TenantScope, id: string): Promise<PublicAppointment> {
    const row = await this.appointments.findById(scope, id);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Appointment not found');
    }
    return this.toPublic(row);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdateAppointmentInput,
  ): Promise<PublicAppointment> {
    let patientName: string | undefined;
    let patientPhone: string | undefined;

    if (input.patientId !== undefined) {
      const patient = await this.requireTenantPatient(scope, input.patientId);
      patientName = `${patient.firstName} ${patient.lastName}`.trim();
      patientPhone = patient.phone;
    }

    const row = await this.appointments.update(scope, id, {
      ...input,
      ...(patientName !== undefined ? { patientName } : {}),
      ...(patientPhone !== undefined ? { patientPhone } : {}),
    });
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Appointment not found');
    }

    this.logger.info(
      {
        clinicalEvent: 'appointment_updated',
        organizationId: scope.organizationId,
        appointmentId: row.id,
      },
      'Appointment updated',
    );
    return this.toPublic(row);
  }

  async delete(scope: TenantScope, id: string): Promise<void> {
    const deleted = await this.appointments.delete(scope, id);
    if (!deleted) {
      throw new AppError(404, 'NOT_FOUND', 'Appointment not found');
    }
    this.logger.info(
      {
        clinicalEvent: 'appointment_deleted',
        organizationId: scope.organizationId,
        appointmentId: id,
      },
      'Appointment deleted',
    );
  }
}
