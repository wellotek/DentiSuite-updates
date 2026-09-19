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
  firstName: 'Bulk',
  lastName: 'Patient',
  phone: '06 11 22 33 44',
  age: 40,
  address: '1 rue Bulk',
  antecedents: 'Aucun',
  hasAllergies: false,
};

describe('Phase 4 org-wide bulk lists', () => {
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
    const { app } = createTestApp(prisma);
    const user = await registerLogin(app, email, password);
    const created = await app.request('/organization', {
      method: 'POST',
      headers: { ...authHeader(user.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${email} Cabinet` }),
    });
    const body = (await created.json()) as {
      organization: { id: string };
    };
    return { app, user, organization: body.organization };
  }

  it('lists consultations/treatments/prescriptions/media by org; cross-tenant isolated', async () => {
    const orgA = await bootstrapOrg('bulk-a@example.com');
    const orgB = await bootstrapOrg('bulk-b@example.com');

    const createPat = await orgA.app.request('/patients', {
      method: 'POST',
      headers: { ...authHeader(orgA.user.token), 'content-type': 'application/json' },
      body: JSON.stringify(samplePatient),
    });
    expect(createPat.status).toBe(201);
    const patient = ((await createPat.json()) as { patient: { id: string } }).patient;

    const consult = await orgA.app.request(`/patients/${patient.id}/consultations`, {
      method: 'POST',
      headers: { ...authHeader(orgA.user.token), 'content-type': 'application/json' },
      body: JSON.stringify({
        date: '2026-09-15',
        time: '10:00',
        teeth: [],
        acts: 'Controle',
        notes: 'ok',
        prescription: '',
      }),
    });
    expect(consult.status).toBe(201);

    const treat = await orgA.app.request(`/patients/${patient.id}/treatments`, {
      method: 'POST',
      headers: { ...authHeader(orgA.user.token), 'content-type': 'application/json' },
      body: JSON.stringify({
        date: '2026-09-15',
        tooth: '16',
        act: 'Obturation',
        code: 'SOIN',
        cost: 1000,
        comment: '',
        careStatus: 'a_faire',
        paymentStatus: 'en_attente',
      }),
    });
    expect(treat.status).toBe(201);

    const rx = await orgA.app.request(`/patients/${patient.id}/prescriptions`, {
      method: 'POST',
      headers: { ...authHeader(orgA.user.token), 'content-type': 'application/json' },
      body: JSON.stringify({
        date: '2026-09-15',
        title: 'Ordonnance bulk',
        advice: '',
        dentistName: 'Dr A',
        lines: [{ drug: 'Amox', posology: '2/j', duration: '7j', notes: '' }],
      }),
    });
    expect(rx.status).toBe(201);

    const listC = await orgA.app.request('/consultations?limit=100', {
      headers: authHeader(orgA.user.token),
    });
    expect(listC.status).toBe(200);
    const bodyC = (await listC.json()) as {
      items: { patientId: string; organizationId: string }[];
    };
    expect(bodyC.items.some((i) => i.patientId === patient.id)).toBe(true);
    expect(bodyC.items.every((i) => i.organizationId === orgA.organization.id)).toBe(
      true,
    );

    const listT = await orgA.app.request('/treatments?limit=100', {
      headers: authHeader(orgA.user.token),
    });
    expect(listT.status).toBe(200);
    const bodyT = (await listT.json()) as { items: { patientId: string }[] };
    expect(bodyT.items.some((i) => i.patientId === patient.id)).toBe(true);

    const listP = await orgA.app.request('/prescriptions?limit=100', {
      headers: authHeader(orgA.user.token),
    });
    expect(listP.status).toBe(200);
    const bodyP = (await listP.json()) as { items: { patientId: string }[] };
    expect(bodyP.items.some((i) => i.patientId === patient.id)).toBe(true);

    const listM = await orgA.app.request('/media?limit=100', {
      headers: authHeader(orgA.user.token),
    });
    expect(listM.status).toBe(200);
    const bodyM = (await listM.json()) as { items: unknown[]; ok: boolean };
    expect(bodyM.ok).toBe(true);
    expect(Array.isArray(bodyM.items)).toBe(true);
    // Metadata only — no storage keys / binaries in public list items
    for (const item of bodyM.items as Record<string, unknown>[]) {
      expect(item.storageKey).toBeUndefined();
      expect(item.uploadUrl).toBeUndefined();
    }

    const crossC = await orgB.app.request('/consultations?limit=100', {
      headers: authHeader(orgB.user.token),
    });
    expect(crossC.status).toBe(200);
    const crossBody = (await crossC.json()) as { items: { patientId: string }[] };
    expect(crossBody.items.some((i) => i.patientId === patient.id)).toBe(false);

    const crossP = await orgB.app.request('/prescriptions?limit=100', {
      headers: authHeader(orgB.user.token),
    });
    const crossPBody = (await crossP.json()) as { items: { patientId: string }[] };
    expect(crossPBody.items.some((i) => i.patientId === patient.id)).toBe(false);

    const unauth = await orgA.app.request('/consultations');
    expect(unauth.status).toBe(401);
  }, 60_000);
});
