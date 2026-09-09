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

describe('stock + prosthesis cloud API (Phase 5H)', () => {
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

  function stockBody(extra: Record<string, unknown> = {}) {
    return {
      code: 'comp-a2',
      name: 'Composite nano-hybride A2',
      category: 'consommable',
      quantity: 4,
      minQuantity: 6,
      unitPrice: 8500,
      addedAt: '2026-03-12',
      expiryDate: '2027-02-15',
      supplier: 'Dental Algérie',
      ...extra,
    };
  }

  function prosthesisBody(extra: Record<string, unknown> = {}) {
    return {
      type: 'Couronne zircone',
      tooth: '16',
      lab: 'Laboratoire Atlas',
      sentAt: '2026-08-12',
      expectedAt: '2026-08-26',
      notes: 'Teinte A3',
      status: 'fabrication',
      ...extra,
    };
  }

  it('stock CRUD + tenant isolation + quantity/price validation', async () => {
    const orgA = await bootstrapOrg('st-admin-a@example.com');
    const orgB = await bootstrapOrg('st-admin-b@example.com');
    const assistant = await addAssistant(
      orgA.app,
      orgA.organization.id,
      'st-assistant@example.com',
    );

    const createOk = await orgA.app.request('/stock', {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...stockBody(),
        organizationId: orgB.organization.id,
        userId: orgB.user.userId,
      }),
    });
    expect(createOk.status).toBe(201);
    const itemA = (await createOk.json()) as {
      item: { id: string; organizationId: string; code: string };
    };
    expect(itemA.item.organizationId).toBe(orgA.organization.id);
    expect(itemA.item.code).toBe('COMP-A2');

    expect(
      (
        await orgA.app.request('/stock', {
          method: 'POST',
          headers: {
            ...authHeader(assistant.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(stockBody({ code: 'X1' })),
        })
      ).status,
    ).toBe(403);

    const createB = await orgB.app.request('/stock', {
      method: 'POST',
      headers: {
        ...authHeader(orgB.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stockBody({ code: 'GNT-100', name: 'Gants' })),
    });
    const itemB = (await createB.json()) as { item: { id: string } };

    expect(
      (
        await orgA.app.request(`/stock/${itemA.item.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await orgA.app.request(`/stock/${itemB.item.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await orgA.app.request(`/stock/${itemA.item.id}`, {
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await orgA.app.request(`/stock/${itemA.item.id}`, {
          method: 'PATCH',
          headers: {
            ...authHeader(assistant.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ quantity: 10 }),
        })
      ).status,
    ).toBe(403);

    const patchOk = await orgA.app.request(`/stock/${itemA.item.id}`, {
      method: 'PATCH',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quantity: 10,
        organizationId: orgB.organization.id,
      }),
    });
    expect(patchOk.status).toBe(200);
    expect(((await patchOk.json()) as { item: { quantity: number } }).item.quantity).toBe(10);

    expect(
      (
        await orgA.app.request('/stock', {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(stockBody({ quantity: -1 })),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await orgA.app.request('/stock', {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(stockBody({ unitPrice: 12.5 })),
        })
      ).status,
    ).toBe(400);

    await orgA.app.request('/stock', {
      method: 'POST',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        stockBody({ code: 'MSK-50', name: 'Masques', category: 'hygiene' }),
      ),
    });
    const byCat = await orgA.app.request('/stock?category=hygiene', {
      headers: authHeader(orgA.user.token),
    });
    expect(((await byCat.json()) as { total: number }).total).toBe(1);
    const byQ = await orgA.app.request('/stock?q=Composite', {
      headers: authHeader(orgA.user.token),
    });
    expect(((await byQ.json()) as { total: number }).total).toBe(1);
    expect(
      (
        await orgA.app.request('/stock?limit=500', {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await orgA.app.request(`/stock/${itemB.item.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await orgA.app.request(`/stock/${itemA.item.id}`, {
          method: 'DELETE',
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await orgA.app.request(`/stock/${itemA.item.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);
    expect(await prisma.stockItem.findUnique({ where: { id: itemA.item.id } })).toBeNull();
    expect((await orgA.app.request('/stock')).status).toBe(401);
  });

  it('prosthesis CRUD + patient tenant isolation + patients.* RBAC', async () => {
    const orgA = await bootstrapOrg('pr-admin-a@example.com');
    const orgB = await bootstrapOrg('pr-admin-b@example.com');
    const assistant = await addAssistant(
      orgA.app,
      orgA.organization.id,
      'pr-assistant@example.com',
    );
    const patientA = await createPatient(orgA.app, orgA.user.token);
    const patientB = await createPatient(orgB.app, orgB.user.token, {
      firstName: 'Karim',
      lastName: 'Benali',
    });

    const createOk = await orgA.app.request(
      `/patients/${patientA.id}/prostheses`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgA.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...prosthesisBody(),
          organizationId: orgB.organization.id,
          userId: orgB.user.userId,
        }),
      },
    );
    expect(createOk.status).toBe(201);
    const prA = (await createOk.json()) as {
      prosthesis: { id: string; organizationId: string; patientName: string };
    };
    expect(prA.prosthesis.organizationId).toBe(orgA.organization.id);
    expect(prA.prosthesis.patientName).toContain('Sophie');

    expect(
      (
        await orgA.app.request(`/patients/${patientB.id}/prostheses`, {
          method: 'POST',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(prosthesisBody()),
        })
      ).status,
    ).toBe(404);

    const assistCreate = await orgA.app.request(
      `/patients/${patientA.id}/prostheses`,
      {
        method: 'POST',
        headers: {
          ...authHeader(assistant.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prosthesisBody({ tooth: '26' })),
      },
    );
    expect(assistCreate.status).toBe(201);

    const createB = await orgB.app.request(
      `/patients/${patientB.id}/prostheses`,
      {
        method: 'POST',
        headers: {
          ...authHeader(orgB.user.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prosthesisBody({ type: 'Bridge' })),
      },
    );
    const prB = (await createB.json()) as { prosthesis: { id: string } };

    expect(
      (
        await orgA.app.request(`/prostheses/${prA.prosthesis.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await orgA.app.request(`/prostheses/${prB.prosthesis.id}`, {
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await orgA.app.request(`/prostheses/${prA.prosthesis.id}`, {
          method: 'PATCH',
          headers: {
            ...authHeader(orgA.user.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ patientId: patientB.id }),
        })
      ).status,
    ).toBe(404);

    const patchOk = await orgA.app.request(`/prostheses/${prA.prosthesis.id}`, {
      method: 'PATCH',
      headers: {
        ...authHeader(orgA.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'recu', organizationId: orgB.organization.id }),
    });
    expect(patchOk.status).toBe(200);
    expect(
      ((await patchOk.json()) as { prosthesis: { status: string } }).prosthesis.status,
    ).toBe('recu');

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
    expect(
      (
        await orgA.app.request(`/prostheses/${prA.prosthesis.id}`, {
          method: 'PATCH',
          headers: {
            ...authHeader(assistant.token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notes: 'Nope' }),
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await orgA.app.request(`/prostheses/${prA.prosthesis.id}`, {
          method: 'DELETE',
          headers: authHeader(assistant.token),
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await orgA.app.request(`/prostheses/${prB.prosthesis.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await orgA.app.request(`/prostheses/${prA.prosthesis.id}`, {
          method: 'DELETE',
          headers: authHeader(orgA.user.token),
        })
      ).status,
    ).toBe(200);
    expect(
      await prisma.prosthesis.findUnique({ where: { id: prA.prosthesis.id } }),
    ).toBeNull();
    expect(
      await prisma.patient.findUnique({ where: { id: patientA.id } }),
    ).not.toBeNull();

    expect((await orgA.app.request('/prostheses')).status).toBe(401);
  });

  it('schema includes StockItem + Prosthesis; excludes later domains', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = readFileSync(join(here, '..', 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toMatch(/model\s+StockItem\b/);
    expect(schema).toMatch(/model\s+Prosthesis\b/);
    for (const model of ['ImagingStudy', 'Warehouse', 'StockMovement']) {
      expect(schema).not.toMatch(new RegExp(`model\\s+${model}\\b`));
    }
    expect(schema).toMatch(/model\s+AuditLog\b/);
  });
});
