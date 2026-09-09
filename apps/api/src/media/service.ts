import type { PatientMedia, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import { PatientRepository, type TenantScope } from '../patients/repository.js';
import { PatientMediaRepository } from './repository.js';
import type { CreateMediaInput, ListMediaQuery } from './schemas.js';
import { MEDIA_MAX_BYTES } from './schemas.js';
import {
  assertTenantStorageKey,
  buildPatientMediaStorageKey,
  type ObjectStorage,
  type SignedUpload,
} from './storage.js';

export type PublicMedia = {
  id: string;
  organizationId: string;
  patientId: string;
  title: string;
  kind: string;
  mime: string;
  originalName: string;
  size: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export class PatientMediaService {
  private readonly media: PatientMediaRepository;
  private readonly patients: PatientRepository;

  constructor(
    prisma: PrismaClient,
    private readonly storage: ObjectStorage,
    private readonly logger: Logger,
    private readonly signedUrlTtlSeconds: number,
  ) {
    this.media = new PatientMediaRepository(prisma);
    this.patients = new PatientRepository(prisma);
  }

  private async requireTenantPatient(scope: TenantScope, patientId: string) {
    const patient = await this.patients.findById(scope, patientId);
    if (!patient) {
      throw new AppError(404, 'NOT_FOUND', 'Patient not found');
    }
    return patient;
  }

  toPublic(row: PatientMedia): PublicMedia {
    return {
      id: row.id,
      organizationId: row.organizationId,
      patientId: row.patientId,
      title: row.title,
      kind: row.kind,
      mime: row.mime,
      originalName: row.originalName,
      size: row.size,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createUpload(
    scope: TenantScope,
    patientId: string,
    input: CreateMediaInput,
  ): Promise<{ media: PublicMedia; upload: SignedUpload }> {
    await this.requireTenantPatient(scope, patientId);
    const id = randomUUID();
    const storageKey = buildPatientMediaStorageKey({
      organizationId: scope.organizationId,
      patientId,
      mediaId: id,
      ext: input.ext,
    });
    if (!assertTenantStorageKey(storageKey, scope.organizationId)) {
      throw new AppError(500, 'INTERNAL', 'Invalid storage key generation');
    }

    const row = await this.media.createPending(
      scope,
      id,
      patientId,
      storageKey,
      input,
    );
    const upload = await this.storage.createUploadUrl(storageKey, {
      contentType: input.mime,
      contentLength: input.size,
      expiresInSeconds: this.signedUrlTtlSeconds,
    });

    this.logger.info(
      {
        mediaEvent: 'media_upload_created',
        organizationId: scope.organizationId,
        mediaId: row.id,
        patientId,
        provider: this.storage.provider,
      },
      'Patient media upload initiated',
    );

    return { media: this.toPublic(row), upload };
  }

  async listForPatient(
    scope: TenantScope,
    patientId: string,
    query: ListMediaQuery,
  ) {
    await this.requireTenantPatient(scope, patientId);
    const { items, total } = await this.media.listForPatient(
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

  async get(scope: TenantScope, id: string): Promise<PublicMedia> {
    const row = await this.media.findById(scope, id);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Media not found');
    }
    return this.toPublic(row);
  }

  async getDownloadUrl(
    scope: TenantScope,
    id: string,
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    const row = await this.media.findById(scope, id);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Media not found');
    }
    if (row.status !== 'READY') {
      throw new AppError(409, 'MEDIA_NOT_READY', 'Media is not ready for download');
    }
    if (!assertTenantStorageKey(row.storageKey, scope.organizationId)) {
      throw new AppError(404, 'NOT_FOUND', 'Media not found');
    }
    const signed = await this.storage.createDownloadUrl(row.storageKey, {
      expiresInSeconds: this.signedUrlTtlSeconds,
      filename: row.originalName,
    });
    return {
      downloadUrl: signed.downloadUrl,
      expiresAt: signed.expiresAt.toISOString(),
    };
  }

  async complete(scope: TenantScope, id: string): Promise<PublicMedia> {
    const row = await this.media.findById(scope, id);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Media not found');
    }
    if (row.status === 'READY') {
      return this.toPublic(row);
    }
    if (!assertTenantStorageKey(row.storageKey, scope.organizationId)) {
      await this.media.setStatus(scope, id, 'FAILED');
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid storage key');
    }

    const head = await this.storage.headObject(row.storageKey);
    if (!head.exists) {
      await this.media.setStatus(scope, id, 'FAILED');
      throw new AppError(400, 'MEDIA_OBJECT_MISSING', 'Uploaded object not found');
    }
    if (head.size === undefined) {
      await this.media.setStatus(scope, id, 'FAILED');
      throw new AppError(400, 'MEDIA_OBJECT_INVALID', 'Object size unavailable');
    }
    if (head.size > MEDIA_MAX_BYTES) {
      await this.media.setStatus(scope, id, 'FAILED');
      throw new AppError(400, 'MEDIA_TOO_LARGE', 'Object exceeds size limit');
    }
    if (head.size !== row.size) {
      await this.media.setStatus(scope, id, 'FAILED');
      throw new AppError(400, 'MEDIA_SIZE_MISMATCH', 'Object size does not match declared size');
    }

    const updated = await this.media.setStatus(scope, id, 'READY', head.size);
    if (!updated) {
      throw new AppError(404, 'NOT_FOUND', 'Media not found');
    }
    this.logger.info(
      {
        mediaEvent: 'media_ready',
        organizationId: scope.organizationId,
        mediaId: id,
      },
      'Patient media marked READY',
    );
    return this.toPublic(updated);
  }

  async delete(scope: TenantScope, id: string): Promise<void> {
    const row = await this.media.delete(scope, id);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Media not found');
    }
    try {
      if (assertTenantStorageKey(row.storageKey, scope.organizationId)) {
        await this.storage.deleteObject(row.storageKey);
      }
    } catch (error) {
      this.logger.warn(
        {
          mediaEvent: 'media_object_delete_failed',
          organizationId: scope.organizationId,
          mediaId: id,
          err: {
            name: error instanceof Error ? error.name : 'Error',
            message: error instanceof Error ? error.message : String(error),
          },
        },
        'Failed to delete media object (metadata already removed)',
      );
    }
    this.logger.info(
      {
        mediaEvent: 'media_deleted',
        organizationId: scope.organizationId,
        mediaId: id,
      },
      'Patient media deleted',
    );
  }

  /**
   * Delete R2/object-store bytes for a patient before DB cascade delete.
   * Best-effort: failures are logged; patient delete still proceeds.
   */
  async purgeObjectsForPatient(scope: TenantScope, patientId: string): Promise<number> {
    const rows = await this.media.listAllForPatient(scope, patientId);
    let purged = 0;
    for (const row of rows) {
      try {
        if (assertTenantStorageKey(row.storageKey, scope.organizationId)) {
          await this.storage.deleteObject(row.storageKey);
          purged += 1;
        }
      } catch (error) {
        this.logger.warn(
          {
            mediaEvent: 'patient_media_purge_failed',
            organizationId: scope.organizationId,
            patientId,
            mediaId: row.id,
            err: {
              name: error instanceof Error ? error.name : 'Error',
              message: error instanceof Error ? error.message : String(error),
            },
          },
          'Failed to purge media object before patient delete',
        );
      }
    }
    if (rows.length > 0) {
      this.logger.info(
        {
          mediaEvent: 'patient_media_purged',
          organizationId: scope.organizationId,
          patientId,
          count: purged,
          total: rows.length,
        },
        'Purged patient media objects before delete',
      );
    }
    return purged;
  }
}
