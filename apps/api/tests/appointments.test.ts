import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

const samplePatient = {
  firstName: 'Sophie',
  lastName: 'Martin',
  phone: '06 12 34 56 78',
  age: 34,
  address: '12 rue des Lilas',
  antecedents: 'Aucun',
  hasAllergies: false,
};

describe('appointment cloud API', () => {
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

  async function createPatient(
    app: ReturnType<typeof createTestApp>['app'],
    token: string,
    patch: Partial<typeof samplePatient> = {},
  ) {
    const res = await app.request('/patients', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...samplePatient, ...patch }),
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

  function aptBody(patientId: string, extra: Record<string, unknown> = {}) {
    return {
      date: '2026-08-19',
      time: '09:00',
      durationMin: 45,
      patientId,
      motif: 'Détartrage',
      practitioner: 'Dr. Test',
      dentistId: 'd1',
      status: 'confirme',
      category: 'controle',
      ...extra,
    };
  }

  it('CRUD + cross-tenant isolation + patient relation safety', async () => {
    const orgA = await bootstrapOrg('apt-admin-a@example.com');
    const orgB = await bootstrapOrg('apt-admin-b@example.com');
    const patientA = await createPatient(orgA.app, orgA.user.token);
    const patientB = await createPatient(orgB.app, orgB.user.token, {
      firstName: 'Karim',
      lastName: 'Benali',
    });

    const createOk = await orgA.app.request('/appointments', {
      method: 'POST',
      headers: { ...authHeader(orgA.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...aptBody(patientA.id),
        organizationId: orgB.organization.id,
        userId: orgB.user.userId,
      }),
    });
    expect(createOk.status).toBe(201);
    const aptA = (await createOk.json()) as {
      appointment: { id: string; organizationId: string; patientName: string };
    };
    expect(aptA.appointment.organizationId).toBe(orgA.organization.id);
    expect(aptA.appointment.patientName).toContain('Sophie');

    const createForeignPatient = await orgA.app.request('/appointments', {
      method: 'POST',
      headers: { ...authHeader(orgA.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify(aptBody(patientB.id)),
    });
    expect(createForeignPatient.status).toBe(404);

    const createB = await orgB.app.request('/appointments', {
      method: 'POST',
      headers: { ...authHeader(orgB.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify(aptBody(patientB.id, { time: '10:30' })),
    });
    const aptB = (await createB.json()) as { appointment: { id: string } };

    expect(
      (
        await orgA.app.request(`/appointments/${aptA.appointment.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await orgA.app.request(`/appointments/${aptB.appointment.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    const patchForeignPatient = await orgA.app.request(
      `/appointments/${aptA.appointment.id}`,
      {
        method: 'PATCH',
        headers: { ...authHeader(orgA.user.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: patientB.id }),
      },
    );
    expect(patchForeignPatient.status).toBe(404);

    const patchOk = await orgA.app.request(`/appointments/${aptA.appointment.id}`, {
      method: 'PATCH',
      headers: { ...authHeader(orgA.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        motif: 'Contrôle',
        organizationId: orgB.organization.id,
        id: aptB.appointment.id,
      }),
    });
    expect(patchOk.status).toBe(200);
    const patched = (await patchOk.json()) as {
      appointment: { id: string; motif: string; organizationId: string };
    };
    expect(patched.appointment.id).toBe(aptA.appointment.id);
    expect(patched.appointment.motif).toBe('Contrôle');
    expect(patched.appointment.organizationId).toBe(orgA.organization.id);

    expect(
      (
        await orgA.app.request(`/appointments/${aptB.appointment.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await orgA.app.request(`/appointments/${aptA.appointment.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);
  });

  it('assistant permissions and date query / pagination / validation', async () => {
    const orgA = await bootstrapOrg('apt-assist@example.com');
    const assistant = await addAssistant(
      orgA.app,
      orgA.organization.id,
      'apt-assistant@example.com',
    );
    const patient = await createPatient(orgA.app, orgA.user.token);

    const created = await orgA.app.request('/appointments', {
      method: 'POST',
      headers: { ...authHeader(assistant.token), 'Content-Type': 'application/json' },
      body: JSON.stringify(aptBody(patient.id)),
    });
    expect(created.status).toBe(201);
    const apt = (await created.json()) as { appointment: { id: string } };

    expect(
      (
        await orgA.app.request(`/appointments/${apt.appointment.id}`, {
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(200);

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
      'appointments.update',
      'DENY',
    );
    await orgA.permissionService.setOverrideAsAdmin(
      { user: adminUser, membership: adminMembership, organization },
      assistant.membershipId,
      'appointments.delete',
      'DENY',
    );

    expect(
      (
        await orgA.app.request(`/appointments/${apt.appointment.id}`, {
          method: 'PATCH',
          headers: { ...authHeader(assistant.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ motif: 'Nope' }),
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await orgA.app.request(`/appointments/${apt.appointment.id}`, {
          method: 'DELETE',
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(403);

    await orgA.app.request('/appointments', {
      method: 'POST',
      headers: { ...authHeader(orgA.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify(aptBody(patient.id, { date: '2026-08-20', time: '11:00' })),
    });

    const byDate = await orgA.app.request('/appointments?date=2026-08-19', {
      headers: authHeader(orgA.user.token),
    });
    expect(byDate.status).toBe(200);
    const byDateBody = (await byDate.json()) as { total: number; items: unknown[] };
    expect(byDateBody.total).toBe(1);

    const range = await orgA.app.request(
      '/appointments?from=2026-08-19&to=2026-08-20',
      { headers: authHeader(orgA.user.token) },
    );
    expect(range.status).toBe(200);
    expect(((await range.json()) as { total: number }).total).toBe(2);

    const badRange = await orgA.app.request(
      '/appointments?from=2026-08-20&to=2026-08-19',
      { headers: authHeader(orgA.user.token) },
    );
    expect(badRange.status).toBe(400);

    const badDate = await orgA.app.request('/appointments', {
      method: 'POST',
      headers: { ...authHeader(orgA.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify(aptBody(patient.id, { date: '2026-13-40' })),
    });
    expect(badDate.status).toBe(400);

    const badTime = await orgA.app.request('/appointments', {
      method: 'POST',
      headers: { ...authHeader(orgA.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify(aptBody(patient.id, { time: '25:99' })),
    });
    expect(badTime.status).toBe(400);

    expect(
      (
        await orgA.app.request('/appointments?limit=500', {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(400);

    expect((await orgA.app.request('/appointments')).status).toBe(401);

    const byPatientOtherOrg = await bootstrapOrg('apt-other@example.com');
    const otherPatient = await createPatient(
      byPatientOtherOrg.app,
      byPatientOtherOrg.user.token,
    );
    expect(
      (
        await orgA.app.request(`/appointments?patientId=${otherPatient.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);
  });
});
