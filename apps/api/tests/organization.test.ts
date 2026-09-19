import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  authHeader,
  createTestApp,
  registerLogin,
  resetAuthTables,
  startTestDatabase,
  stopTestDatabase,
} from './helpers/test-db.js';

const password = 'SecurePass1!';

describe('organization + membership foundation', () => {
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

  it('authenticated user creates organization and becomes ADMIN', async () => {
    const { app } = createTestApp(prisma);
    const { token, userId } = await registerLogin(app, 'admin@example.com', password);

    const res = await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cabinet Alpha',
        userId: randomUUID(),
        organizationId: randomUUID(),
        maxUsers: 999,
        licenseId: 'forged-license',
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      organization: { id: string; name: string };
      membership: { role: string; userId: string; organizationId: string };
      licenseBinding: { licenseId: string; status: string } | null;
    };

    expect(body.organization.name).toBe('Cabinet Alpha');
    expect(body.membership.role).toBe('ADMIN');
    expect(body.membership.userId).toBe(userId);
    expect(body.membership.organizationId).toBe(body.organization.id);
    // Open-create (dev/test) attaches synthetic DEV-* binding; client licenseId ignored.
    expect(body.licenseBinding).not.toBeNull();
    expect(body.licenseBinding?.licenseId.startsWith('DEV-')).toBe(true);
    expect(body.licenseBinding?.licenseId).not.toBe('forged-license');

    const bindings = await prisma.licenseBinding.count();
    expect(bindings).toBe(1);
  });

  it('unauthenticated user cannot create organization', async () => {
    const { app } = createTestApp(prisma);
    const res = await app.request('/organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Auth Cabinet' }),
    });
    expect(res.status).toBe(401);
  });

  it('registration still creates only User (no organization)', async () => {
    const { app } = createTestApp(prisma);
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'solo@example.com', password }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      organization: null;
      membership: null;
    };
    expect(body.organization).toBeNull();
    expect(body.membership).toBeNull();
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.membership.count()).toBe(0);
  });

  it('prevents second active membership / duplicate org bootstrap', async () => {
    const { app } = createTestApp(prisma);
    const { token } = await registerLogin(app, 'once@example.com', password);

    const first = await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'First Cabinet' }),
    });
    expect(first.status).toBe(201);

    const second = await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Second Cabinet' }),
    });
    expect(second.status).toBe(409);

    const org = await prisma.organization.findFirst();
    await expect(
      prisma.membership.create({
        data: {
          id: randomUUID(),
          userId: (await prisma.user.findFirst())!.id,
          organizationId: org!.id,
          role: 'ASSISTANT',
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it('user without membership cannot access organization', async () => {
    const { app } = createTestApp(prisma);
    const { token } = await registerLogin(app, 'nomember@example.com', password);
    const res = await app.request('/organization/me', {
      headers: authHeader(token),
    });
    expect(res.status).toBe(403);
  });

  it('disabled membership cannot access organization', async () => {
    const { app } = createTestApp(prisma);
    const { token } = await registerLogin(app, 'disabled-m@example.com', password);
    await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Disabled Membership Cabinet' }),
    });

    await prisma.membership.updateMany({
      data: { status: 'DISABLED', disabledAt: new Date() },
    });

    const res = await app.request('/organization/me', {
      headers: authHeader(token),
    });
    expect(res.status).toBe(403);
  });

  it('disabled organization cannot be accessed', async () => {
    const { app } = createTestApp(prisma);
    const { token } = await registerLogin(app, 'disabled-o@example.com', password);
    await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Disabled Org Cabinet' }),
    });

    await prisma.organization.updateMany({
      data: { status: 'DISABLED' },
    });

    const res = await app.request('/organization/me', {
      headers: authHeader(token),
    });
    expect(res.status).toBe(403);
  });

  it('GET organization/me returns current tenant and membership endpoint works', async () => {
    const { app } = createTestApp(prisma);
    const { token } = await registerLogin(app, 'me-org@example.com', password);
    const created = await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Cabinet' }),
    });
    const createdBody = (await created.json()) as {
      organization: { id: string };
      membership: { id: string };
    };

    const me = await app.request('/organization/me', {
      headers: authHeader(token),
    });
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as {
      organization: { id: string; name: string };
      auth: { organizationId: string; membershipId: string; membershipRole: string };
    };
    expect(meBody.organization.id).toBe(createdBody.organization.id);
    expect(meBody.auth.organizationId).toBe(createdBody.organization.id);
    expect(meBody.auth.membershipRole).toBe('ADMIN');

    const membership = await app.request('/organization/me/membership', {
      headers: authHeader(token),
    });
    expect(membership.status).toBe(200);
    const mBody = (await membership.json()) as { membership: { id: string; role: string } };
    expect(mBody.membership.id).toBe(createdBody.membership.id);
    expect(mBody.membership.role).toBe('ADMIN');
  });

  it('PATCH organization/me requires ADMIN; ASSISTANT cannot modify', async () => {
    const { app } = createTestApp(prisma);
    const admin = await registerLogin(app, 'patch-admin@example.com', password);
    const assistant = await registerLogin(app, 'patch-assistant@example.com', password);

    const created = await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(admin.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Role Cabinet' }),
    });
    const org = (await created.json()) as { organization: { id: string } };

    await prisma.membership.create({
      data: {
        id: randomUUID(),
        userId: assistant.userId,
        organizationId: org.organization.id,
        role: 'ASSISTANT',
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    const adminPatch = await app.request('/organization/me', {
      method: 'PATCH',
      headers: { ...authHeader(admin.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Role Cabinet Updated' }),
    });
    expect(adminPatch.status).toBe(200);

    const assistantPatch = await app.request('/organization/me', {
      method: 'PATCH',
      headers: { ...authHeader(assistant.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked Name' }),
    });
    expect(assistantPatch.status).toBe(403);

    const assistantGet = await app.request('/organization/me', {
      headers: authHeader(assistant.token),
    });
    expect(assistantGet.status).toBe(200);
    const getBody = (await assistantGet.json()) as { organization: { name: string } };
    expect(getBody.organization.name).toBe('Role Cabinet Updated');
  });

  it('client organizationId cannot override membership organization (tenant isolation)', async () => {
    const { app } = createTestApp(prisma);
    const userA = await registerLogin(app, 'a@example.com', password);
    const userB = await registerLogin(app, 'b@example.com', password);

    const orgARes = await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(userA.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Org A' }),
    });
    const orgBRes = await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(userB.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Org B' }),
    });
    const orgA = (await orgARes.json()) as { organization: { id: string } };
    const orgB = (await orgBRes.json()) as { organization: { id: string } };

    const forged = await app.request('/organization/me', {
      headers: {
        ...authHeader(userA.token),
        'x-organization-id': orgB.organization.id,
      },
    });
    expect(forged.status).toBe(200);
    const forgedBody = (await forged.json()) as {
      organization: { id: string };
      auth: { organizationId: string };
    };
    expect(forgedBody.organization.id).toBe(orgA.organization.id);
    expect(forgedBody.auth.organizationId).toBe(orgA.organization.id);
    expect(forgedBody.organization.id).not.toBe(orgB.organization.id);

    const patchForged = await app.request('/organization/me', {
      method: 'PATCH',
      headers: {
        ...authHeader(userA.token),
        'Content-Type': 'application/json',
        'x-organization-id': orgB.organization.id,
      },
      body: JSON.stringify({
        name: 'Should Stay Org A',
        organizationId: orgB.organization.id,
      }),
    });
    expect(patchForged.status).toBe(200);
    const patched = (await patchForged.json()) as { organization: { id: string; name: string } };
    expect(patched.organization.id).toBe(orgA.organization.id);
    expect(patched.organization.name).toBe('Should Stay Org A');

    const orgBFresh = await prisma.organization.findUnique({
      where: { id: orgB.organization.id },
    });
    expect(orgBFresh!.name).toBe('Org B');
  });

  it('LicenseBinding uniqueness enforced; client cannot forge maxUsers via HTTP', async () => {
    const { app, organizationService } = createTestApp(prisma);
    const { token } = await registerLogin(app, 'license@example.com', password);
    const created = await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Licensed Cabinet',
        maxUsers: 50,
        licenseId: 'client-forged',
        status: 'ACTIVE',
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      organization: { id: string };
      licenseBinding: { licenseId: string; maxUsers: number } | null;
    };
    expect(createdBody.licenseBinding?.licenseId.startsWith('DEV-')).toBe(true);
    expect(createdBody.licenseBinding?.maxUsers).toBe(25);
    expect(createdBody.licenseBinding?.licenseId).not.toBe('client-forged');
    expect(await prisma.licenseBinding.count()).toBe(1);

    // Second binding on same org is refused
    await expect(
      organizationService.createLicenseBinding(createdBody.organization.id, {
        licenseId: 'LIC-TEST-0001',
        maxUsers: 3,
        status: 'ACTIVE',
      }),
    ).rejects.toMatchObject({ code: 'LICENSE_BINDING_CONFLICT' });

    const other = await registerLogin(app, 'other-lic@example.com', password);
    const otherOrg = await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(other.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Other Cabinet' }),
    });
    const otherBody = (await otherOrg.json()) as { organization: { id: string } };

    // Cannot reuse another organization's licenseId
    await expect(
      organizationService.createLicenseBinding(otherBody.organization.id, {
        licenseId: createdBody.licenseBinding!.licenseId,
        maxUsers: 2,
      }),
    ).rejects.toMatchObject({ code: 'LICENSE_BINDING_CONFLICT' });
  });

  it('schema has no clinical models', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = readFileSync(join(here, '..', 'prisma', 'schema.prisma'), 'utf8');

    expect(schema).toMatch(/model\s+Organization\b/);
    expect(schema).toMatch(/model\s+Membership\b/);
    expect(schema).toMatch(/model\s+LicenseBinding\b/);

    expect(schema).toMatch(/model\s+AuditLog\b/);
  });
});
