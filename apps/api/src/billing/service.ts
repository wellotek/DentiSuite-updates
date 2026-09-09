import type { Invoice, PrismaClient, Treatment } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { formatCalendarDate } from '../appointments/schemas.js';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import { PatientRepository, type TenantScope } from '../patients/repository.js';
import { InvoiceRepository } from './repository.js';
import type {
  CreateInvoiceInput,
  ListInvoicesQuery,
  UpdateInvoiceInput,
} from './schemas.js';

export type PublicInvoice = {
  id: string;
  organizationId: string;
  patientId: string;
  patientName: string;
  label: string;
  amount: number;
  currency: 'DA';
  paid: boolean;
  date: string;
  treatmentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export class BillingService {
  private readonly invoices: InvoiceRepository;
  private readonly patients: PatientRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {
    this.invoices = new InvoiceRepository(prisma);
    this.patients = new PatientRepository(prisma);
  }

  private async requireTenantPatient(scope: TenantScope, patientId: string) {
    const patient = await this.patients.findById(scope, patientId);
    if (!patient) {
      throw new AppError(404, 'NOT_FOUND', 'Patient not found');
    }
    return patient;
  }

  private async requireTenantTreatment(
    scope: TenantScope,
    treatmentId: string,
    patientId: string,
  ): Promise<Treatment> {
    const treatment = await this.prisma.treatment.findFirst({
      where: {
        id: treatmentId,
        organizationId: scope.organizationId,
      },
    });
    if (!treatment) {
      throw new AppError(404, 'NOT_FOUND', 'Treatment not found');
    }
    if (treatment.patientId !== patientId) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Treatment does not belong to the invoice patient',
      );
    }
    return treatment;
  }

  toPublic(row: Invoice): PublicInvoice {
    return {
      id: row.id,
      organizationId: row.organizationId,
      patientId: row.patientId,
      patientName: row.patientName,
      label: row.label,
      amount: row.amount,
      currency: 'DA',
      paid: row.paid,
      date: formatCalendarDate(row.date),
      treatmentId: row.treatmentId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createForPatient(
    scope: TenantScope,
    patientId: string,
    input: CreateInvoiceInput,
  ): Promise<PublicInvoice> {
    const patient = await this.requireTenantPatient(scope, patientId);
    if (input.treatmentId) {
      await this.requireTenantTreatment(scope, input.treatmentId, patientId);
    }
    const patientName = `${patient.firstName} ${patient.lastName}`.trim();
    const row = await this.invoices.create(
      scope,
      randomUUID(),
      patientId,
      patientName,
      input,
    );
    this.logger.info(
      {
        billingEvent: 'invoice_created',
        organizationId: scope.organizationId,
        invoiceId: row.id,
        patientId,
      },
      'Invoice created',
    );
    return this.toPublic(row);
  }

  async list(scope: TenantScope, query: ListInvoicesQuery) {
    if (query.patientId) {
      await this.requireTenantPatient(scope, query.patientId);
    }
    const { items, total } = await this.invoices.list(scope, query);
    return {
      items: items.map((i) => this.toPublic(i)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit) || 1),
    };
  }

  async listForPatient(
    scope: TenantScope,
    patientId: string,
    query: ListInvoicesQuery,
  ) {
    await this.requireTenantPatient(scope, patientId);
    return this.list(scope, { ...query, patientId });
  }

  async get(scope: TenantScope, id: string): Promise<PublicInvoice> {
    const row = await this.invoices.findById(scope, id);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
    }
    return this.toPublic(row);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdateInvoiceInput,
  ): Promise<PublicInvoice> {
    const existing = await this.invoices.findById(scope, id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
    }

    let patientName: string | undefined;
    const patientId = input.patientId ?? existing.patientId;

    if (input.patientId !== undefined) {
      const patient = await this.requireTenantPatient(scope, input.patientId);
      patientName = `${patient.firstName} ${patient.lastName}`.trim();
    }

    if (input.treatmentId) {
      await this.requireTenantTreatment(scope, input.treatmentId, patientId);
    }

    const row = await this.invoices.update(scope, id, input, patientName);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
    }
    this.logger.info(
      {
        billingEvent: 'invoice_updated',
        organizationId: scope.organizationId,
        invoiceId: row.id,
      },
      'Invoice updated',
    );
    return this.toPublic(row);
  }

  async delete(scope: TenantScope, id: string): Promise<void> {
    const deleted = await this.invoices.delete(scope, id);
    if (!deleted) {
      throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
    }
    this.logger.info(
      {
        billingEvent: 'invoice_deleted',
        organizationId: scope.organizationId,
        invoiceId: id,
      },
      'Invoice deleted',
    );
  }
}
