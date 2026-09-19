import type { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';

const testConfig = loadConfig({
  NODE_ENV: 'test',
  PORT: '3001',
  DATABASE_URL: 'postgresql://dentisuite:dentisuite@127.0.0.1:5432/dentisuite_test',
  DIRECT_URL: 'postgresql://dentisuite:dentisuite@127.0.0.1:5432/dentisuite_test',
  LOG_LEVEL: 'silent',
});

const prismaStub = {} as PrismaClient;

describe('GET /health', () => {
  it('returns 200 with ok and product DentiSuite', async () => {
    const app = createApp({
      config: testConfig,
      logger: createLogger(testConfig),
      prisma: prismaStub,
    });

    const response = await app.request('/health');
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      ok: boolean;
      product: string;
      version: string;
      env: string;
    };

    expect(body.ok).toBe(true);
    expect(body.product).toBe('DentiSuite');
    expect(body.version).toBe('3.1.2');
    expect(body.env).toBe('test');
  });

  it('returns JSON 404 for unknown routes', async () => {
    const app = createApp({
      config: testConfig,
      logger: createLogger(testConfig),
      prisma: prismaStub,
    });

    const response = await app.request('/does-not-exist');
    expect(response.status).toBe(404);

    const body = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('configuration', () => {
  it('fails safely when DATABASE_URL is missing', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        PORT: '3001',
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('fails safely when DATABASE_URL is not PostgreSQL', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        PORT: '3001',
        DATABASE_URL: 'mysql://localhost/db',
      }),
    ).toThrow(/PostgreSQL/);
  });
});

describe('prisma foundation migration', () => {
  it('foundation migration creates no tables', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const migrationPath = join(
      here,
      '..',
      'prisma',
      'migrations',
      '20260302120000_foundation',
      'migration.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');
    const withoutComments = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .toLowerCase();

    expect(withoutComments).not.toMatch(/create\s+table/);
    expect(withoutComments.trim()).toBe('');
  });
});
