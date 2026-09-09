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

describe('billing / invoice cloud API (Phase 5G)', () => {
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

  function invoiceBody(extra: Record<string, unknown> = {}) {
    return {
      label: 'Détartrage',
      amount: 4000,
      paid: true,
      date: '2026-09-02',
      ...extra,
    };
  }

  it('CRUD + cross-tenant isolation + treatment relation', async () => {
    const orgA = await bootstrapOrg('bill-admin-a@example.com');
    const orgB = await bootstrapOrg('bill-admin-b@example.com');
    const patientA = await createPatient(orgA.app, orgA.user.token);
    const patientB = await createPatient(orgB.app, orgB.user.token, {
      firstName: 'Karim',
      lastName: 'Benali',
    });

    const treatRes = await orgA.app.request(`/patients/${patientA.id}/treatments`, {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: '2026-09-02',
        tooth: '16',
        act: 'Composite',
        code: 'SB1',
        cost: 6000,
        careStatus: 'fait',
        paymentStatus: 'paye',
      }),
    });
    expect(treatRes.status).toBe(201);
    const treatment = (await treatRes.json()) as { treatment: { id: string } };

    const createOk = await orgA.app.request(
      `/patients/${patientA.id}/invoices`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgA.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...invoiceBody({ treatmentId: treatment.treatment.id }),
          organizationId: orgB.organization.id,
          userId: orgB.user.userId,
          patientName: 'Forged',
        }),
      },
    );
    expect(createOk.status).toBe(201);
    const invA = (await createOk.json()) as {
      invoice: {
        id: string;
        organizationId: string;
        patientName: string;
        amount: number;
        currency: string;
        treatmentId: string | null;
      };
    };
    expect(invA.invoice.organizationId).toBe(orgA.organization.id);
    expect(invA.invoice.patientName).toContain('Sophie');
    expect(invA.invoice.amount).toBe(4000);
    expect(invA.invoice.currency).toBe('DA');
    expect(invA.invoice.treatmentId).toBe(treatment.treatment.id);

    expect(
      (
        await orgA.app.request(`/patients/${patientB.id}/invoices`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invoiceBody()),
        })
      ).status,
    ).toBe(404);

    const createB = await orgB.app.request(
      `/patients/${patientB.id}/invoices`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgB.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoiceBody({ label: 'Org B', amount: 1500 })),
      },
    );
    expect(createB.status).toBe(201);
    const invB = (await createB.json()) as { invoice: { id: string } };

    expect(
      (
        await orgA.app.request(`/invoices/${invA.invoice.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await orgA.app.request(`/invoices/${invB.invoice.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await orgA.app.request(`/invoices/${invA.invoice.id}`, {
          method: 'PATCH',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ patientId: patientB.id }),
        })
      ).status,
    ).toBe(404);

    // Cross-org treatment on invoice
    const treatB = await orgB.app.request(`/patients/${patientB.id}/treatments`, {
      method: 'POST',
      headers: {
        ...authHeader(orgB.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: '2026-09-02',
        tooth: '26',
        act: 'Composite',
        code: 'X',
        cost: 1000,
        careStatus: 'a_faire',
        paymentStatus: 'en_attente',
      }),
    });
    const treatBBody = (await treatB.json()) as { treatment: { id: string } };
    expect(
      (
        await orgA.app.request(`/patients/${patientA.id}/invoices`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            invoiceBody({ treatmentId: treatBBody.treatment.id }),
          ),
        })
      ).status,
    ).toBe(404);

    const patchOk = await orgA.app.request(`/invoices/${invA.invoice.id}`, {
      method: 'PATCH',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paid: false,
        amount: 4500,
        organizationId: orgB.organization.id,
        id: invB.invoice.id,
      }),
    });
    expect(patchOk.status).toBe(200);
    const patched = (await patchOk.json()) as {
      invoice: { id: string; paid: boolean; amount: number; organizationId: string };
    };
    expect(patched.invoice.id).toBe(invA.invoice.id);
    expect(patched.invoice.paid).toBe(false);
    expect(patched.invoice.amount).toBe(4500);
    expect(patched.invoice.organizationId).toBe(orgA.organization.id);

    const list = await orgA.app.request('/invoices?paid=false', {
      headers: authHeader(orgA.user.token),
    });
    expect(list.status).toBe(200);
    expect(((await list.json()) as { total: number }).total).toBe(1);

    expect(
      (
        await orgA.app.request(`/invoices/${invB.invoice.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await orgA.app.request(`/invoices/${invA.invoice.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);
    expect(
      await prisma.invoice.findUnique({ where: { id: invA.invoice.id } }),
    ).toBeNull();
  });

  it('assistant has no billing by default; money validation', async () => {
    const orgA = await bootstrapOrg('bill-assist@example.com');
    const assistant = await addAssistant(
      orgA.app,
      orgA.organization.id,
      'bill-assistant@example.com',
    );
    const patient = await createPatient(orgA.app, orgA.user.token);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/invoices`, {
          method: 'POST',
          headers: {
            ...authHeader(assistant.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invoiceBody()),
        })
      ).status,
    ).toBe(403);

    const created = await orgA.app.request(`/patients/${patient.id}/invoices`, {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoiceBody()),
    });
    expect(created.status).toBe(201);
    const inv = (await created.json()) as { invoice: { id: string } };

    expect(
      (
        await orgA.app.request(`/invoices/${inv.invoice.id}`, {
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await orgA.app.request(`/invoices/${inv.invoice.id}`, {
          method: 'PATCH',
          headers: {
            ...authHeader(assistant.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ paid: false }),
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await orgA.app.request(`/invoices/${inv.invoice.id}`, {
          method: 'DELETE',
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/invoices`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invoiceBody({ amount: 12.5 })),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/invoices`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invoiceBody({ amount: 0 })),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/invoices`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invoiceBody({ amount: -100 })),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await orgA.app.request(`/patients/${patient.id}/invoices`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...invoiceBody(), invented: true }),
        })
      ).status,
    ).toBe(400);

    expect((await orgA.app.request('/invoices')).status).toBe(401);
  });

  it('schema includes Invoice; no Payment model', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = readFileSync(join(here, '..', 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toMatch(/model\s+Invoice\b/);
    expect(schema).not.toMatch(/model\s+Payment\b/);
    expect(schema).toMatch(/model\s+AuditLog\b/);
  });
});
