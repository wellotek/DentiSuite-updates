/**
 * Phase 5 — hardening regressions (API).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  authHeader,
  createTestApp,
  createTestConfig,
  registerLogin,
  resetAuthTables,
  startTestDatabase,
  stopTestDatabase,
} from './helpers/test-db.js';
import { MemoryRateLimitStore } from '../src/middleware/rate-limit.js';
import type { PrismaClient } from '@prisma/client';

const password = 'SecurePass12';

describe('phase 5 hardening', () => {
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

  it('rate limit ignores spoofed X-Forwarded-For when TRUST_PROXY is off', async () => {
    const store = new MemoryRateLimitStore();
    const config = createTestConfig({
      AUTH_RATE_LIMIT_MAX: '3',
      AUTH_RATE_LIMIT_WINDOW_MS: '60000',
      TRUST_PROXY: 'false',
    });
    const { app } = createTestApp(prisma, { config, rateLimitStore: store });

    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'xff@example.com', password }),
    });

    for (let i = 0; i < 3; i += 1) {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `203.0.113.${i}`,
        },
        body: JSON.stringify({ email: 'xff@example.com', password: 'WrongPass!!' }),
      });
      expect(res.status).toBe(401);
    }

    const limited = await app.request('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.9',
      },
      body: JSON.stringify({ email: 'xff@example.com', password: 'WrongPass!!' }),
    });
    expect(limited.status).toBe(429);
  });

  it('blocks open org create when ALLOW_OPEN_ORG_CREATE=false', async () => {
    const config = createTestConfig({ ALLOW_OPEN_ORG_CREATE: 'false' });
    const { app } = createTestApp(prisma, { config });
    const user = await registerLogin(app, 'no-org@example.com', password);

    const res = await app.request('/organization', {
      method: 'POST',
      headers: {
        ...authHeader(user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Should Fail' }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('ORG_BOOTSTRAP_REQUIRED');
  });

  it('login → session → logout → token rejected', async () => {
    const { app } = createTestApp(prisma);
    const user = await registerLogin(app, 'session@example.com', password);

    const me = await app.request('/auth/me', {
      headers: authHeader(user.token),
    });
    expect(me.status).toBe(200);

    const logout = await app.request('/auth/logout', {
      method: 'POST',
      headers: authHeader(user.token),
    });
    expect(logout.status).toBe(200);

    const after = await app.request('/auth/me', {
      headers: authHeader(user.token),
    });
    expect(after.status).toBe(401);
  });

  it('patient archive → restore → purge requires archive', async () => {
    const { app } = createTestApp(prisma);
    const user = await registerLogin(app, 'archive@example.com', password);
    await app.request('/organization', {
      method: 'POST',
      headers: {
        ...authHeader(user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Archive Clinic' }),
    });

    const created = await app.request('/patients', {
      method: 'POST',
      headers: {
        ...authHeader(user.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '0555',
        age: 36,
        address: '',
        antecedents: '',
        hasAllergies: false,
      }),
    });
    expect(created.status).toBe(201);
    const { patient } = (await created.json()) as { patient: { id: string } };

    expect(
      (
        await app.request(`/patients/${patient.id}/purge`, {
          method: 'POST',
          headers: authHeader(user.token),
        })
      ).status,
    ).toBe(409);

    expect(
      (
        await app.request(`/patients/${patient.id}`, {
          method: 'DELETE',
          headers: authHeader(user.token),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await app.request(`/patients/${patient.id}/restore`, {
          method: 'POST',
          headers: authHeader(user.token),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await app.request(`/patients/${patient.id}`, {
          method: 'DELETE',
          headers: authHeader(user.token),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await app.request(`/patients/${patient.id}/purge`, {
          method: 'POST',
          headers: authHeader(user.token),
        })
      ).status,
    ).toBe(200);
  });
});
