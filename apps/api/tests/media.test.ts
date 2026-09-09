import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEDIA_MAX_BYTES } from '../src/media/schemas.js';
import {
  assertTenantStorageKey,
  buildPatientMediaStorageKey,
} from '../src/media/storage.js';
import {
  authHeader,
  createTestApp,
  registerLogin,
  resetAuthTables,
  startTestDatabase,
  stopTestDatabase,
} from './helpers/test-db.js';

const password = 'SecurePass1!';

const samplePatient = {
  firstName: 'Sophie',
  lastName: 'Martin',
  phone: '06 12 34 56 78',
  age: 34,
  address: '12 rue des Lilas',
  antecedents: 'Aucun',
  hasAllergies: false,
};

const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('patient media cloud API (Phase 5F)', () => {
  let prisma: Awaited<ReturnType<typeof startTestDatabase>>['prisma'];

  beforeAll(async () => {
    ({ prisma } = await startTestDatabase());
  }, 120_000);

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await resetAuthTables(prisma);
  });

  async function bootstrapOrg(email: string) {
    const { app, permissionService, objectStorage } = createTestApp(prisma);
    const user = await registerLogin(app, email, password);
    const created = await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${email} Cabinet` }),
    });
    const body = (await created.json()) as {
      organization: { id: string };
      membership: { id: string };
    };
    return { app, permissionService, objectStorage, user, ...body };
  }

  async function createPatient(
    app: ReturnType<typeof createTestApp>['app'],
    token: string,
  ) {
    const res = await app.request('/patients', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePatient),
    });
    expect(res.status).toBe(201);
    return ((await res.json()) as { patient: { id: string } }).patient;
  }

  async function addAssistant(
    app: ReturnType<typeof createTestApp>['app'],
    organizationId: string,
    email: string,
  ) {
    const login = await registerLogin(app, email, password);
    const membership = await prisma.membership.create({
      data: {
        id: randomUUID(),
        userId: login.userId,
        organizationId,
        role: 'ASSISTANT',
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });
    return { ...login, membershipId: membership.id };
  }

  function mediaBody(extra: Record<string, unknown> = {}) {
    return {
      title: 'Radio dentaire',
      kind: 'image',
      mime: 'image/png',
      originalName: 'radio.png',
      size: pngBytes.length,
      ...extra,
    };
  }

  it('upload complete download delete + cross-tenant isolation', async () => {
    const orgA = await bootstrapOrg('media-admin-a@example.com');
    const orgB = await bootstrapOrg('media-admin-b@example.com');
    const patientA = await createPatient(orgA.app, orgA.user.token);
    const patientB = await createPatient(orgB.app, orgB.user.token);

    const createOk = await orgA.app.request(
      `/patients/${patientA.id}/media`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgA.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...mediaBody(),
          organizationId: orgB.organization.id,
          storageKey: 'org/evil/patients/x/media/y.png',
          bucket: 'other-bucket',
          userId: orgB.user.userId,
        }),
      },
    );
    expect(createOk.status).toBe(201);
    const created = (await createOk.json()) as {
      media: {
        id: string;
        organizationId: string;
        status: string;
        size: number;
      };
      upload: {
        url: string;
        method: string;
        headers: Record<string, string>;
        expiresAt: string;
      };
    };
    expect(created.media.organizationId).toBe(orgA.organization.id);
    expect(created.media.status).toBe('PENDING');
    expect(created.upload.method).toBe('PUT');
    expect(created.upload.url).toContain('memory://upload/');
    expect(JSON.stringify(created)).not.toMatch(/R2_|SECRET|accessKey/i);

    const row = await prisma.patientMedia.findUniqueOrThrow({
      where: { id: created.media.id },
    });
    expect(row.storageKey).toBe(
      buildPatientMediaStorageKey({
        organizationId: orgA.organization.id,
        patientId: patientA.id,
        mediaId: created.media.id,
        ext: '.png',
      }),
    );
    expect(assertTenantStorageKey(row.storageKey, orgA.organization.id)).toBe(
      true,
    );
    expect(assertTenantStorageKey(row.storageKey, orgB.organization.id)).toBe(
      false,
    );

    // Download before READY
    expect(
      (
        await orgA.app.request(`/media/${created.media.id}/url`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(409);

    // Complete without object
    const missing = await orgA.app.request(
      `/media/${created.media.id}/complete`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgA.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
    );
    expect(missing.status).toBe(400);
    expect(
      (await prisma.patientMedia.findUniqueOrThrow({
        where: { id: created.media.id },
      })).status,
    ).toBe('FAILED');

    // Fresh upload for happy path
    const create2 = await orgA.app.request(`/patients/${patientA.id}/media`, {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mediaBody({ title: 'Ready radio' })),
    });
    const media2 = (await create2.json()) as {
      media: { id: string };
      upload: { url: string };
    };
    await orgA.objectStorage.putViaSignedUploadUrl(media2.upload.url, pngBytes);

    const completeOk = await orgA.app.request(
      `/media/${media2.media.id}/complete`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgA.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationId: orgB.organization.id }),
      },
    );
    expect(completeOk.status).toBe(200);
    expect(
      ((await completeOk.json()) as { media: { status: string } }).media.status,
    ).toBe('READY');

    const urlOk = await orgA.app.request(`/media/${media2.media.id}/url`, {
      headers: authHeader(orgA.user.token),
    });
    expect(urlOk.status).toBe(200);
    const signed = (await urlOk.json()) as {
      downloadUrl: string;
      expiresAt: string;
    };
    expect(signed.downloadUrl).toContain('memory://download/');
    const expiresAt = new Date(signed.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 310_000);

    // Org B media
    const createB = await orgB.app.request(`/patients/${patientB.id}/media`, {
      method: 'POST',
      headers: {
        ...authHeader(orgB.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mediaBody({ title: 'Org B' })),
    });
    const mediaB = (await createB.json()) as {
      media: { id: string };
      upload: { url: string };
    };
    await orgB.objectStorage.putViaSignedUploadUrl(mediaB.upload.url, pngBytes);
    await orgB.app.request(`/media/${mediaB.media.id}/complete`, {
      method: 'POST',
      headers: {
        ...authHeader(orgB.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(
      (
        await orgA.app.request(`/media/${mediaB.media.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await orgA.app.request(`/media/${mediaB.media.id}/url`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    const listA = await orgA.app.request(`/patients/${patientA.id}/media`, {
      headers: authHeader(orgA.user.token),
    });
    expect(listA.status).toBe(200);
    const listBody = (await listA.json()) as {
      items: { id: string }[];
      total: number;
    };
    expect(listBody.items.every((i) => i.id !== mediaB.media.id)).toBe(true);

    expect(
      (
        await orgA.app.request(`/patients/${patientB.id}/media`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mediaBody()),
        })
      ).status,
    ).toBe(404);

    // Size mismatch
    const createMismatch = await orgA.app.request(
      `/patients/${patientA.id}/media`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgA.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mediaBody({ size: pngBytes.length + 10 })),
      },
    );
    const mismatch = (await createMismatch.json()) as {
      media: { id: string };
      upload: { url: string };
    };
    // Force object with wrong size via putObject (bypass signed length check)
    const mismatchRow = await prisma.patientMedia.findUniqueOrThrow({
      where: { id: mismatch.media.id },
    });
    await orgA.objectStorage.putObject(
      mismatchRow.storageKey,
      pngBytes,
      'image/png',
    );
    expect(
      (
        await orgA.app.request(`/media/${mismatch.media.id}/complete`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await orgA.app.request(`/media/${mediaB.media.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await orgA.app.request(`/media/${media2.media.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);
    expect(
      await prisma.patientMedia.findUnique({ where: { id: media2.media.id } }),
    ).toBeNull();
    const media2Row = await prisma.patientMedia.findFirst({
      where: { id: media2.media.id },
    });
    expect(media2Row).toBeNull();
    const deletedKey = buildPatientMediaStorageKey({
      organizationId: orgA.organization.id,
      patientId: patientA.id,
      mediaId: media2.media.id,
      ext: '.png',
    });
    expect((await orgA.objectStorage.headObject(deletedKey)).exists).toBe(false);
  });

  it('assistant RBAC, validation, size limit, unauthenticated', async () => {
    const orgA = await bootstrapOrg('media-assist@example.com');
    const assistant = await addAssistant(
      orgA.app,
      orgA.organization.id,
      'media-assistant@example.com',
    );
    const patient = await createPatient(orgA.app, orgA.user.token);

    const created = await orgA.app.request(`/patients/${patient.id}/media`, {
      method: 'POST',
      headers: {
        ...authHeader(assistant.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mediaBody()),
    });
    expect(created.status).toBe(201);
    const media = (await created.json()) as {
      media: { id: string };
      upload: { url: string };
    };
    await orgA.objectStorage.putViaSignedUploadUrl(media.upload.url, pngBytes);
    expect(
      (
        await orgA.app.request(`/media/${media.media.id}/complete`, {
          method: 'POST',
          headers: {
            ...authHeader(assistant.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
      ).status,
    ).toBe(200);

    // ASSISTANT lacks documents.delete
    expect(
      (
        await orgA.app.request(`/media/${media.media.id}`, {
          method: 'DELETE',
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/media`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mediaBody({ size: MEDIA_MAX_BYTES + 1 })),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/media`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mediaBody({ originalName: 'bad.exe' })),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/media`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...mediaBody(), invented: true }),
        })
      ).status,
    ).toBe(400);

    expect(
      (await orgA.app.request(`/patients/${patient.id}/media`)).status,
    ).toBe(401);

    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { id: orgA.user.userId },
    });
    const adminMembership = await prisma.membership.findUniqueOrThrow({
      where: { id: orgA.membership.id },
    });
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: orgA.organization.id },
    });
    await orgA.permissionService.setOverrideAsAdmin(
      { user: adminUser, membership: adminMembership, organization },
      assistant.membershipId,
      'documents.read',
      'DENY',
    );
    expect(
      (
        await orgA.app.request(`/media/${media.media.id}`, {
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(403);
  });

  it('storage key cannot escape tenant prefix', () => {
    const orgId = randomUUID();
    const key = buildPatientMediaStorageKey({
      organizationId: orgId,
      patientId: randomUUID(),
      mediaId: randomUUID(),
      ext: '.png',
    });
    expect(key.startsWith(`org/${orgId}/`)).toBe(true);
    expect(key.includes('..')).toBe(false);
    expect(assertTenantStorageKey('org/other/patients/x/media/y.png', orgId)).toBe(
      false,
    );
    expect(assertTenantStorageKey('../../etc/passwd', orgId)).toBe(false);
  });

  it('schema includes PatientMedia; excludes DICOM/billing domains', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = readFileSync(join(here, '..', 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toMatch(/model\s+PatientMedia\b/);
    for (const model of [
      'ImagingStudy',
      'DicomSeries',
      'DicomInstance',
    ]) {
      expect(schema).not.toMatch(new RegExp(`model\\s+${model}\\b`));
    }
    expect(schema).toMatch(/model\s+AuditLog\b/);
  });
});
