import { Hono } from 'hono';
import type { AppConfig } from '../config/env.js';

export type HealthResponse = {
  ok: true;
  product: 'DentiSuite';
  version: string;
  env: AppConfig['nodeEnv'];
};

export function createHealthRoutes(config: Pick<AppConfig, 'version' | 'nodeEnv'>) {
  const health = new Hono();

  health.get('/', (c) => {
    const body: HealthResponse = {
      ok: true,
      product: 'DentiSuite',
      version: config.version,
      env: config.nodeEnv,
    };
    return c.json(body);
  });

  return health;
}
