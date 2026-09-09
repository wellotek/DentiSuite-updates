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
  antecedents: 'Allergie à la pénicilline',
  hasAllergies: true,
  dentistId: 'd1',
  teeth: {
    '24': { number: '24', status: 'a_traiter', note: 'Pilier' },
  },
  notes: 'Suivi bridge',
};

describe('patient cloud API', () => {
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

  it('Admin A CRUD works; cross-tenant patient is 404', async () => {
    const orgA = await bootstrapOrg('admin-a@example.com');
    const orgB = await bootstrapOrg('admin-b@example.com');

    const createA = await orgA.app.request('/patients', {
      method: 'POST',
      headers: { ...authHeader(orgA.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...samplePatient,
        organizationId: orgB.organization.id,
        userId: orgB.user.userId,
      }),
    });
    expect(createA.status).toBe(201);
    const patientA = (await createA.json()) as { patient: { id: string; organizationId: string } };
    expect(patientA.patient.organizationId).toBe(orgA.organization.id);

    const createB = await orgB.app.request('/patients', {
      method: 'POST',
      headers: { ...authHeader(orgB.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...samplePatient, firstName: 'Karim', lastName: 'Benali' }),
    });
    const patientB = (await createB.json()) as { patient: { id: string } };

    const readOwn = await orgA.app.request(`/patients/${patientA.patient.id}`, {
      headers: authHeader(orgA.user.token),
    });
    expect(readOwn.status).toBe(200);

    const readOther = await orgA.app.request(`/patients/${patientB.patient.id}`, {
      headers: authHeader(orgA.user.token),
    });
    expect(readOther.status).toBe(404);

    const patch = await orgA.app.request(`/patients/${patientA.patient.id}`, {
      method: 'PATCH',
      headers: { ...authHeader(orgA.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '06 00 00 00 00',
        organizationId: orgB.organization.id,
        id: patientB.patient.id,
      }),
    });
    expect(patch.status).toBe(200);
    const patched = (await patch.json()) as {
      patient: { id: string; phone: string; organizationId: string };
    };
    expect(patched.patient.id).toBe(patientA.patient.id);
    expect(patched.patient.organizationId).toBe(orgA.organization.id);
    expect(patched.patient.phone).toBe('06 00 00 00 00');

    const delOther = await orgA.app.request(`/patients/${patientB.patient.id}`, {
      method: 'DELETE',
      headers: authHeader(orgA.user.token),
    });
    expect(delOther.status).toBe(404);

    const delOwn = await orgA.app.request(`/patients/${patientA.patient.id}`, {
      method: 'DELETE',
      headers: authHeader(orgA.user.token),
    });
    expect(delOwn.status).toBe(200);
    expect(
      (
        await orgA.app.request(`/patients/${patientA.patient.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);
  });

  it('Assistant can read/create; denied update/delete when override removes permission', async () => {
    const orgA = await bootstrapOrg('admin-assist-pat@example.com');
    const assistant = await addAssistant(
      orgA.app,
      orgA.organization.id,
      'assistant-pat@example.com',
    );

    const created = await orgA.app.request('/patients', {
      method: 'POST',
      headers: { ...authHeader(assistant.token), 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePatient),
    });
    expect(created.status).toBe(201);
    const patient = (await created.json()) as { patient: { id: string } };

    expect(
      (
        await orgA.app.request(`/patients/${patient.patient.id}`, {
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(200);

    // Default ASSISTANT has patients.update — temporarily DENY for test.
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
      'patients.update',
      'DENY',
    );
    await orgA.permissionService.setOverrideAsAdmin(
      { user: adminUser, membership: adminMembership, organization },
      assistant.membershipId,
      'patients.delete',
      'DENY',
    );

    expect(
      (
        await orgA.app.request(`/patients/${patient.patient.id}`, {
          method: 'PATCH',
          headers: { ...authHeader(assistant.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '01 02 03 04 05' }),
        })
      ).status,
    ).toBe(403);

    // patients.delete already absent for ASSISTANT by default; DENY still 403
    expect(
      (
        await orgA.app.request(`/patients/${patient.patient.id}`, {
          method: 'DELETE',
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await orgA.app.request(`/patients/${patient.patient.id}`, {
          method: 'PATCH',
          headers: { ...authHeader(orgA.user.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '01 02 03 04 05' }),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await orgA.app.request(`/patients/${patient.patient.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);
  });

  it('Assistant cannot read other tenant patient; unauthenticated 401', async () => {
    const orgA = await bootstrapOrg('admin-iso@example.com');
    const orgB = await bootstrapOrg('admin-iso-b@example.com');
    const assistant = await addAssistant(
      orgA.app,
      orgA.organization.id,
      'assistant-iso@example.com',
    );

    const patientA = (await (
      await orgA.app.request('/patients', {
        method: 'POST',
        headers: { ...authHeader(orgA.user.token), 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePatient),
      })
    ).json()) as { patient: { id: string } };

    const patientB = (await (
      await orgB.app.request('/patients', {
        method: 'POST',
        headers: { ...authHeader(orgB.user.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...samplePatient, firstName: 'Other' }),
      })
    ).json()) as { patient: { id: string } };

    expect(
      (
        await orgA.app.request(`/patients/${patientA.patient.id}`, {
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await orgA.app.request(`/patients/${patientB.patient.id}`, {
          headers: {
            ...authHeader(assistant.token),
            'x-organization-id': orgB.organization.id,
          },
        })
      ).status,
    ).toBe(404);

    expect((await orgA.app.request('/patients')).status).toBe(401);
  });

  it('search stays tenant-scoped and pagination limit is bounded', async () => {
    const orgA = await bootstrapOrg('admin-search@example.com');
    const orgB = await bootstrapOrg('admin-search-b@example.com');

    await orgA.app.request('/patients', {
      method: 'POST',
      headers: { ...authHeader(orgA.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...samplePatient, lastName: 'UniqueAlpha' }),
    });
    await orgB.app.request('/patients', {
      method: 'POST',
      headers: { ...authHeader(orgB.user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...samplePatient, lastName: 'UniqueAlpha' }),
    });

    const list = await orgA.app.request('/patients?search=UniqueAlpha', {
      headers: authHeader(orgA.user.token),
    });
    expect(list.status).toBe(200);
    const body = (await list.json()) as { items: unknown[]; total: number };
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);

    const overLimit = await orgA.app.request('/patients?limit=500', {
      headers: authHeader(orgA.user.token),
    });
    expect(overLimit.status).toBe(400);
  });
});
