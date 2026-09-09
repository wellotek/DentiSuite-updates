import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { formatCalendarDate } from '../appointments/schemas.js';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import { PatientRepository, type TenantScope } from '../patients/repository.js';
import {
  PrescriptionRepository,
  type PrescriptionWithLines,
} from './repository.js';
import type {
  CreatePrescriptionInput,
  ListPrescriptionsQuery,
  UpdatePrescriptionInput,
} from './schemas.js';

export type PublicPrescriptionLine = {
  id: string;
  drug: string;
  posology: string;
  duration: string;
  notes: string;
};

export type PublicPrescription = {
  id: string;
  organizationId: string;
  patientId: string;
  patientName: string;
  date: string;
  title: string;
  templateId: string | null;
  advice: string;
  dentistId: string | null;
  dentistName: string;
  lines: PublicPrescriptionLine[];
  createdAt: string;
  updatedAt: string;
};

export class PrescriptionService {
  private readonly prescriptions: PrescriptionRepository;
  private readonly patients: PatientRepository;

  constructor(
    prisma: PrismaClient,
    private readonly logger: Logger,
  ) {
    this.prescriptions = new PrescriptionRepository(prisma);
    this.patients = new PatientRepository(prisma);
  }

  private async requireTenantPatient(scope: TenantScope, patientId: string) {
    const patient = await this.patients.findById(scope, patientId);
    if (!patient) {
      throw new AppError(404, 'NOT_FOUND', 'Patient not found');
    }
    return patient;
  }

  toPublic(row: PrescriptionWithLines): PublicPrescription {
    return {
      id: row.id,
      organizationId: row.organizationId,
      patientId: row.patientId,
      patientName: row.patientName,
      date: formatCalendarDate(row.date),
      title: row.title,
      templateId: row.templateId,
      advice: row.advice,
      dentistId: row.dentistId,
      dentistName: row.dentistName,
      lines: row.lines.map((line) => ({
        id: line.id,
        drug: line.drug,
        posology: line.posology,
        duration: line.duration,
        notes: line.notes,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(
    scope: TenantScope,
    patientId: string,
    input: CreatePrescriptionInput,
  ): Promise<PublicPrescription> {
    const patient = await this.requireTenantPatient(scope, patientId);
    const patientName = `${patient.firstName} ${patient.lastName}`.trim();
    const row = await this.prescriptions.create(
      scope,
      randomUUID(),
      patientId,
      patientName,
      input,
    );
    this.logger.info(
      {
        clinicalEvent: 'prescription_created',
        organizationId: scope.organizationId,
        prescriptionId: row.id,
        patientId,
      },
      'Prescription created',
    );
    return this.toPublic(row);
  }

  async listForPatient(
    scope: TenantScope,
    patientId: string,
    query: ListPrescriptionsQuery,
  ) {
    await this.requireTenantPatient(scope, patientId);
    const { items, total } = await this.prescriptions.listForPatient(
      scope,
      patientId,
      query,
    );
    return {
      items: items.map((i) => this.toPublic(i)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit) || 1),
    };
  }

  async get(scope: TenantScope, id: string): Promise<PublicPrescription> {
    const row = await this.prescriptions.findById(scope, id);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Prescription not found');
    }
    return this.toPublic(row);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdatePrescriptionInput,
  ): Promise<PublicPrescription> {
    let patientName: string | undefined;
    if (input.patientId !== undefined) {
      const patient = await this.requireTenantPatient(scope, input.patientId);
      patientName = `${patient.firstName} ${patient.lastName}`.trim();
    }
    const row = await this.prescriptions.update(scope, id, input, patientName);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Prescription not found');
    }
    this.logger.info(
      {
        clinicalEvent: 'prescription_updated',
        organizationId: scope.organizationId,
        prescriptionId: row.id,
      },
      'Prescription updated',
    );
    return this.toPublic(row);
  }

  async delete(scope: TenantScope, id: string): Promise<void> {
    const deleted = await this.prescriptions.delete(scope, id);
    if (!deleted) {
      throw new AppError(404, 'NOT_FOUND', 'Prescription not found');
    }
    this.logger.info(
      {
        clinicalEvent: 'prescription_deleted',
        organizationId: scope.organizationId,
        prescriptionId: id,
      },
      'Prescription deleted',
    );
  }
}
