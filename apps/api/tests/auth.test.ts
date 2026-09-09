import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isArgon2idHash } from '../src/auth/passwords.js';
import { hashToken } from '../src/auth/tokens.js';
import { MemoryRateLimitStore } from '../src/middleware/rate-limit.js';
import {
  authHeader,
  createTestApp,
  createTestConfig,
  resetAuthTables,
  startTestDatabase,
  stopTestDatabase,
} from './helpers/test-db.js';

const password = 'SecurePass1!';

describe('authentication foundation', () => {
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

  it('registers a valid user without organization', async () => {
    const { app } = createTestApp(prisma);
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Admin@Example.com', password }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      ok: boolean;
      user: { email: string; organizationId: null };
      organization: null;
      membership: null;
      message: string;
    };
    expect(body.ok).toBe(true);
    expect(body.user.email).toBe('admin@example.com');
    expect(body.organization).toBeNull();
    expect(body.membership).toBeNull();
    expect(body.user.organizationId).toBeNull();
    expect(body.message.toLowerCase()).toContain('no organization');
  });

  it('rejects duplicate email', async () => {
    const { app } = createTestApp(prisma);
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dup@example.com', password }),
    });
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'DUP@example.com', password }),
    });
    expect(res.status).toBe(409);
  });

  it('normalizes email and stores Argon2id hash only', async () => {
    const { app } = createTestApp(prisma);
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '  MixCase@Example.COM ', password }),
    });
    const user = await prisma.user.findUnique({ where: { email: 'mixcase@example.com' } });
    expect(user).toBeTruthy();
    expect(isArgon2idHash(user!.passwordHash)).toBe(true);
    expect(user!.passwordHash).not.toContain(password);
    expect(JSON.stringify(user)).not.toContain(password);
  });

  it('logs in successfully and never stores raw token', async () => {
    const { app } = createTestApp(prisma);
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'login@example.com', password }),
    });
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'login@example.com',
        password,
        device: { deviceIdentifier: 'dev-1', platform: 'test', name: 'Vitest' },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      token: string;
      user: Record<string, unknown>;
    };
    expect(body.token.length).toBeGreaterThan(20);
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(body)).not.toContain('tokenHash');
    expect(JSON.stringify(body)).not.toContain('passwordHash');

    const sessions = await prisma.session.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.tokenHash).toBe(hashToken(body.token));
    expect(sessions[0]!.tokenHash).not.toBe(body.token);
  });

  it('rejects invalid password and unknown user with same generic failure', async () => {
    const { app } = createTestApp(prisma);
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'known@example.com', password }),
    });

    const badPass = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'known@example.com', password: 'WrongPass!!' }),
    });
    const unknown = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'WrongPass!!' }),
    });

    expect(badPass.status).toBe(401);
    expect(unknown.status).toBe(401);
    const a = (await badPass.json()) as { error: { message: string; code: string } };
    const b = (await unknown.json()) as { error: { message: string; code: string } };
    expect(a.error.code).toBe('AUTH_FAILED');
    expect(b.error.code).toBe('AUTH_FAILED');
    expect(a.error.message).toBe(b.error.message);
  });

  it('blocks disabled users from login and existing sessions', async () => {
    const { app } = createTestApp(prisma);
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'disabled@example.com', password }),
    });
    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'disabled@example.com', password }),
    });
    const { token } = (await login.json()) as { token: string };

    await prisma.user.update({
      where: { email: 'disabled@example.com' },
      data: { status: 'DISABLED', disabledAt: new Date() },
    });

    const again = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'disabled@example.com', password }),
    });
    expect(again.status).toBe(401);

    const me = await app.request('/auth/me', { headers: authHeader(token) });
    expect(me.status).toBe(401);

    const refresh = await app.request('/auth/refresh', {
      method: 'POST',
      headers: authHeader(token),
    });
    expect(refresh.status).toBe(401);
  });

  it('returns /auth/me for valid token and 401 for invalid/malformed', async () => {
    const { app } = createTestApp(prisma);
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'me@example.com', password }),
    });
    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'me@example.com', password }),
    });
    const { token } = (await login.json()) as { token: string };

    const me = await app.request('/auth/me', { headers: authHeader(token) });
    expect(me.status).toBe(200);
    const body = (await me.json()) as {
      user: { email: string };
      auth: { userId: string; sessionId: string };
      organization: null;
    };
    expect(body.user.email).toBe('me@example.com');
    expect(body.auth.userId).toBeTruthy();
    expect(body.organization).toBeNull();

    const invalid = await app.request('/auth/me', {
      headers: authHeader('not-a-real-token'),
    });
    expect(invalid.status).toBe(401);

    const malformed = await app.request('/auth/me', {
      headers: { Authorization: 'Token abc' },
    });
    expect(malformed.status).toBe(401);
  });

  it('logout revokes session and is idempotent', async () => {
    const { app } = createTestApp(prisma);
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'out@example.com', password }),
    });
    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'out@example.com', password }),
    });
    const { token } = (await login.json()) as { token: string };

    const first = await app.request('/auth/logout', {
      method: 'POST',
      headers: authHeader(token),
    });
    const second = await app.request('/auth/logout', {
      method: 'POST',
      headers: authHeader(token),
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const me = await app.request('/auth/me', { headers: authHeader(token) });
    expect(me.status).toBe(401);
  });

  it('changes password, keeps current session, invalidates old password and other sessions', async () => {
    const { app } = createTestApp(prisma);
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pwd@example.com', password }),
    });
    const login1 = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pwd@example.com', password }),
    });
    const login2 = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pwd@example.com', password }),
    });
    const { token: token1 } = (await login1.json()) as { token: string };
    const { token: token2 } = (await login2.json()) as { token: string };

    const change = await app.request('/auth/change-password', {
      method: 'POST',
      headers: { ...authHeader(token1), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: password,
        newPassword: 'BrandNewPass2!',
      }),
    });
    expect(change.status).toBe(200);

    const me = await app.request('/auth/me', { headers: authHeader(token1) });
    expect(me.status).toBe(200);

    const other = await app.request('/auth/me', { headers: authHeader(token2) });
    expect(other.status).toBe(401);

    const oldLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pwd@example.com', password }),
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pwd@example.com', password: 'BrandNewPass2!' }),
    });
    expect(newLogin.status).toBe(200);
  });

  it('allows revoking own session/device and blocks cross-user revoke/list', async () => {
    const { app } = createTestApp(prisma);

    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', password }),
    });
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'b@example.com', password }),
    });

    const loginA1 = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'a@example.com',
        password,
        device: { deviceIdentifier: 'a-device' },
      }),
    });
    const loginA2 = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'a@example.com',
        password,
        device: { deviceIdentifier: 'a-device-2' },
      }),
    });
    const loginB = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'b@example.com',
        password,
        device: { deviceIdentifier: 'b-device' },
      }),
    });

    const a1 = (await loginA1.json()) as { token: string };
    const a2 = (await loginA2.json()) as { token: string };
    const b = (await loginB.json()) as { token: string };

    const sessionsA = (await (
      await app.request('/auth/sessions', { headers: authHeader(a1.token) })
    ).json()) as { sessions: { id: string }[] };
    const otherSessionId = sessionsA.sessions.find((s) => s.id)?.id;
    const sessionsDetail = await prisma.session.findMany({
      where: { tokenHash: hashToken(a2.token) },
    });
    const targetSessionId = sessionsDetail[0]!.id;

    const revokeOwn = await app.request('/auth/revoke-session', {
      method: 'POST',
      headers: { ...authHeader(a1.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: targetSessionId }),
    });
    expect(revokeOwn.status).toBe(200);
    expect((await app.request('/auth/me', { headers: authHeader(a2.token) })).status).toBe(401);

    const bSession = await prisma.session.findFirst({
      where: { tokenHash: hashToken(b.token) },
    });
    const cross = await app.request('/auth/revoke-session', {
      method: 'POST',
      headers: { ...authHeader(a1.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: bSession!.id }),
    });
    expect(cross.status).toBe(404);

    const bDevices = await prisma.device.findMany({
      where: { deviceIdentifier: 'b-device' },
    });
    const crossDevice = await app.request('/auth/revoke-device', {
      method: 'POST',
      headers: { ...authHeader(a1.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: bDevices[0]!.id }),
    });
    expect(crossDevice.status).toBe(404);

    const devicesA = (await (
      await app.request('/auth/devices', { headers: authHeader(a1.token) })
    ).json()) as { devices: { deviceIdentifier: string }[] };
    expect(devicesA.devices.every((d) => d.deviceIdentifier.startsWith('a-'))).toBe(true);
    expect(otherSessionId).toBeTruthy();
  });

  it('revokes device and all its sessions', async () => {
    const { app } = createTestApp(prisma);
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'device@example.com', password }),
    });
    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'device@example.com',
        password,
        device: { deviceIdentifier: 'tablet-1' },
      }),
    });
    const { token } = (await login.json()) as { token: string };
    const device = await prisma.device.findFirst({
      where: { deviceIdentifier: 'tablet-1' },
    });

    const revoke = await app.request('/auth/revoke-device', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: device!.id }),
    });
    expect(revoke.status).toBe(200);
    expect((await app.request('/auth/me', { headers: authHeader(token) })).status).toBe(401);
  });

  it('refresh extends expiry for active sessions', async () => {
    const { app } = createTestApp(prisma);
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'refresh@example.com', password }),
    });
    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'refresh@example.com', password }),
    });
    const { token } = (await login.json()) as { token: string };
    const before = await prisma.session.findFirst({
      where: { tokenHash: hashToken(token) },
    });

    const refreshed = await app.request('/auth/refresh', {
      method: 'POST',
      headers: authHeader(token),
    });
    expect(refreshed.status).toBe(200);
    const body = (await refreshed.json()) as { token: string; expiresAt: string };
    expect(body.token).toBe(token);

    const after = await prisma.session.findFirst({
      where: { tokenHash: hashToken(token) },
    });
    expect(after!.expiresAt.getTime()).toBeGreaterThanOrEqual(before!.expiresAt.getTime());
  });

  it('rejects expired sessions', async () => {
    const { app } = createTestApp(prisma);
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'exp@example.com', password }),
    });
    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'exp@example.com', password }),
    });
    const { token } = (await login.json()) as { token: string };

    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const me = await app.request('/auth/me', { headers: authHeader(token) });
    expect(me.status).toBe(401);
  });

  it('activates rate limiting on login', async () => {
    const store = new MemoryRateLimitStore();
    const config = createTestConfig({
      AUTH_RATE_LIMIT_MAX: '3',
      AUTH_RATE_LIMIT_WINDOW_MS: '60000',
    });
    const { app } = createTestApp(prisma, { config, rateLimitStore: store });

    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rate@example.com', password }),
    });

    for (let i = 0; i < 3; i += 1) {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'rate@example.com', password: 'WrongPass!!' }),
      });
      expect(res.status).toBe(401);
    }

    const limited = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rate@example.com', password: 'WrongPass!!' }),
    });
    expect(limited.status).toBe(429);
  });
});

describe('phase 2 schema boundaries', () => {
  it('keeps auth foundation models and includes audit trail', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = readFileSync(join(here, '..', 'prisma', 'schema.prisma'), 'utf8');

    expect(schema).toMatch(/model\s+User\b/);
    expect(schema).toMatch(/model\s+Session\b/);
    expect(schema).toMatch(/model\s+Device\b/);
    expect(schema).toMatch(/model\s+AuditLog\b/);
    expect(schema).toMatch(/username\s+String\?/);
  });
});
