import type { LicenseBinding, PrismaClient } from '@prisma/client';
import { AppError } from '../lib/errors.js';

/**
 * Runtime license gates for commercial multi-tenant.
 * Organization without an ACTIVE LicenseBinding cannot use tenant routes.
 * Existing ACTIVE members keep access when at seat limit; only new seats are blocked.
 */

export type LicenseGateBinding = Pick<
  LicenseBinding,
  'id' | 'organizationId' | 'licenseId' | 'maxUsers' | 'status' | 'expiresAt'
>;

function isExpired(binding: LicenseGateBinding, now = new Date()): boolean {
  if (binding.status === 'EXPIRED') return true;
  if (binding.expiresAt && binding.expiresAt.getTime() <= now.getTime()) return true;
  return false;
}

/**
 * Commercial access requires an ACTIVE, non-expired LicenseBinding.
 * Missing binding → LICENSE_REQUIRED (no silent pass).
 */
export function assertLicenseBindingActive(
  binding: LicenseGateBinding | null | undefined,
): void {
  if (!binding) {
    throw new AppError(
      403,
      'LICENSE_REQUIRED',
      'Organization license binding required',
    );
  }

  if (binding.status === 'DISABLED' || binding.status === 'PENDING') {
    throw new AppError(403, 'LICENSE_INACTIVE', 'Organization license is not active');
  }

  if (isExpired(binding)) {
    throw new AppError(403, 'LICENSE_EXPIRED', 'Organization license has expired');
  }

  if (binding.status !== 'ACTIVE') {
    throw new AppError(403, 'LICENSE_INACTIVE', 'Organization license is not active');
  }
}

export async function loadOrganizationLicenseBinding(
  prisma: PrismaClient,
  organizationId: string,
): Promise<LicenseGateBinding | null> {
  return prisma.licenseBinding.findUnique({
    where: { organizationId },
    select: {
      id: true,
      organizationId: true,
      licenseId: true,
      maxUsers: true,
      status: true,
      expiresAt: true,
    },
  });
}

/** Gate tenant routes: missing / expired / disabled binding blocks access. */
export async function assertOrganizationLicenseAllowsAccess(
  prisma: PrismaClient,
  organizationId: string,
): Promise<LicenseGateBinding> {
  const binding = await loadOrganizationLicenseBinding(prisma, organizationId);
  assertLicenseBindingActive(binding);
  return binding as LicenseGateBinding;
}

/**
 * Gate new ACTIVE seats (create member or re-activate).
 * Counts ACTIVE memberships only.
 */
export async function assertOrganizationSeatAvailable(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  const binding = await loadOrganizationLicenseBinding(prisma, organizationId);
  assertLicenseBindingActive(binding);
  const active = binding as LicenseGateBinding;

  const activeSeats = await prisma.membership.count({
    where: {
      organizationId,
      status: 'ACTIVE',
    },
  });

  if (activeSeats >= active.maxUsers) {
    throw new AppError(
      403,
      'LICENSE_SEAT_LIMIT',
      `License seat limit reached (${active.maxUsers} users)`,
    );
  }
}
