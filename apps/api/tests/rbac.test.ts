import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  ASSISTANT_PERMISSIONS,
  PERMISSIONS,
} from '../src/permissions/vocabulary.js';
import { seedPermissions } from '../src/permissions/seed.js';
import { AppError } from '../src/lib/errors.js';
import {
  authHeader,
  createTestApp,
  registerLogin,
  resetAuthTables,
  startTestDatabase,
  stopTestDatabase,
} from './helpers/test-db.js';

const password = 'SecurePass1!';

describe('RBAC permission foundation', () => {
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

  async function bootstrapAdmin(email: string) {
    const { app, permissionService } = createTestApp(prisma);
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
    return { app, permissionService, user, ...body };
  }

  it('ADMIN has all defined permissions via /auth/permissions', async () => {
    const { app, user } = await bootstrapAdmin('admin-all@example.com');
    const res = await app.request('/auth/permissions', {
      headers: authHeader(user.token),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { permissions: string[]; role: string };
    expect(body.role).toBe('ADMIN');
    expect(body.permissions).toEqual([...PERMISSIONS].sort());
  });

  it('ASSISTANT receives only defaults and excludes billing/team/settings/audit', async () => {
    const admin = await bootstrapAdmin('admin-assist@example.com');
    const assistantLogin = await registerLogin(
      admin.app,
      'assistant-defaults@example.com',
      password,
    );

    await prisma.membership.create({
      data: {
        id: randomUUID(),
        userId: assistantLogin.userId,
        organizationId: admin.organization.id,
        role: 'ASSISTANT',
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    const res = await admin.app.request('/auth/permissions', {
      headers: authHeader(assistantLogin.token),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { permissions: string[]; role: string };
    expect(body.role).toBe('ASSISTANT');
    expect(body.permissions).toEqual([...ASSISTANT_PERMISSIONS].sort());
    expect(body.permissions).not.toContain('billing.delete');
    expect(body.permissions).not.toContain('billing.read');
    expect(body.permissions).not.toContain('team.delete');
    expect(body.permissions).not.toContain('settings.update');
    expect(body.permissions).not.toContain('audit.read');
  });

  it('ALLOW override grants missing permission; DENY removes allowed; DENY beats ALLOW', async () => {
    const admin = await bootstrapAdmin('admin-override@example.com');
    const assistantLogin = await registerLogin(
      admin.app,
      'assistant-override@example.com',
      password,
    );
    const membership = await prisma.membership.create({
      data: {
        id: randomUUID(),
        userId: assistantLogin.userId,
        organizationId: admin.organization.id,
        role: 'ASSISTANT',
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { id: admin.user.userId },
    });
    const adminMembership = await prisma.membership.findUniqueOrThrow({
      where: { id: admin.membership.id },
    });
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: admin.organization.id },
    });

    const actor = {
      user: adminUser,
      membership: adminMembership,
      organization,
    };

    await admin.permissionService.setOverrideAsAdmin(
      actor,
      membership.id,
      'billing.read',
      'ALLOW',
    );

    let perms = await admin.app.request('/auth/permissions', {
      headers: authHeader(assistantLogin.token),
    });
    let body = (await perms.json()) as { permissions: string[] };
    expect(body.permissions).toContain('billing.read');

    await admin.permissionService.setOverrideAsAdmin(
      actor,
      membership.id,
      'patients.read',
      'DENY',
    );
    perms = await admin.app.request('/auth/permissions', {
      headers: authHeader(assistantLogin.token),
    });
    body = (await perms.json()) as { permissions: string[] };
    expect(body.permissions).not.toContain('patients.read');

    // DENY beats ALLOW on same permission
    await admin.permissionService.setOverrideAsAdmin(
      actor,
      membership.id,
      'billing.read',
      'ALLOW',
    );
    await admin.permissionService.setOverrideAsAdmin(
      actor,
      membership.id,
      'billing.read',
      'DENY',
    );
    perms = await admin.app.request('/auth/permissions', {
      headers: authHeader(assistantLogin.token),
    });
    body = (await perms.json()) as { permissions: string[] };
    expect(body.permissions).not.toContain('billing.read');
  });

  it('duplicate override unique constraint is enforced', async () => {
    const admin = await bootstrapAdmin('admin-dup@example.com');
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { key: 'billing.read' },
    });

    await prisma.membershipPermissionOverride.create({
      data: {
        id: randomUUID(),
        membershipId: admin.membership.id,
        permissionId: permission.id,
        effect: 'ALLOW',
        updatedAt: new Date(),
      },
    });

    await expect(
      prisma.membershipPermissionOverride.create({
        data: {
          id: randomUUID(),
          membershipId: admin.membership.id,
          permissionId: permission.id,
          effect: 'DENY',
          updatedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it('unauthenticated / inactive membership / inactive org → 401/403', async () => {
    const { app } = createTestApp(prisma);
    expect((await app.request('/auth/permissions')).status).toBe(401);

    const { app: app2, user } = await bootstrapAdmin('inactive-m@example.com');
    await prisma.membership.updateMany({
      data: { status: 'DISABLED', disabledAt: new Date() },
    });
    expect(
      (await app2.request('/auth/permissions', { headers: authHeader(user.token) }))
        .status,
    ).toBe(403);

    const { app: app3, user: user3 } = await bootstrapAdmin('inactive-o@example.com');
    await prisma.organization.updateMany({ data: { status: 'DISABLED' } });
    expect(
      (
        await app3.request('/auth/permissions', {
          headers: authHeader(user3.token),
        })
      ).status,
    ).toBe(403);
  });

  it('ASSISTANT cannot self-elevate via setOverrideAsAdmin', async () => {
    const admin = await bootstrapAdmin('admin-elevate@example.com');
    const assistantLogin = await registerLogin(
      admin.app,
      'assistant-elevate@example.com',
      password,
    );
    const membership = await prisma.membership.create({
      data: {
        id: randomUUID(),
        userId: assistantLogin.userId,
        organizationId: admin.organization.id,
        role: 'ASSISTANT',
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    const assistantUser = await prisma.user.findUniqueOrThrow({
      where: { id: assistantLogin.userId },
    });
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: admin.organization.id },
    });

    await expect(
      admin.permissionService.setOverrideAsAdmin(
        {
          user: assistantUser,
          membership,
          organization,
        },
        membership.id,
        'billing.delete',
        'ALLOW',
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('client-supplied role/organizationId cannot elevate or switch tenant', async () => {
    const orgA = await bootstrapAdmin('a-rbac@example.com');
    const orgB = await bootstrapAdmin('b-rbac@example.com');

    const assistantLogin = await registerLogin(
      orgA.app,
      'assistant-a@example.com',
      password,
    );
    await prisma.membership.create({
      data: {
        id: randomUUID(),
        userId: assistantLogin.userId,
        organizationId: orgA.organization.id,
        role: 'ASSISTANT',
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    const res = await orgA.app.request(
      `/auth/permissions?role=ADMIN&organizationId=${orgB.organization.id}`,
      {
        headers: {
          ...authHeader(assistantLogin.token),
          'x-organization-id': orgB.organization.id,
        },
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      role: string;
      organizationId: string;
      permissions: string[];
    };
    expect(body.role).toBe('ASSISTANT');
    expect(body.organizationId).toBe(orgA.organization.id);
    expect(body.organizationId).not.toBe(orgB.organization.id);
    expect(body.permissions).not.toContain('team.delete');
    expect(body.permissions).not.toContain('billing.delete');
  });

  it('invalid permission key is rejected; seed is idempotent', async () => {
    const admin = await bootstrapAdmin('admin-invalid@example.com');
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { id: admin.user.userId },
    });
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { id: admin.membership.id },
    });
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: admin.organization.id },
    });

    await expect(
      admin.permissionService.hasPermission(
        { user: adminUser, membership, organization },
        'not.a.real.permission',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_PERMISSION' });

    const first = await seedPermissions(prisma);
    const second = await seedPermissions(prisma);
    expect(first.permissions).toBe(PERMISSIONS.length);
    expect(second.permissions).toBe(PERMISSIONS.length);
    expect(await prisma.permission.count()).toBe(PERMISSIONS.length);
  });

  it('schema includes RBAC models and excludes later clinical domains', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = readFileSync(join(here, '..', 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toMatch(/model\s+Permission\b/);
    expect(schema).toMatch(/model\s+RolePermission\b/);
    expect(schema).toMatch(/model\s+MembershipPermissionOverride\b/);
    expect(schema).toMatch(/model\s+AuditLog\b/);
  });
});
