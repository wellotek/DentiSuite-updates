/**
 * Phase 5 — local API micro-benchmark (PGlite). Never hit Railway production.
 * Usage: cd apps/api && npx tsx scripts/bench-local.ts
 */
import { performance } from 'node:perf_hooks';
import {
  authHeader,
  createTestApp,
  registerLogin,
  resetAuthTables,
  startTestDatabase,
  stopTestDatabase,
} from '../tests/helpers/test-db.js';

const password = 'SecurePass12';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

async function timeMany(
  n: number,
  fn: () => Promise<Response>,
): Promise<{ p50: number; p95: number; errors: number }> {
  const samples: number[] = [];
  let errors = 0;
  for (let i = 0; i < n; i += 1) {
    const t0 = performance.now();
    try {
      const res = await fn();
      if (!res.ok) errors += 1;
    } catch {
      errors += 1;
    }
    samples.push(performance.now() - t0);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50: Math.round(percentile(sorted, 50) * 10) / 10,
    p95: Math.round(percentile(sorted, 95) * 10) / 10,
    errors,
  };
}

async function main() {
  const { prisma } = await startTestDatabase();
  const hydrate: Array<{ patients: number; requests: number; ms: number }> = [];
  const { app: seedApp } = createTestApp(prisma);

  for (const n of [10, 100, 500] as const) {
    await resetAuthTables(prisma);
    const u = await registerLogin(seedApp, `bench-${n}@example.com`, password);
    await seedApp.request('/organization', {
      method: 'POST',
      headers: {
        ...authHeader(u.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: `Bench ${n}` }),
    });

    for (let i = 0; i < n; i += 1) {
      await seedApp.request('/patients', {
        method: 'POST',
        headers: {
          ...authHeader(u.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: `P${i}`,
          lastName: 'Bench',
          phone: `05${String(i).padStart(8, '0')}`,
          age: 30,
          address: '',
          antecedents: '',
          hasAllergies: false,
        }),
      });
    }

    const paths = [
      '/patients?page=1&limit=100',
      '/appointments?page=1&limit=100',
      '/dentists?page=1&limit=100',
      '/stock?page=1&limit=100',
      '/invoices?page=1&limit=100',
      '/prostheses?page=1&limit=100',
      '/consultations?page=1&limit=100',
      '/treatments?page=1&limit=100',
      '/prescriptions?page=1&limit=100',
      '/media?page=1&limit=100',
    ];
    const t0 = performance.now();
    await Promise.all(
      paths.map((path) => seedApp.request(path, { headers: authHeader(u.token) })),
    );
    hydrate.push({
      patients: n,
      requests: paths.length,
      ms: Math.round(performance.now() - t0),
    });
  }

  await resetAuthTables(prisma);
  const { app } = createTestApp(prisma);
  const u2 = await registerLogin(app, 'bench-lat@example.com', password);
  await app.request('/organization', {
    method: 'POST',
    headers: {
      ...authHeader(u2.token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Latency Clinic' }),
  });

  const latency = [
    {
      endpoint: 'GET /health',
      ...(await timeMany(40, () => app.request('/health'))),
    },
    {
      endpoint: 'POST /auth/login',
      ...(await timeMany(20, () =>
        app.request('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'bench-lat@example.com', password }),
        }),
      )),
    },
    {
      endpoint: 'GET /patients',
      ...(await timeMany(40, () =>
        app.request('/patients?page=1&limit=50', {
          headers: authHeader(u2.token),
        }),
      )),
    },
    {
      endpoint: 'GET /appointments',
      ...(await timeMany(40, () =>
        app.request('/appointments?page=1&limit=50', {
          headers: authHeader(u2.token),
        }),
      )),
    },
    {
      endpoint: 'GET /prescriptions',
      ...(await timeMany(40, () =>
        app.request('/prescriptions?page=1&limit=50', {
          headers: authHeader(u2.token),
        }),
      )),
    },
    {
      endpoint: 'GET bulk clinical×4',
      ...(await timeMany(20, async () => {
        const results = await Promise.all([
          app.request('/consultations?page=1&limit=50', {
            headers: authHeader(u2.token),
          }),
          app.request('/treatments?page=1&limit=50', {
            headers: authHeader(u2.token),
          }),
          app.request('/prescriptions?page=1&limit=50', {
            headers: authHeader(u2.token),
          }),
          app.request('/media?page=1&limit=50', {
            headers: authHeader(u2.token),
          }),
        ]);
        return results.find((r) => !r.ok) ?? results[0]!;
      })),
    },
  ];

  console.log(JSON.stringify({ latency, hydrate }, null, 2));
  await stopTestDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
