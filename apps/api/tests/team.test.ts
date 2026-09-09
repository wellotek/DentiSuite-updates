import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  authHeader,
  createTestApp,
  registerLogin,
  resetAuthTables,
  startTestDatabase,
  stopTestDatabase,
} from './helpers/test-db.js';

const password = 'SecurePass1!';

describe('team cloud API', () => {
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
    const { app } = createTestApp(prisma);
    const user = await registerLogin(app, email, password);
    const created = await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${email} Cabinet` }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as {
      organization: { id: string };
      membership: { id: string };
    };
    return { app, user, ...body };
  }

  it('ADMIN can create ASSISTANT; assistant can login and is denied team routes', async () => {
    const { app, user, organization } = await bootstrapAdmin('admin-team@example.com');

    const created = await app.request('/team', {
      method: 'POST',
      headers: { ...authHeader(user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'assist-team@example.com',
        password: 'AssistPass1!',
        role: 'ASSISTANT',
        customPermissions: [
          'patients.read',
          'patients.create',
          'appointments.read',
          'appointments.create',
          'appointments.update',
        ],
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      member: {
        email: string;
        role: string;
        organizationId?: string;
        permissions: string[];
        membershipId: string;
      };
    };
    expect(createdBody.member.email).toBe('assist-team@example.com');
    expect(createdBody.member.role).toBe('ASSISTANT');
    expect(createdBody.member.permissions).toContain('patients.read');
    expect(createdBody.member.permissions).not.toContain('billing.read');
    expect(createdBody.member.permissions).not.toContain('team.read');

    const list = await app.request('/team', {
      headers: authHeader(user.token),
    });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { items: unknown[]; total: number };
    expect(listBody.total).toBe(2);

    const assistLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'assist-team@example.com',
        password: 'AssistPass1!',
      }),
    });
    expect(assistLogin.status).toBe(200);
    const assist = (await assistLogin.json()) as { token: string };

    const denied = await app.request('/team', {
      headers: authHeader(assist.token),
    });
    expect(denied.status).toBe(403);

    const deniedCreate = await app.request('/team', {
      method: 'POST',
      headers: { ...authHeader(assist.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'other@example.com',
        password: 'OtherPass1!',
        role: 'ASSISTANT',
      }),
    });
    expect(deniedCreate.status).toBe(403);

    // Tenant: membership belongs to admin org
    const mem = await prisma.membership.findUnique({
      where: { id: createdBody.member.membershipId },
    });
    expect(mem?.organizationId).toBe(organization.id);
  });

  it('ADMIN can suspend and remove assistant; cannot remove last admin', async () => {
    const { app, user } = await bootstrapAdmin('admin-team2@example.com');

    const created = await app.request('/team', {
      method: 'POST',
      headers: { ...authHeader(user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'assist2@example.com',
        password: 'AssistPass1!',
        role: 'ASSISTANT',
      }),
    });
    const { member } = (await created.json()) as { member: { membershipId: string } };

    const patch = await app.request(`/team/${member.membershipId}`, {
      method: 'PATCH',
      headers: { ...authHeader(user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DISABLED' }),
    });
    expect(patch.status).toBe(200);
    const patched = (await patch.json()) as { member: { status: string } };
    expect(patched.member.status).toBe('DISABLED');

    const del = await app.request(`/team/${member.membershipId}`, {
      method: 'DELETE',
      headers: authHeader(user.token),
    });
    expect(del.status).toBe(200);

    const me = await app.request('/organization/me/membership', {
      headers: authHeader(user.token),
    });
    const meBody = (await me.json()) as { membership: { id: string } };
    const selfDelete = await app.request(`/team/${meBody.membership.id}`, {
      method: 'DELETE',
      headers: authHeader(user.token),
    });
    expect(selfDelete.status).toBe(400);
  });

  it('rejects short passwords and cross-tenant membership ids', async () => {
    const a = await bootstrapAdmin('admin-a@example.com');
    const b = await bootstrapAdmin('admin-b@example.com');

    const short = await a.app.request('/team', {
      method: 'POST',
      headers: { ...authHeader(a.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'short@example.com',
        password: 'short',
        role: 'ASSISTANT',
      }),
    });
    expect(short.status).toBe(400);

    const created = await b.app.request('/team', {
      method: 'POST',
      headers: { ...authHeader(b.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'b-assist@example.com',
        password: 'AssistPass1!',
        role: 'ASSISTANT',
      }),
    });
    const { member } = (await created.json()) as { member: { membershipId: string } };

    const cross = await a.app.request(`/team/${member.membershipId}`, {
      method: 'PATCH',
      headers: { ...authHeader(a.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DISABLED' }),
    });
    expect(cross.status).toBe(404);
  });
});
