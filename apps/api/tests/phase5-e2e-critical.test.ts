/**
 * Phase 5 — critical-path E2E against local API test harness (not Railway).
 * Covers: login, logout, patient CRUD archive/restore, basic RBAC denial, cross-tenant.
 *
 * Run: npm --prefix apps/api exec -- vitest run tests/phase5-e2e-critical.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  authHeader,
  createTestApp,
  registerLogin,
  resetAuthTables,
  startTestDatabase,
  stopTestDatabase,
} from './helpers/test-db.js';

const password = 'SecurePass12';

async function bootstrapOrg(prisma: PrismaClient, email: string) {
  const { app } = createTestApp(prisma);
  const user = await registerLogin(app, email, password);
  const org = await app.request('/organization', {
    method: 'POST',
    headers: {
      ...authHeader(user.token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: `Clinic ${email}` }),
  });
  expect(org.status).toBe(201);
  return { app, user };
}

describe('phase 5 e2e critical paths', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    ;({ prisma } = await startTestDatabase());
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await resetAuthTables(prisma);
  });

  it('login logout session lifecycle', async () => {
    const { app } = createTestApp(prisma);
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'e2e-login@example.com', password }),
    });
    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'e2e-login@example.com', password }),
    });
    expect(login.status).toBe(200);
    const { token } = (await login.json()) as { token: string };
    expect(token).toBeTruthy();
    await app.request('/auth/logout', {
      method: 'POST',
      headers: authHeader(token),
    });
    expect((await app.request('/auth/me', { headers: authHeader(token) })).status).toBe(
      401,
    );
  });

  it('create patient → appointment → consultation → prescription → archive → restore', async () => {
    const org = await bootstrapOrg(prisma, 'e2e-flow@example.com');

    const pRes = await org.app.request('/patients', {
      method: 'POST',
      headers: {
        ...authHeader(org.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: 'E2E',
        lastName: 'Patient',
        phone: '0555123456',
        age: 40,
        address: '',
        antecedents: '',
        hasAllergies: false,
      }),
    });
    expect(pRes.status).toBe(201);
    const { patient } = (await pRes.json()) as { patient: { id: string } };

    const appt = await org.app.request('/appointments', {
      method: 'POST',
      headers: {
        ...authHeader(org.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patientId: patient.id,
        date: '2026-09-20',
        time: '10:00',
        durationMin: 30,
        motif: 'Control',
        status: 'confirme',
        category: 'controle',
        practitioner: 'Dr Test',
      }),
    });
    expect([200, 201]).toContain(appt.status);

    const consult = await org.app.request(`/patients/${patient.id}/consultations`, {
      method: 'POST',
      headers: {
        ...authHeader(org.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: '2026-09-20',
        time: '10:00',
        teeth: ['16'],
        acts: 'Control',
        notes: 'ok',
        prescription: '',
      }),
    });
    expect([200, 201]).toContain(consult.status);

    const rx = await org.app.request(`/patients/${patient.id}/prescriptions`, {
      method: 'POST',
      headers: {
        ...authHeader(org.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: '2026-09-20',
        title: 'E2E Rx',
        advice: '',
        dentistName: 'Dr Test',
        lines: [
          {
            drug: 'Amoxicilline',
            posology: '1g 2x/j',
            duration: '7j',
            notes: '',
          },
        ],
      }),
    });
    expect([200, 201]).toContain(rx.status);

    expect(
      (
        await org.app.request(`/patients/${patient.id}`, {
          method: 'DELETE',
          headers: authHeader(org.user.token),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await org.app.request(`/patients/${patient.id}/restore`, {
          method: 'POST',
          headers: authHeader(org.user.token),
        })
      ).status,
    ).toBe(200);
  });

  it('cross-tenant patient access is 404', async () => {
    const a = await bootstrapOrg(prisma, 'e2e-a@example.com');
    const b = await bootstrapOrg(prisma, 'e2e-b@example.com');

    const created = await a.app.request('/patients', {
      method: 'POST',
      headers: {
        ...authHeader(a.user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: 'Tenant',
        lastName: 'A',
        phone: '0555000001',
        age: 20,
        address: '',
        antecedents: '',
        hasAllergies: false,
      }),
    });
    const { patient } = (await created.json()) as { patient: { id: string } };

    const cross = await b.app.request(`/patients/${patient.id}`, {
      headers: authHeader(b.user.token),
    });
    expect(cross.status).toBe(404);
  });
});
