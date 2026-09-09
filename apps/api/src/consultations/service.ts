import type { ClinicalSession, PrismaClient, Treatment } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { formatCalendarDate } from '../appointments/schemas.js';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import { PatientRepository, type TenantScope } from '../patients/repository.js';
import {
  ClinicalSessionRepository,
  TreatmentRepository,
} from './repository.js';
import type {
  CreateConsultationInput,
  CreateTreatmentInput,
  ListConsultationsQuery,
  ListTreatmentsQuery,
  UpdateConsultationInput,
  UpdateTreatmentInput,
} from './schemas.js';

export type PublicConsultation = {
  id: string;
  organizationId: string;
  patientId: string;
  date: string;
  time: string;
  teeth: string[];
  acts: string;
  notes: string;
  prescription: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicTreatment = {
  id: string;
  organizationId: string;
  patientId: string;
  date: string;
  tooth: string;
  act: string;
  code: string;
  cost: number;
  comment: string;
  careStatus: string;
  paymentStatus: string;
  actId: string | null;
  createdAt: string;
  updatedAt: string;
};

export class ClinicalCareService {
  private readonly sessions: ClinicalSessionRepository;
  private readonly treatments: TreatmentRepository;
  private readonly patients: PatientRepository;

  constructor(
    prisma: PrismaClient,
    private readonly logger: Logger,
  ) {
    this.sessions = new ClinicalSessionRepository(prisma);
    this.treatments = new TreatmentRepository(prisma);
    this.patients = new PatientRepository(prisma);
  }

  private async requireTenantPatient(scope: TenantScope, patientId: string) {
    const patient = await this.patients.findById(scope, patientId);
    if (!patient) {
      throw new AppError(404, 'NOT_FOUND', 'Patient not found');
    }
    return patient;
  }

  toPublicConsultation(row: ClinicalSession): PublicConsultation {
    const teeth = Array.isArray(row.teeth)
      ? (row.teeth as unknown[]).filter((t): t is string => typeof t === 'string')
      : [];
    return {
      id: row.id,
      organizationId: row.organizationId,
      patientId: row.patientId,
      date: formatCalendarDate(row.date),
      time: row.time,
      teeth,
      acts: row.acts,
      notes: row.notes,
      prescription: row.prescription,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  toPublicTreatment(row: Treatment): PublicTreatment {
    return {
      id: row.id,
      organizationId: row.organizationId,
      patientId: row.patientId,
      date: formatCalendarDate(row.date),
      tooth: row.tooth,
      act: row.act,
      code: row.code,
      cost: row.cost,
      comment: row.comment,
      careStatus: row.careStatus,
      paymentStatus: row.paymentStatus,
      actId: row.actId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createConsultation(
    scope: TenantScope,
    patientId: string,
    input: CreateConsultationInput,
  ): Promise<PublicConsultation> {
    await this.requireTenantPatient(scope, patientId);
    const row = await this.sessions.create(scope, randomUUID(), patientId, input);
    this.logger.info(
      {
        clinicalEvent: 'consultation_created',
        organizationId: scope.organizationId,
        consultationId: row.id,
        patientId,
      },
      'Clinical session created',
    );
    return this.toPublicConsultation(row);
  }

  async listConsultations(
    scope: TenantScope,
    patientId: string,
    query: ListConsultationsQuery,
  ) {
    await this.requireTenantPatient(scope, patientId);
    const { items, total } = await this.sessions.listForPatient(
      scope,
      patientId,
      query,
    );
    return {
      items: items.map((i) => this.toPublicConsultation(i)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit) || 1),
    };
  }

  async getConsultation(scope: TenantScope, id: string): Promise<PublicConsultation> {
    const row = await this.sessions.findById(scope, id);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Consultation not found');
    }
    return this.toPublicConsultation(row);
  }

  async updateConsultation(
    scope: TenantScope,
    id: string,
    input: UpdateConsultationInput,
  ): Promise<PublicConsultation> {
    if (input.patientId !== undefined) {
      await this.requireTenantPatient(scope, input.patientId);
    }
    const row = await this.sessions.update(scope, id, input);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Consultation not found');
    }
    this.logger.info(
      {
        clinicalEvent: 'consultation_updated',
        organizationId: scope.organizationId,
        consultationId: row.id,
      },
      'Clinical session updated',
    );
    return this.toPublicConsultation(row);
  }

  async deleteConsultation(scope: TenantScope, id: string): Promise<void> {
    const deleted = await this.sessions.delete(scope, id);
    if (!deleted) {
      throw new AppError(404, 'NOT_FOUND', 'Consultation not found');
    }
    this.logger.info(
      {
        clinicalEvent: 'consultation_deleted',
        organizationId: scope.organizationId,
        consultationId: id,
      },
      'Clinical session deleted',
    );
  }

  async createTreatment(
    scope: TenantScope,
    patientId: string,
    input: CreateTreatmentInput,
  ): Promise<PublicTreatment> {
    await this.requireTenantPatient(scope, patientId);
    const row = await this.treatments.create(scope, randomUUID(), patientId, input);
    this.logger.info(
      {
        clinicalEvent: 'treatment_created',
        organizationId: scope.organizationId,
        treatmentId: row.id,
        patientId,
      },
      'Treatment created',
    );
    return this.toPublicTreatment(row);
  }

  async listTreatments(
    scope: TenantScope,
    patientId: string,
    query: ListTreatmentsQuery,
  ) {
    await this.requireTenantPatient(scope, patientId);
    const { items, total } = await this.treatments.listForPatient(
      scope,
      patientId,
      query,
    );
    return {
      items: items.map((i) => this.toPublicTreatment(i)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit) || 1),
    };
  }

  async getTreatment(scope: TenantScope, id: string): Promise<PublicTreatment> {
    const row = await this.treatments.findById(scope, id);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Treatment not found');
    }
    return this.toPublicTreatment(row);
  }

  async updateTreatment(
    scope: TenantScope,
    id: string,
    input: UpdateTreatmentInput,
  ): Promise<PublicTreatment> {
    if (input.patientId !== undefined) {
      await this.requireTenantPatient(scope, input.patientId);
    }
    const row = await this.treatments.update(scope, id, input);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Treatment not found');
    }
    this.logger.info(
      {
        clinicalEvent: 'treatment_updated',
        organizationId: scope.organizationId,
        treatmentId: row.id,
      },
      'Treatment updated',
    );
    return this.toPublicTreatment(row);
  }

  async deleteTreatment(scope: TenantScope, id: string): Promise<void> {
    const deleted = await this.treatments.delete(scope, id);
    if (!deleted) {
      throw new AppError(404, 'NOT_FOUND', 'Treatment not found');
    }
    this.logger.info(
      {
        clinicalEvent: 'treatment_deleted',
        organizationId: scope.organizationId,
        treatmentId: id,
      },
      'Treatment deleted',
    );
  }
}
