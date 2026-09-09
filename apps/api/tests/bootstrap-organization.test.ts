import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  authHeader,
  createTestApp,
  resetAuthTables,
  startTestDatabase,
  stopTestDatabase,
} from './helpers/test-db.js';

const password = 'SecurePass1!';

describe('auth bootstrap-organization', () => {
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

  it('creates org + admin + dentist + license binding and returns session', async () => {
    const { app } = createTestApp(prisma);
    const licenseKey = 'DS-BOOT-TEST-0001';

    const statusBefore = await app.request(
      `/auth/onboarding-status?licenseKey=${encodeURIComponent(licenseKey)}`,
    );
    expect(statusBefore.status).toBe(200);
    const beforeBody = (await statusBefore.json()) as { registered: boolean };
    expect(beforeBody.registered).toBe(false);

    const res = await app.request('/auth/bootstrap-organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey,
        organizationName: 'Cabinet Bootstrap',
        adminEmail: 'owner@bootstrap.test',
        adminPassword: password,
        adminName: 'Dr Amine Benali',
        phone: '+213555000111',
        city: 'Alger',
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      ok: boolean;
      token: string;
      user: { email: string };
      organization: { name: string; phone: string | null; city: string | null };
      membership: { role: string };
      dentist: { firstName: string; lastName: string };
    };
    expect(body.ok).toBe(true);
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe('owner@bootstrap.test');
    expect(body.organization.name).toBe('Cabinet Bootstrap');
    expect(body.organization.phone).toBe('+213555000111');
    expect(body.organization.city).toBe('Alger');
    expect(body.membership.role).toBe('ADMIN');
    expect(body.dentist.firstName).toBe('Dr');
    expect(body.dentist.lastName).toBe('Amine Benali');

    const me = await app.request('/organization/me', {
      headers: authHeader(body.token),
    });
    expect(me.status).toBe(200);

    const dentists = await app.request('/dentists', {
      headers: authHeader(body.token),
    });
    expect(dentists.status).toBe(200);
    const dentistBody = (await dentists.json()) as { items: unknown[]; total: number };
    expect(dentistBody.total).toBeGreaterThanOrEqual(1);

    const statusAfter = await app.request(
      `/auth/onboarding-status?licenseKey=${encodeURIComponent(licenseKey)}`,
    );
    const afterBody = (await statusAfter.json()) as {
      registered: boolean;
      organizationName: string | null;
    };
    expect(afterBody.registered).toBe(true);
    expect(afterBody.organizationName).toBe('Cabinet Bootstrap');
  });

  it('rejects duplicate license and short password; login still works', async () => {
    const { app } = createTestApp(prisma);
    const licenseKey = 'DS-BOOT-TEST-0002';

    const first = await app.request('/auth/bootstrap-organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey,
        organizationName: 'Cabinet A',
        adminEmail: 'a@bootstrap.test',
        adminPassword: password,
        adminName: 'Admin One',
      }),
    });
    expect(first.status).toBe(201);

    const dup = await app.request('/auth/bootstrap-organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey,
        organizationName: 'Cabinet B',
        adminEmail: 'b@bootstrap.test',
        adminPassword: password,
        adminName: 'Admin Two',
      }),
    });
    expect(dup.status).toBe(409);

    const weak = await app.request('/auth/bootstrap-organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: 'DS-BOOT-TEST-0003',
        organizationName: 'Cabinet C',
        adminEmail: 'c@bootstrap.test',
        adminPassword: 'short',
        adminName: 'Admin Three',
      }),
    });
    expect(weak.status).toBe(400);

    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@bootstrap.test', password }),
    });
    expect(login.status).toBe(200);
  });
});
