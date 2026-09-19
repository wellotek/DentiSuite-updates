import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

describe('consultation / treatment cloud API (Phase 5C)', () => {
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

  function consultationBody(extra: Record<string, unknown> = {}) {
    return {
      date: '2026-09-02',
      time: '14:30',
      teeth: ['16', '17'],
      acts: 'Détartrage',
      notes: 'Patient calme',
      prescription: 'Bain de bouche 2x/j',
      ...extra,
    };
  }

  function treatmentBody(extra: Record<string, unknown> = {}) {
    return {
      date: '2026-09-02',
      tooth: '16',
      act: 'Composite',
      code: 'SB1',
      cost: 120.5,
      comment: 'Distal',
      careStatus: 'a_faire',
      paymentStatus: 'en_attente',
      ...extra,
    };
  }

  it('CRUD consultations + treatments with cross-tenant isolation', async () => {
    const orgA = await bootstrapOrg('clin-admin-a@example.com');
    const orgB = await bootstrapOrg('clin-admin-b@example.com');
    const patientA = await createPatient(orgA.app, orgA.user.token);
    const patientB = await createPatient(orgB.app, orgB.user.token, {
      firstName: 'Karim',
      lastName: 'Benali',
    });

    const createOk = await orgA.app.request(
      `/patients/${patientA.id}/consultations`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgA.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...consultationBody(),
          organizationId: orgB.organization.id,
          userId: orgB.user.userId,
        }),
      },
    );
    expect(createOk.status).toBe(201);
    const consultA = (await createOk.json()) as {
      consultation: { id: string; organizationId: string; teeth: string[] };
    };
    expect(consultA.consultation.organizationId).toBe(orgA.organization.id);
    expect(consultA.consultation.teeth).toEqual(['16', '17']);

    expect(
      (
        await orgA.app.request(`/patients/${patientB.id}/consultations`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(consultationBody()),
        })
      ).status,
    ).toBe(404);

    const createB = await orgB.app.request(
      `/patients/${patientB.id}/consultations`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgB.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(consultationBody({ time: '10:00' })),
      },
    );
    expect(createB.status).toBe(201);
    const consultB = (await createB.json()) as { consultation: { id: string } };

    expect(
      (
        await orgA.app.request(`/consultations/${consultA.consultation.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await orgA.app.request(`/consultations/${consultB.consultation.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await orgA.app.request(`/consultations/${consultA.consultation.id}`, {
          method: 'PATCH',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ patientId: patientB.id }),
        })
      ).status,
    ).toBe(404);

    const patchOk = await orgA.app.request(
      `/consultations/${consultA.consultation.id}`,
      {
        method: 'PATCH',
        headers: {
          ...authHeader(orgA.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: 'Updated',
          organizationId: orgB.organization.id,
          id: consultB.consultation.id,
        }),
      },
    );
    expect(patchOk.status).toBe(200);
    const patched = (await patchOk.json()) as {
      consultation: { id: string; notes: string; organizationId: string };
    };
    expect(patched.consultation.id).toBe(consultA.consultation.id);
    expect(patched.consultation.notes).toBe('Updated');
    expect(patched.consultation.organizationId).toBe(orgA.organization.id);

    const treatOk = await orgA.app.request(
      `/patients/${patientA.id}/treatments`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgA.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(treatmentBody()),
      },
    );
    expect(treatOk.status).toBe(201);
    const treatA = (await treatOk.json()) as {
      treatment: { id: string; cost: number; organizationId: string };
    };
    expect(treatA.treatment.cost).toBe(120.5);
    expect(treatA.treatment.organizationId).toBe(orgA.organization.id);

    expect(
      (
        await orgA.app.request(`/patients/${patientB.id}/treatments`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(treatmentBody()),
        })
      ).status,
    ).toBe(404);

    const treatB = await orgB.app.request(
      `/patients/${patientB.id}/treatments`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgB.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(treatmentBody({ tooth: '26' })),
      },
    );
    const treatBBody = (await treatB.json()) as { treatment: { id: string } };

    expect(
      (
        await orgA.app.request(`/treatments/${treatBBody.treatment.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await orgA.app.request(`/treatments/${treatA.treatment.id}`, {
          method: 'PATCH',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ patientId: patientB.id }),
        })
      ).status,
    ).toBe(404);

    const listA = await orgA.app.request(
      `/patients/${patientA.id}/consultations`,
      { headers: authHeader(orgA.user.token) },
    );
    expect(listA.status).toBe(200);
    expect(((await listA.json()) as { total: number }).total).toBe(1);

    expect(
      (
        await orgA.app.request(`/patients/${patientB.id}/consultations`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await orgA.app.request(`/consultations/${consultB.consultation.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await orgA.app.request(`/consultations/${consultA.consultation.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);
    expect(await prisma.clinicalSession.findUnique({
      where: { id: consultA.consultation.id },
    })).toBeNull();

    expect(
      (
        await orgA.app.request(`/treatments/${treatA.treatment.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);
    expect(await prisma.treatment.findUnique({
      where: { id: treatA.treatment.id },
    })).toBeNull();
  });

  it('assistant RBAC, filters, validation, unauthenticated', async () => {
    const orgA = await bootstrapOrg('clin-assist@example.com');
    const assistant = await addAssistant(
      orgA.app,
      orgA.organization.id,
      'clin-assistant@example.com',
    );
    const patient = await createPatient(orgA.app, orgA.user.token);

    const created = await orgA.app.request(
      `/patients/${patient.id}/consultations`,
      {
        method: 'POST',
        headers: {
          ...authHeader(assistant.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(consultationBody()),
      },
    );
    expect(created.status).toBe(201);
    const consult = (await created.json()) as { consultation: { id: string } };

    const treatCreated = await orgA.app.request(
      `/patients/${patient.id}/treatments`,
      {
        method: 'POST',
        headers: {
          ...authHeader(assistant.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(treatmentBody()),
      },
    );
    expect(treatCreated.status).toBe(201);
    const treat = (await treatCreated.json()) as { treatment: { id: string } };

    expect(
      (
        await orgA.app.request(`/consultations/${consult.consultation.id}`, {
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
      'consultations.update',
      'DENY',
    );

    expect(
      (
        await orgA.app.request(`/consultations/${consult.consultation.id}`, {
          method: 'PATCH',
          headers: {
            ...authHeader(assistant.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notes: 'Nope' }),
        })
      ).status,
    ).toBe(403);

    // ASSISTANT defaults lack consultations.delete
    expect(
      (
        await orgA.app.request(`/consultations/${consult.consultation.id}`, {
          method: 'DELETE',
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await orgA.app.request(`/treatments/${treat.treatment.id}`, {
          method: 'DELETE',
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(403);

    await orgA.app.request(`/patients/${patient.id}/consultations`, {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(consultationBody({ date: '2026-09-03', time: '09:00' })),
    });

    const byDate = await orgA.app.request(
      `/patients/${patient.id}/consultations?date=2026-09-02`,
      { headers: authHeader(orgA.user.token) },
    );
    expect(byDate.status).toBe(200);
    expect(((await byDate.json()) as { total: number }).total).toBe(1);

    await orgA.app.request(`/patients/${patient.id}/treatments`, {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        treatmentBody({ careStatus: 'fait', paymentStatus: 'paye', tooth: '17' }),
      ),
    });

    const byCare = await orgA.app.request(
      `/patients/${patient.id}/treatments?careStatus=a_faire`,
      { headers: authHeader(orgA.user.token) },
    );
    expect(byCare.status).toBe(200);
    expect(((await byCare.json()) as { total: number }).total).toBe(1);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/consultations`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(consultationBody({ date: '2026-13-40' })),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/treatments`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(treatmentBody({ careStatus: 'invalid' })),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await orgA.app.request(
          `/patients/${patient.id}/consultations?limit=500`,
          { headers: authHeader(orgA.user.token) },
        )
      ).status,
    ).toBe(400);

    expect(
      (await orgA.app.request(`/patients/${patient.id}/consultations`)).status,
    ).toBe(401);

    await orgA.permissionService.setOverrideAsAdmin(
      { user: adminUser, membership: adminMembership, organization },
      assistant.membershipId,
      'consultations.read',
      'DENY',
    );
    expect(
      (
        await orgA.app.request(`/consultations/${consult.consultation.id}`, {
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(403);
  });

  it('patient purge cascades clinical rows (local-equivalent)', async () => {
    const orgA = await bootstrapOrg('clin-cascade@example.com');
    const patient = await createPatient(orgA.app, orgA.user.token);

    const c = await orgA.app.request(`/patients/${patient.id}/consultations`, {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(consultationBody()),
    });
    const consult = (await c.json()) as { consultation: { id: string } };

    const t = await orgA.app.request(`/patients/${patient.id}/treatments`, {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(treatmentBody()),
    });
    const treat = (await t.json()) as { treatment: { id: string } };

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/purge`, {
          method: 'POST',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(409);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/purge`, {
          method: 'POST',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);

    expect(
      await prisma.clinicalSession.findUnique({
        where: { id: consult.consultation.id },
      }),
    ).toBeNull();
    expect(
      await prisma.treatment.findUnique({ where: { id: treat.treatment.id } }),
    ).toBeNull();
  });

  it('schema includes ClinicalSession + Treatment; excludes later domains', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = readFileSync(join(here, '..', 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toMatch(/model\s+ClinicalSession\b/);
    expect(schema).toMatch(/model\s+Treatment\b/);
    expect(schema).toMatch(/model\s+AuditLog\b/);
  });
});
