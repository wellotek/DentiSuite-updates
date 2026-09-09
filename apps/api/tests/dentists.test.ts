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

describe('dentist cloud API (Phase 5E)', () => {
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

  function dentistBody(extra: Record<string, unknown> = {}) {
    return {
      firstName: 'Amine',
      lastName: 'El Amrani',
      specialty: 'Omnipratique',
      photo: '',
      color: '#0e628e',
      ...extra,
    };
  }

  it('CRUD + cross-tenant isolation + organizationId injection ignored', async () => {
    const orgA = await bootstrapOrg('dent-admin-a@example.com');
    const orgB = await bootstrapOrg('dent-admin-b@example.com');

    const createOk = await orgA.app.request('/dentists', {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...dentistBody(),
        organizationId: orgB.organization.id,
        userId: orgB.user.userId,
      }),
    });
    expect(createOk.status).toBe(201);
    const dentA = (await createOk.json()) as {
      dentist: {
        id: string;
        organizationId: string;
        displayName: string;
        color: string;
      };
    };
    expect(dentA.dentist.organizationId).toBe(orgA.organization.id);
    expect(dentA.dentist.displayName).toBe('Dr. Amine El Amrani');
    expect(dentA.dentist.color).toBe('#0e628e');

    const createB = await orgB.app.request('/dentists', {
      method: 'POST',
      headers: {
        ...authHeader(orgB.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        dentistBody({
          firstName: 'Sara',
          lastName: 'Morel',
          specialty: 'Pédodontie',
          color: '#7c3aed',
        }),
      ),
    });
    expect(createB.status).toBe(201);
    const dentB = (await createB.json()) as { dentist: { id: string } };

    expect(
      (
        await orgA.app.request(`/dentists/${dentA.dentist.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await orgA.app.request(`/dentists/${dentB.dentist.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    const patchOk = await orgA.app.request(`/dentists/${dentA.dentist.id}`, {
      method: 'PATCH',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        specialty: 'Orthodontie',
        organizationId: orgB.organization.id,
        id: dentB.dentist.id,
      }),
    });
    expect(patchOk.status).toBe(200);
    const patched = (await patchOk.json()) as {
      dentist: { id: string; specialty: string; organizationId: string };
    };
    expect(patched.dentist.id).toBe(dentA.dentist.id);
    expect(patched.dentist.specialty).toBe('Orthodontie');
    expect(patched.dentist.organizationId).toBe(orgA.organization.id);

    expect(
      (
        await orgA.app.request(`/dentists/${dentB.dentist.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await orgA.app.request(`/dentists/${dentA.dentist.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);
    expect(
      await prisma.dentist.findUnique({ where: { id: dentA.dentist.id } }),
    ).toBeNull();
  });

  it('assistant RBAC, filters, validation, delete clears assignments', async () => {
    const orgA = await bootstrapOrg('dent-assist@example.com');
    const assistant = await addAssistant(
      orgA.app,
      orgA.organization.id,
      'dent-assistant@example.com',
    );

    // ASSISTANT lacks dentists.create
    expect(
      (
        await orgA.app.request('/dentists', {
          method: 'POST',
          headers: {
            ...authHeader(assistant.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dentistBody()),
        })
      ).status,
    ).toBe(403);

    const created = await orgA.app.request('/dentists', {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dentistBody()),
    });
    expect(created.status).toBe(201);
    const dent = (await created.json()) as { dentist: { id: string } };

    expect(
      (
        await orgA.app.request(`/dentists/${dent.dentist.id}`, {
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await orgA.app.request(`/dentists/${dent.dentist.id}`, {
          method: 'PATCH',
          headers: {
            ...authHeader(assistant.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ specialty: 'Nope' }),
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await orgA.app.request(`/dentists/${dent.dentist.id}`, {
          method: 'DELETE',
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(403);

    await orgA.app.request('/dentists', {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        dentistBody({
          firstName: 'Sara',
          lastName: 'Morel',
          specialty: 'Pédodontie',
          color: '#7C3AED',
        }),
      ),
    });

    const bySpecialty = await orgA.app.request(
      '/dentists?specialty=Pédodontie',
      { headers: authHeader(orgA.user.token) },
    );
    expect(bySpecialty.status).toBe(200);
    expect(((await bySpecialty.json()) as { total: number }).total).toBe(1);

    const byQ = await orgA.app.request('/dentists?q=Amine', {
      headers: authHeader(orgA.user.token),
    });
    expect(byQ.status).toBe(200);
    expect(((await byQ.json()) as { total: number }).total).toBe(1);

    expect(
      (
        await orgA.app.request('/dentists', {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dentistBody({ color: 'blue' })),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await orgA.app.request('/dentists', {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...dentistBody(), invented: true }),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await orgA.app.request('/dentists?limit=500', {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(400);

    expect((await orgA.app.request('/dentists')).status).toBe(401);

    // Assignment clearing on delete (Patient + Appointment), not Prescription
    const patientRes = await orgA.app.request('/patients', {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...samplePatient,
        dentistId: dent.dentist.id,
      }),
    });
    expect(patientRes.status).toBe(201);
    const patient = (await patientRes.json()) as { patient: { id: string } };

    const aptRes = await orgA.app.request('/appointments', {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: '2026-09-02',
        time: '09:00',
        durationMin: 30,
        patientId: patient.patient.id,
        motif: 'Contrôle',
        practitioner: 'Dr. Amine El Amrani',
        dentistId: dent.dentist.id,
        status: 'confirme',
        category: 'controle',
      }),
    });
    expect(aptRes.status).toBe(201);
    const apt = (await aptRes.json()) as { appointment: { id: string } };

    const rxRes = await orgA.app.request(
      `/patients/${patient.patient.id}/prescriptions`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgA.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: '2026-09-02',
          title: 'Ordonnance',
          dentistId: dent.dentist.id,
          dentistName: 'Dr. Amine El Amrani',
          lines: [
            {
              drug: 'Paracétamol 1 g',
              posology: '1 cp',
              duration: '3j',
              notes: '',
            },
          ],
        }),
      },
    );
    expect(rxRes.status).toBe(201);
    const rx = (await rxRes.json()) as { prescription: { id: string } };

    expect(
      (
        await orgA.app.request(`/dentists/${dent.dentist.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);

    const patientAfter = await prisma.patient.findUniqueOrThrow({
      where: { id: patient.patient.id },
    });
    expect(patientAfter.dentistId).toBeNull();

    const aptAfter = await prisma.appointment.findUniqueOrThrow({
      where: { id: apt.appointment.id },
    });
    expect(aptAfter.dentistId).toBeNull();
    expect(aptAfter.practitioner).toBe('');

    const rxAfter = await prisma.prescription.findUniqueOrThrow({
      where: { id: rx.prescription.id },
    });
    expect(rxAfter.dentistId).toBe(dent.dentist.id);
    expect(rxAfter.dentistName).toBe('Dr. Amine El Amrani');
  });

  it('schema includes Dentist; excludes later domains; no User FK', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = readFileSync(join(here, '..', 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toMatch(/model\s+Dentist\b/);
    expect(schema).not.toMatch(/model\s+Dentist\b[\s\S]*?userId/);
    expect(schema).toMatch(/model\s+AuditLog\b/);
  });
});
