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

describe('prescription cloud API (Phase 5D)', () => {
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

  function rxBody(extra: Record<string, unknown> = {}) {
    return {
      date: '2026-09-02',
      title: 'Antalgique post-extraction',
      templateId: 'tpl-antalgique',
      advice: 'Glace 10 min / heure.',
      dentistId: 'd1',
      dentistName: 'Dr. Test',
      lines: [
        {
          drug: 'Paracétamol 1 g',
          posology: '1 comprimé toutes les 6 heures',
          duration: '3 à 5 jours',
          notes: '',
        },
        {
          drug: 'Ibuprofène 400 mg',
          posology: '1 comprimé 3 fois par jour',
          duration: '3 jours',
          notes: 'Contre-indiqué si ulcère',
        },
      ],
      ...extra,
    };
  }

  it('CRUD + cross-tenant isolation + patient relation safety', async () => {
    const orgA = await bootstrapOrg('rx-admin-a@example.com');
    const orgB = await bootstrapOrg('rx-admin-b@example.com');
    const patientA = await createPatient(orgA.app, orgA.user.token);
    const patientB = await createPatient(orgB.app, orgB.user.token, {
      firstName: 'Karim',
      lastName: 'Benali',
    });

    const createOk = await orgA.app.request(
      `/patients/${patientA.id}/prescriptions`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgA.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...rxBody(),
          organizationId: orgB.organization.id,
          userId: orgB.user.userId,
          patientName: 'Forged Name',
        }),
      },
    );
    expect(createOk.status).toBe(201);
    const rxA = (await createOk.json()) as {
      prescription: {
        id: string;
        organizationId: string;
        patientName: string;
        lines: { drug: string }[];
      };
    };
    expect(rxA.prescription.organizationId).toBe(orgA.organization.id);
    expect(rxA.prescription.patientName).toContain('Sophie');
    expect(rxA.prescription.lines).toHaveLength(2);

    expect(
      (
        await orgA.app.request(`/patients/${patientB.id}/prescriptions`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rxBody()),
        })
      ).status,
    ).toBe(404);

    const createB = await orgB.app.request(
      `/patients/${patientB.id}/prescriptions`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgB.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rxBody({ title: 'Org B Rx' })),
      },
    );
    expect(createB.status).toBe(201);
    const rxB = (await createB.json()) as { prescription: { id: string } };

    expect(
      (
        await orgA.app.request(`/prescriptions/${rxA.prescription.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await orgA.app.request(`/prescriptions/${rxB.prescription.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await orgA.app.request(`/prescriptions/${rxA.prescription.id}`, {
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
      `/prescriptions/${rxA.prescription.id}`,
      {
        method: 'PATCH',
        headers: {
          ...authHeader(orgA.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          advice: 'Updated advice',
          organizationId: orgB.organization.id,
          id: rxB.prescription.id,
          lines: [
            {
              drug: 'Chlorhexidine 0,12 %',
              posology: '2x/j',
              duration: '7 jours',
              notes: '',
            },
          ],
        }),
      },
    );
    expect(patchOk.status).toBe(200);
    const patched = (await patchOk.json()) as {
      prescription: {
        id: string;
        advice: string;
        organizationId: string;
        lines: { drug: string }[];
      };
    };
    expect(patched.prescription.id).toBe(rxA.prescription.id);
    expect(patched.prescription.advice).toBe('Updated advice');
    expect(patched.prescription.organizationId).toBe(orgA.organization.id);
    expect(patched.prescription.lines).toHaveLength(1);
    expect(patched.prescription.lines[0]?.drug).toContain('Chlorhexidine');

    const listA = await orgA.app.request(
      `/patients/${patientA.id}/prescriptions`,
      { headers: authHeader(orgA.user.token) },
    );
    expect(listA.status).toBe(200);
    expect(((await listA.json()) as { total: number }).total).toBe(1);

    expect(
      (
        await orgA.app.request(`/patients/${patientB.id}/prescriptions`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await orgA.app.request(`/prescriptions/${rxB.prescription.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await orgA.app.request(`/prescriptions/${rxA.prescription.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);
    expect(
      await prisma.prescription.findUnique({
        where: { id: rxA.prescription.id },
      }),
    ).toBeNull();
    expect(
      await prisma.prescriptionItem.count({
        where: { prescriptionId: rxA.prescription.id },
      }),
    ).toBe(0);
  });

  it('assistant RBAC, search, validation, unauthenticated', async () => {
    const orgA = await bootstrapOrg('rx-assist@example.com');
    const assistant = await addAssistant(
      orgA.app,
      orgA.organization.id,
      'rx-assistant@example.com',
    );
    const patient = await createPatient(orgA.app, orgA.user.token);

    const created = await orgA.app.request(
      `/patients/${patient.id}/prescriptions`,
      {
        method: 'POST',
        headers: {
          ...authHeader(assistant.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rxBody()),
      },
    );
    expect(created.status).toBe(201);
    const rx = (await created.json()) as { prescription: { id: string } };

    expect(
      (
        await orgA.app.request(`/prescriptions/${rx.prescription.id}`, {
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
      'prescriptions.update',
      'DENY',
    );

    expect(
      (
        await orgA.app.request(`/prescriptions/${rx.prescription.id}`, {
          method: 'PATCH',
          headers: {
            ...authHeader(assistant.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ advice: 'Nope' }),
        })
      ).status,
    ).toBe(403);

    // ASSISTANT defaults lack prescriptions.delete
    expect(
      (
        await orgA.app.request(`/prescriptions/${rx.prescription.id}`, {
          method: 'DELETE',
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(403);

    await orgA.app.request(`/patients/${patient.id}/prescriptions`, {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        rxBody({
          date: '2026-09-03',
          title: 'Hygiène',
          lines: [
            {
              drug: 'Dentifrice fluoré',
              posology: '2x/j',
              duration: 'continu',
              notes: '',
            },
          ],
        }),
      ),
    });

    const byDate = await orgA.app.request(
      `/patients/${patient.id}/prescriptions?date=2026-09-02`,
      { headers: authHeader(orgA.user.token) },
    );
    expect(byDate.status).toBe(200);
    expect(((await byDate.json()) as { total: number }).total).toBe(1);

    const byQ = await orgA.app.request(
      `/patients/${patient.id}/prescriptions?q=Paracétamol`,
      { headers: authHeader(orgA.user.token) },
    );
    expect(byQ.status).toBe(200);
    expect(((await byQ.json()) as { total: number }).total).toBe(1);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/prescriptions`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rxBody({ date: '2026-13-40' })),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/prescriptions`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...rxBody(),
            lines: [],
          }),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/prescriptions`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...rxBody(),
            inventedField: true,
          }),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await orgA.app.request(
          `/patients/${patient.id}/prescriptions?limit=500`,
          { headers: authHeader(orgA.user.token) },
        )
      ).status,
    ).toBe(400);

    expect(
      (await orgA.app.request(`/patients/${patient.id}/prescriptions`)).status,
    ).toBe(401);

    await orgA.permissionService.setOverrideAsAdmin(
      { user: adminUser, membership: adminMembership, organization },
      assistant.membershipId,
      'prescriptions.read',
      'DENY',
    );
    expect(
      (
        await orgA.app.request(`/prescriptions/${rx.prescription.id}`, {
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(403);
  });

  it('patient hard-delete cascades prescriptions + lines', async () => {
    const orgA = await bootstrapOrg('rx-cascade@example.com');
    const patient = await createPatient(orgA.app, orgA.user.token);
    const created = await orgA.app.request(
      `/patients/${patient.id}/prescriptions`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgA.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rxBody()),
      },
    );
    const rx = (await created.json()) as { prescription: { id: string } };

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);

    expect(
      await prisma.prescription.findUnique({ where: { id: rx.prescription.id } }),
    ).toBeNull();
    expect(
      await prisma.prescriptionItem.count({
        where: { prescriptionId: rx.prescription.id },
      }),
    ).toBe(0);
  });

  it('schema includes Prescription models; excludes later domains', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = readFileSync(join(here, '..', 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toMatch(/model\s+Prescription\b/);
    expect(schema).toMatch(/model\s+PrescriptionItem\b/);
    expect(schema).toMatch(/model\s+AuditLog\b/);
  });
});
