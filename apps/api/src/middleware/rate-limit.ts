import type { MiddlewareHandler } from 'hono';
import { AppError } from '../lib/errors.js';

export type RateLimitEntry = {
  count: number;
  resetAt: number;
};

/**
 * Simple in-memory rate limiter (single process).
 * Limitation: counters are NOT shared across multiple API instances.
 * Safe for single-node; replace with Redis later if multi-instance.
 */
export class MemoryRateLimitStore {
  private readonly buckets = new Map<string, RateLimitEntry>();

  hit(key: string, windowMs: number, max: number): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
  } {
    const now = Date.now();
    const current = this.buckets.get(key);

    if (!current || current.resetAt <= now) {
      const resetAt = now + windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: max - 1, resetAt };
    }

    current.count += 1;
    this.buckets.set(key, current);
    return {
      allowed: current.count <= max,
      remaining: Math.max(0, max - current.count),
      resetAt: current.resetAt,
    };
  }

  /** Test helper */
  clear(): void {
    this.buckets.clear();
  }
}

/**
 * Client IP for rate limiting.
 * By default ignore X-Forwarded-For / X-Real-Ip (spoofable).
 * Set TRUST_PROXY=true only behind a trusted reverse proxy (e.g. Railway).
 */
export function clientIpFromRequest(
  c: { req: { header: (name: string) => string | undefined } },
  trustProxy: boolean,
): string {
  if (trustProxy) {
    const xff = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    if (xff) return xff;
    const real = c.req.header('x-real-ip')?.trim();
    if (real) return real;
  }
  return 'local';
}

export function createRateLimitMiddleware(options: {
  store: MemoryRateLimitStore;
  windowMs: number;
  max: number;
  keyPrefix: string;
  /** When true, honor X-Forwarded-For / X-Real-Ip (trusted proxy only). */
  trustProxy?: boolean;
}): MiddlewareHandler {
  return async (c, next) => {
    const ip = clientIpFromRequest(c, options.trustProxy === true);
    const key = `${options.keyPrefix}:${ip}:${c.req.path}`;
    const result = options.store.hit(key, options.windowMs, options.max);

    c.header('X-RateLimit-Limit', String(options.max));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
    }

    await next();
  };
}
