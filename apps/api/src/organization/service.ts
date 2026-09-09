import type {
  LicenseBinding,
  Membership,
  Organization,
  PrismaClient,
  User,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import { logOrgEvent } from './events.js';
import {
  assertOrganizationLicenseAllowsAccess,
  assertOrganizationSeatAvailable,
} from './license-gate.js';
import { buildOrganizationSlug } from './schemas.js';

export type PublicOrganization = {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'DISABLED';
  phone: string | null;
  city: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicMembership = {
  id: string;
  userId: string;
  organizationId: string;
  role: 'ADMIN' | 'ASSISTANT';
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
};

export type TenantContext = {
  organization: Organization;
  membership: Membership;
};

export type InternalLicenseBindingInput = {
  licenseId: string;
  maxUsers: number;
  status?: 'ACTIVE' | 'DISABLED' | 'EXPIRED' | 'PENDING';
  expiresAt?: Date | null;
  lastValidatedAt?: Date | null;
};

export class OrganizationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  toPublicOrganization(org: Organization): PublicOrganization {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      phone: org.phone ?? null,
      city: org.city ?? null,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };
  }

  toPublicMembership(membership: Membership): PublicMembership {
    return {
      id: membership.id,
      userId: membership.userId,
      organizationId: membership.organizationId,
      role: membership.role,
      status: membership.status,
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
      disabledAt: membership.disabledAt?.toISOString() ?? null,
    };
  }

  /**
   * Resolve the caller's ACTIVE membership + ACTIVE organization.
   * Client-supplied organizationId is ignored (never trusted).
   */
  async resolveTenantForUser(userId: string): Promise<TenantContext> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership) {
      // Generic — do not reveal whether org/membership exists in another state.
      throw new AppError(403, 'ORGANIZATION_REQUIRED', 'Organization access required');
    }

    return {
      organization: membership.organization,
      membership,
    };
  }

  /** Runtime license gate for tenant routes (expired / inactive binding). */
  async assertLicenseAllowsAccess(organizationId: string) {
    return assertOrganizationLicenseAllowsAccess(this.prisma, organizationId);
  }

  /** Runtime seat gate for new ACTIVE memberships. */
  async assertSeatAvailable(organizationId: string) {
    return assertOrganizationSeatAvailable(this.prisma, organizationId);
  }

  async createOrganizationForUser(
    user: User,
    name: string,
  ): Promise<{
    organization: PublicOrganization;
    membership: PublicMembership;
    licenseBinding: null;
  }> {
    if (user.status !== 'ACTIVE') {
      throw new AppError(403, 'FORBIDDEN', 'Account is not active');
    }

    const existing = await this.prisma.membership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
    });
    if (existing) {
      throw new AppError(
        409,
        'ALREADY_IN_ORGANIZATION',
        'User already has an active organization membership',
      );
    }

    const organizationId = randomUUID();
    const membershipId = randomUUID();
    const slug = buildOrganizationSlug(name);
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          id: organizationId,
          name,
          slug,
          status: 'ACTIVE',
          updatedAt: now,
        },
      });

      const membership = await tx.membership.create({
        data: {
          id: membershipId,
          userId: user.id,
          organizationId: organization.id,
          role: 'ADMIN',
          status: 'ACTIVE',
          updatedAt: now,
        },
      });

      return { organization, membership };
    });

    logOrgEvent(this.logger, {
      type: 'organization_created',
      organizationId: result.organization.id,
      userId: user.id,
      membershipId: result.membership.id,
    });
    logOrgEvent(this.logger, {
      type: 'membership_created',
      membershipId: result.membership.id,
      userId: user.id,
      organizationId: result.organization.id,
      role: 'ADMIN',
    });

    return {
      organization: this.toPublicOrganization(result.organization),
      membership: this.toPublicMembership(result.membership),
      licenseBinding: null,
    };
  }

  async updateOrganizationAsAdmin(
    userId: string,
    membership: Membership,
    organization: Organization,
    name: string,
  ): Promise<PublicOrganization> {
    if (membership.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'Admin role required');
    }

    if (
      membership.userId !== userId ||
      membership.organizationId !== organization.id ||
      membership.status !== 'ACTIVE' ||
      organization.status !== 'ACTIVE'
    ) {
      throw new AppError(403, 'ORGANIZATION_REQUIRED', 'Organization access required');
    }

    const updated = await this.prisma.organization.update({
      where: { id: organization.id },
      data: { name, updatedAt: new Date() },
    });

    logOrgEvent(this.logger, {
      type: 'organization_updated',
      organizationId: updated.id,
      userId,
    });

    return this.toPublicOrganization(updated);
  }

  /**
   * Internal-only LicenseBinding create (future License Manager integration).
   * Not exposed as a public HTTP endpoint in Phase 3.
   */
  async createLicenseBinding(
    organizationId: string,
    input: InternalLicenseBindingInput,
  ): Promise<LicenseBinding> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new AppError(404, 'NOT_FOUND', 'Organization not found');
    }

    if (!Number.isInteger(input.maxUsers) || input.maxUsers < 1) {
      throw new AppError(400, 'VALIDATION_ERROR', 'maxUsers must be a positive integer');
    }

    try {
      const binding = await this.prisma.licenseBinding.create({
        data: {
          id: randomUUID(),
          organizationId,
          licenseId: input.licenseId,
          maxUsers: input.maxUsers,
          status: input.status ?? 'PENDING',
          expiresAt: input.expiresAt ?? null,
          lastValidatedAt: input.lastValidatedAt ?? null,
          updatedAt: new Date(),
        },
      });

      logOrgEvent(this.logger, {
        type: 'license_binding_created',
        organizationId,
        licenseBindingId: binding.id,
      });

      return binding;
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';
      if (code === 'P2002') {
        throw new AppError(
          409,
          'LICENSE_BINDING_CONFLICT',
          'License binding already exists for this organization or license',
        );
      }
      throw error;
    }
  }
}
