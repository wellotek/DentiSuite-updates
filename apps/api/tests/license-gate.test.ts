import { describe, expect, it } from 'vitest';
import { AppError } from '../src/lib/errors.js';
import {
  assertLicenseBindingActive,
  assertOrganizationSeatAvailable,
} from '../src/organization/license-gate.js';

describe('license-gate', () => {
  it('rejects missing binding (commercial gate)', () => {
    expect(() => assertLicenseBindingActive(null)).toThrow(/license binding required/i);
  });

  it('rejects EXPIRED status and past expiresAt', () => {
    expect(() =>
      assertLicenseBindingActive({
        id: '1',
        organizationId: 'o',
        licenseId: 'L',
        maxUsers: 5,
        status: 'EXPIRED',
        expiresAt: null,
      }),
    ).toThrow(AppError);

    expect(() =>
      assertLicenseBindingActive({
        id: '1',
        organizationId: 'o',
        licenseId: 'L',
        maxUsers: 5,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 60_000),
      }),
    ).toThrow(/expired/i);
  });

  it('rejects DISABLED and PENDING', () => {
    expect(() =>
      assertLicenseBindingActive({
        id: '1',
        organizationId: 'o',
        licenseId: 'L',
        maxUsers: 5,
        status: 'DISABLED',
        expiresAt: null,
      }),
    ).toThrow(/not active/i);
  });

  it('allows ACTIVE binding without expiry', () => {
    expect(() =>
      assertLicenseBindingActive({
        id: '1',
        organizationId: 'o',
        licenseId: 'L',
        maxUsers: 5,
        status: 'ACTIVE',
        expiresAt: null,
      }),
    ).not.toThrow();
  });
});

describe('assertOrganizationSeatAvailable', () => {
  it('blocks when active seats >= maxUsers', async () => {
    const prisma = {
      licenseBinding: {
        findUnique: async () => ({
          id: '1',
          organizationId: 'o',
          licenseId: 'L',
          maxUsers: 2,
          status: 'ACTIVE' as const,
          expiresAt: null,
        }),
      },
      membership: {
        count: async () => 2,
      },
    };
    await expect(
      assertOrganizationSeatAvailable(prisma as never, 'o'),
    ).rejects.toMatchObject({ code: 'LICENSE_SEAT_LIMIT', status: 403 });
  });

  it('allows when under maxUsers', async () => {
    const prisma = {
      licenseBinding: {
        findUnique: async () => ({
          id: '1',
          organizationId: 'o',
          licenseId: 'L',
          maxUsers: 5,
          status: 'ACTIVE' as const,
          expiresAt: null,
        }),
      },
      membership: {
        count: async () => 1,
      },
    };
    await expect(
      assertOrganizationSeatAvailable(prisma as never, 'o'),
    ).resolves.toBeUndefined();
  });
});
