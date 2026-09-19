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

const samplePatient = {
  firstName: 'Sophie',
  lastName: 'Martin',
  phone: '06 12 34 56 78',
  age: 34,
  address: '12 rue des Lilas',
  antecedents: 'Aucun',
  hasAllergies: false,
};

describe('Phase 1 patient archive + concurrency', () => {
  let prisma: Awaited<ReturnType<typeof startTestDatabase>>['prisma'];

  beforeAll(async () => {
    ;({ prisma } = await startTestDatabase());
  }, 120_000);

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await resetAuthTables(prisma);
  });

  async function bootstrapOrg(email: string) {
    const { app } = createTestApp(prisma);
    const user = await registerLogin(app, email, password);
    const created = await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${email} Cabinet` }),
    });
    expect(created.status).toBe(201);
    return { app, user };
  }

  it('DELETE archives patient; list hides it; GET keeps history; restore works', async () => {
    const { app, user } = await bootstrapOrg('archive-p1@example.com');
    const create = await app.request('/patients', {
      method: 'POST',
      headers: { ...authHeader(user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePatient),
    });
    expect(create.status).toBe(201);
    const { patient } = (await create.json()) as { patient: { id: string } };

    const del = await app.request(`/patients/${patient.id}`, {
      method: 'DELETE',
      headers: authHeader(user.token),
    });
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as {
      archived?: boolean;
      patient?: { archivedAt: string | null };
    };
    expect(delBody.archived).toBe(true);
    expect(delBody.patient?.archivedAt).toBeTruthy();

    const list = await app.request('/patients?limit=100', {
      headers: authHeader(user.token),
    });
    const listed = (await list.json()) as { items: { id: string }[] };
    expect(listed.items.find((p) => p.id === patient.id)).toBeUndefined();

    const get = await app.request(`/patients/${patient.id}`, {
      headers: authHeader(user.token),
    });
    expect(get.status).toBe(200);

    const withArchived = await app.request('/patients?includeArchived=true&limit=100', {
      headers: authHeader(user.token),
    });
    const archivedList = (await withArchived.json()) as { items: { id: string }[] };
    expect(archivedList.items.some((p) => p.id === patient.id)).toBe(true);

    const restore = await app.request(`/patients/${patient.id}/restore`, {
      method: 'POST',
      headers: authHeader(user.token),
    });
    expect(restore.status).toBe(200);

    const list2 = await app.request('/patients?limit=100', {
      headers: authHeader(user.token),
    });
    const listed2 = (await list2.json()) as { items: { id: string }[] };
    expect(listed2.items.some((p) => p.id === patient.id)).toBe(true);
  });

  it('rejects stale expectedUpdatedAt with 409 — no silent overwrite', async () => {
    const { app, user } = await bootstrapOrg('conflict-p1@example.com');
    const create = await app.request('/patients', {
      method: 'POST',
      headers: { ...authHeader(user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePatient),
    });
    const { patient: p1 } = (await create.json()) as {
      patient: { id: string; updatedAt: string };
    };

    const a = await app.request(`/patients/${p1.id}`, {
      method: 'PATCH',
      headers: { ...authHeader(user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '06 11 11 11 11', expectedUpdatedAt: p1.updatedAt }),
    });
    expect(a.status).toBe(200);
    const afterA = (await a.json()) as { patient: { phone: string } };
    expect(afterA.patient.phone).toBe('06 11 11 11 11');

    const b = await app.request(`/patients/${p1.id}`, {
      method: 'PATCH',
      headers: { ...authHeader(user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '06 22 22 22 22',
        expectedUpdatedAt: p1.updatedAt,
      }),
    });
    expect(b.status).toBe(409);
    const conflict = (await b.json()) as { error: { code: string } };
    expect(conflict.error.code).toBe('CONFLICT');

    const get = await app.request(`/patients/${p1.id}`, {
      headers: authHeader(user.token),
    });
    const current = (await get.json()) as { patient: { phone: string } };
    expect(current.patient.phone).toBe('06 11 11 11 11');
  });
});
