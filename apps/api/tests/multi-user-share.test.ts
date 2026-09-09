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

describe('multi-user shared cabinet data + username + audit', () => {
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

  it('A–H: ADMIN and ASSISTANT share patients and appointments by organizationId', async () => {
    const { app, user: admin } = await bootstrapAdmin('admin-share@example.com');

    const created = await app.request('/team', {
      method: 'POST',
      headers: { ...authHeader(admin.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'sara',
        displayName: 'Sarah Benali',
        password: 'AssistPass1!',
        role: 'ASSISTANT',
        permissions: [
          'patients.read',
          'patients.create',
          'patients.update',
          'appointments.read',
          'appointments.create',
          'appointments.update',
        ],
      }),
    });
    expect(created.status).toBe(201);
    const member = (await created.json()) as {
      member: { membershipId: string; username: string; permissions: string[] };
    };
    expect(member.member.username).toBe('sara');

    const assistLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sara', password: 'AssistPass1!' }),
    });
    expect(assistLogin.status).toBe(200);
    const assist = (await assistLogin.json()) as {
      token: string;
      user: { username: string | null; displayName: string | null };
    };
    expect(assist.user.username).toBe('sara');
    expect(assist.user.displayName).toBe('Sarah Benali');

    const patientCreate = await app.request('/patients', {
      method: 'POST',
      headers: { ...authHeader(assist.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'TEST',
        lastName: 'ASSISTANT',
        phone: '0600000000',
        age: 30,
      }),
    });
    expect(patientCreate.status).toBe(201);
    const { patient } = (await patientCreate.json()) as {
      patient: { id: string; firstName: string; lastName: string; organizationId: string };
    };
    expect(patient.lastName).toBe('ASSISTANT');

    const adminList = await app.request('/patients?search=TEST-ASSISTANT&limit=100', {
      headers: authHeader(admin.token),
    });
    // search is free text on name — use ASSISTANT
    const adminList2 = await app.request('/patients?search=ASSISTANT&limit=100', {
      headers: authHeader(admin.token),
    });
    expect(adminList2.status).toBe(200);
    const adminBody = (await adminList2.json()) as {
      items: Array<{ id: string; lastName: string }>;
    };
    expect(adminBody.items.some((p) => p.id === patient.id)).toBe(true);

    const patch = await app.request(`/patients/${patient.id}`, {
      method: 'PATCH',
      headers: { ...authHeader(admin.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'vu-par-admin' }),
    });
    expect(patch.status).toBe(200);

    const assistGet = await app.request(`/patients/${patient.id}`, {
      headers: authHeader(assist.token),
    });
    expect(assistGet.status).toBe(200);
    const assistPatient = (await assistGet.json()) as { patient: { notes: string | null } };
    expect(assistPatient.patient.notes).toBe('vu-par-admin');

    const appt = await app.request('/appointments', {
      method: 'POST',
      headers: { ...authHeader(assist.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: patient.id,
        date: '2026-09-10',
        time: '10:00',
        durationMin: 30,
        motif: 'controle',
        category: 'controle',
      }),
    });
    expect(appt.status).toBe(201);
    const { appointment } = (await appt.json()) as { appointment: { id: string } };

    const adminAppts = await app.request('/appointments?patientId=' + patient.id, {
      headers: authHeader(admin.token),
    });
    expect(adminAppts.status).toBe(200);
    const apptBody = (await adminAppts.json()) as { items: Array<{ id: string }> };
    expect(apptBody.items.some((a) => a.id === appointment.id)).toBe(true);

    void adminList;
  });

  it('I–U: team edit, role, permissions, password, audit, RBAC, cross-tenant', async () => {
    const a = await bootstrapAdmin('admin-team2@example.com');
    const b = await bootstrapAdmin('admin-other@example.com');

    const created = await a.app.request('/team', {
      method: 'POST',
      headers: { ...authHeader(a.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'amine',
        displayName: 'Amine Sec',
        password: 'AssistPass1!',
        role: 'ASSISTANT',
      }),
    });
    expect(created.status).toBe(201);
    const { member } = (await created.json()) as {
      member: { membershipId: string; role: string; permissions: string[] };
    };

    const rolePatch = await a.app.request(`/team/${member.membershipId}`, {
      method: 'PATCH',
      headers: { ...authHeader(a.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'ASSISTANT', permissions: ['patients.read', 'patients.create'] }),
    });
    expect(rolePatch.status).toBe(200);
    const updated = (await rolePatch.json()) as {
      member: { permissions: string[]; role: string };
    };
    expect(updated.member.permissions).toContain('patients.read');
    expect(updated.member.permissions).not.toContain('billing.read');

    const pwd = await a.app.request(`/team/${member.membershipId}`, {
      method: 'PATCH',
      headers: { ...authHeader(a.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'NewAssistPass2!' }),
    });
    expect(pwd.status).toBe(200);

    const oldLogin = await a.app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'amine', password: 'AssistPass1!' }),
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await a.app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'amine', password: 'NewAssistPass2!' }),
    });
    expect(newLogin.status).toBe(200);
    const assist = (await newLogin.json()) as { token: string };

    const denyTeam = await a.app.request('/team', {
      headers: authHeader(assist.token),
    });
    expect(denyTeam.status).toBe(403);

    const selfPromote = await a.app.request(`/team/${member.membershipId}`, {
      method: 'PATCH',
      headers: { ...authHeader(assist.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'ADMIN' }),
    });
    expect(selfPromote.status).toBe(403);

    const suspend = await a.app.request(`/team/${member.membershipId}`, {
      method: 'PATCH',
      headers: { ...authHeader(a.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DISABLED' }),
    });
    expect(suspend.status).toBe(200);

    const suspendedLogin = await a.app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'amine', password: 'NewAssistPass2!' }),
    });
    expect(suspendedLogin.status).toBe(401);

    const reactivate = await a.app.request(`/team/${member.membershipId}`, {
      method: 'PATCH',
      headers: { ...authHeader(a.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    expect(reactivate.status).toBe(200);

    const audit = await a.app.request('/audit?limit=50', {
      headers: authHeader(a.user.token),
    });
    expect(audit.status).toBe(200);
    const auditBody = (await audit.json()) as {
      items: Array<{
        action: string;
        actorUserId: string | null;
        organizationId: string;
        actorUsername: string | null;
      }>;
    };
    expect(auditBody.items.length).toBeGreaterThan(0);
    expect(auditBody.items.every((i) => i.organizationId === a.organization.id)).toBe(true);
    expect(auditBody.items.some((i) => i.action === 'TEAM_MEMBER_CREATED')).toBe(true);
    expect(auditBody.items.some((i) => i.actorUserId === a.user.userId)).toBe(true);

    // cross-tenant: org B cannot patch org A membership
    const cross = await b.app.request(`/team/${member.membershipId}`, {
      method: 'PATCH',
      headers: { ...authHeader(b.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'ADMIN' }),
    });
    expect([403, 404]).toContain(cross.status);
  });
});
