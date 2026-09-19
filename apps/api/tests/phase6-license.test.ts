/**
 * Phase 6 — license key format, binding gate, bootstrap, cross-tenant, TRUST_PROXY.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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
import {
  assertValidLicenseKeyFormat,
  normalizeLicenseKey,
  parseLicenseKeyInput,
} from '../src/organization/license-key.js';

const password = 'SecurePass12';

describe('phase 6 license key format', () => {
  it('normalizes and accepts DS-/LIC- style keys ≥12 chars', () => {
    expect(normalizeLicenseKey('  ds-boot-test-0001  ')).toBe('DS-BOOT-TEST-0001');
    expect(assertValidLicenseKeyFormat('ds-boot-test-0001')).toBe('DS-BOOT-TEST-0001');
    expect(parseLicenseKeyInput('LIC-TEST-0001').ok).toBe(true);
  });

  it('rejects short, empty, weak, and invalid charset keys', () => {
    expect(parseLicenseKeyInput('').ok).toBe(false);
    expect(parseLicenseKeyInput('SHORT').ok).toBe(false);
    expect(parseLicenseKeyInput('AAAAAAAAAAAA').ok).toBe(false);
    expect(parseLicenseKeyInput('bad key!!!!').ok).toBe(false);
  });
});

describe('phase 6 license binding + bootstrap', () => {
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

  it('valid bootstrap → login → logout → login keeps licensed access', async () => {
    const { app } = createTestApp(prisma);
    const licenseKey = 'DS-PHASE6-VALID01';
    const boot = await app.request('/auth/bootstrap-organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey,
        organizationName: 'Phase6 Clinic',
        adminEmail: 'p6-owner@example.com',
        adminPassword: password,
        adminName: 'Dr Phase Six',
      }),
    });
    expect(boot.status).toBe(201);
    const { token } = (await boot.json()) as { token: string };

    expect(
      (await app.request('/patients', { headers: authHeader(token) })).status,
    ).toBe(200);

    await app.request('/auth/logout', {
      method: 'POST',
      headers: authHeader(token),
    });

    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'p6-owner@example.com', password }),
    });
    expect(login.status).toBe(200);
    const { token: token2 } = (await login.json()) as { token: string };
    expect(
      (await app.request('/patients', { headers: authHeader(token2) })).status,
    ).toBe(200);
  });

  it('invalid / nonexistent / weak license keys are refused at bootstrap', async () => {
    const { app } = createTestApp(prisma);
    for (const licenseKey of ['', 'WEAK', '!!!!!!!!!!!!', 'AAAAAAAAAAAA']) {
      const res = await app.request('/auth/bootstrap-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          organizationName: 'X',
          adminEmail: `bad-${randomUUID()}@example.com`,
          adminPassword: password,
          adminName: 'Bad Key',
        }),
      });
      expect(res.status).toBe(400);
    }
  });

  it('org without binding cannot use tenant routes', async () => {
    const { app } = createTestApp(prisma);
    const user = await registerLogin(app, 'nobind@example.com', password);
    // Force-create org without license via prisma (bypass open-create attach)
    const orgId = randomUUID();
    await prisma.organization.create({
      data: {
        id: orgId,
        name: 'No License Org',
        slug: `no-lic-${orgId.slice(0, 8)}`,
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });
    await prisma.membership.create({
      data: {
        id: randomUUID(),
        userId: user.userId,
        organizationId: orgId,
        role: 'ADMIN',
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    const res = await app.request('/patients', {
      headers: authHeader(user.token),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('LICENSE_REQUIRED');
  });

  it('expired and revoked bindings refuse tenant access', async () => {
    const { app } = createTestApp(prisma);
    const boot = await app.request('/auth/bootstrap-organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: 'DS-PHASE6-EXPIRE01',
        organizationName: 'Expire Clinic',
        adminEmail: 'expire@example.com',
        adminPassword: password,
        adminName: 'Dr Expire',
      }),
    });
    const { token } = (await boot.json()) as { token: string };
    const org = await prisma.organization.findFirst({
      where: { name: 'Expire Clinic' },
    });

    await prisma.licenseBinding.update({
      where: { organizationId: org!.id },
      data: { status: 'EXPIRED' },
    });
    expect(
      (
        await app.request('/patients', { headers: authHeader(token) })
      ).status,
    ).toBe(403);

    await prisma.licenseBinding.update({
      where: { organizationId: org!.id },
      data: { status: 'DISABLED', expiresAt: null },
    });
    expect(
      (
        await app.request('/patients', { headers: authHeader(token) })
      ).status,
    ).toBe(403);
  });

  it('duplicate binding and cross-tenant license reuse are refused', async () => {
    const { app } = createTestApp(prisma);
    const key = 'DS-PHASE6-SHARED01';
    const first = await app.request('/auth/bootstrap-organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: key,
        organizationName: 'Org A',
        adminEmail: 'a-p6@example.com',
        adminPassword: password,
        adminName: 'Admin A',
      }),
    });
    expect(first.status).toBe(201);

    const second = await app.request('/auth/bootstrap-organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: key.toLowerCase(),
        organizationName: 'Org B',
        adminEmail: 'b-p6@example.com',
        adminPassword: password,
        adminName: 'Admin B',
      }),
    });
    expect(second.status).toBe(409);
  });

  it('TRUST_PROXY=false ignores spoofed X-Forwarded-For on license routes', async () => {
    const store = new MemoryRateLimitStore();
    const config = createTestConfig({
      AUTH_RATE_LIMIT_MAX: '3',
      AUTH_RATE_LIMIT_WINDOW_MS: '60000',
      TRUST_PROXY: 'false',
    });
    const { app } = createTestApp(prisma, { config, rateLimitStore: store });

    for (let i = 0; i < 3; i += 1) {
      const res = await app.request('/auth/onboarding-status?licenseKey=DS-PHASE6-RATE0001', {
        headers: { 'X-Forwarded-For': `203.0.113.${i}` },
      });
      expect([200, 400]).toContain(res.status);
    }
    const limited = await app.request(
      '/auth/onboarding-status?licenseKey=DS-PHASE6-RATE0001',
      { headers: { 'X-Forwarded-For': '198.51.100.9' } },
    );
    expect(limited.status).toBe(429);
  });
});
