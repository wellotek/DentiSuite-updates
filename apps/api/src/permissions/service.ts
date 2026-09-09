import type { Membership, Organization, PrismaClient, User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import {
  isPermissionKey,
  roleDefaultPermissions,
  type PermissionKey,
} from './vocabulary.js';

export type PermissionEffect = 'ALLOW' | 'DENY';

export type RbacSubject = {
  user: User;
  membership: Membership;
  organization: Organization;
};

/**
 * Permission evaluation service.
 *
 * Hybrid model:
 * - Role defaults: code (canonical, versioned with the app)
 * - Overrides: DB (MembershipPermissionOverride)
 * - Permission rows: seeded from code for FK integrity
 */
export class PermissionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  assertPermissionKey(permission: string): PermissionKey {
    if (!isPermissionKey(permission)) {
      throw new AppError(400, 'INVALID_PERMISSION', 'Unknown permission key');
    }
    return permission;
  }

  /**
   * Compute effective permissions for a membership in one override query.
   * Role defaults come from code (no N+1 RolePermission reads).
   */
  async getEffectivePermissions(
    subject: RbacSubject,
    opts?: { skipActiveCheck?: boolean },
  ): Promise<PermissionKey[]> {
    if (!opts?.skipActiveCheck) {
      this.assertActiveSubject(subject);
    }

    const defaults = roleDefaultPermissions(subject.membership.role);
    const allowed = new Set<PermissionKey>(defaults);

    const overrides = await this.prisma.membershipPermissionOverride.findMany({
      where: { membershipId: subject.membership.id },
      include: { permission: true },
    });

    for (const override of overrides) {
      const key = override.permission.key;
      if (!isPermissionKey(key)) {
        continue;
      }
      if (override.effect === 'DENY') {
        allowed.delete(key);
      } else if (override.effect === 'ALLOW') {
        allowed.add(key);
      }
    }

    return [...allowed].sort();
  }

  async hasPermission(
    subject: RbacSubject,
    permission: string,
  ): Promise<boolean> {
    const key = this.assertPermissionKey(permission);
    this.assertActiveSubject(subject);

    const defaults = roleDefaultPermissions(subject.membership.role);
    let allowed = defaults.has(key);

    const override = await this.prisma.membershipPermissionOverride.findFirst({
      where: {
        membershipId: subject.membership.id,
        permission: { key },
      },
    });

    if (override?.effect === 'DENY') {
      allowed = false;
    } else if (override?.effect === 'ALLOW') {
      allowed = true;
    }

    return allowed;
  }

  async requirePermission(
    subject: RbacSubject,
    permission: string,
  ): Promise<void> {
    const allowed = await this.hasPermission(subject, permission);
    if (!allowed) {
      this.logger.warn(
        {
          authzEvent: 'AUTHZ_DENIED',
          userId: subject.user.id,
          membershipId: subject.membership.id,
          organizationId: subject.organization.id,
          permission,
          role: subject.membership.role,
        },
        'Authorization denied',
      );
      throw new AppError(403, 'FORBIDDEN', 'Permission denied');
    }
  }

  /**
   * Align DB overrides so effective permissions match `desired` for a membership.
   * Admin + same-organization only.
   */
  async syncEffectivePermissionsAsAdmin(
    actor: RbacSubject,
    targetMembershipId: string,
    desiredRaw: string[],
  ): Promise<PermissionKey[]> {
    this.assertActiveSubject(actor);
    if (actor.membership.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'Admin role required');
    }

    const desired = new Set<PermissionKey>();
    for (const raw of desiredRaw) {
      desired.add(this.assertPermissionKey(raw));
    }

    const target = await this.prisma.membership.findUnique({
      where: { id: targetMembershipId },
    });
    if (!target || target.organizationId !== actor.organization.id) {
      throw new AppError(404, 'NOT_FOUND', 'Membership not found');
    }

    const defaults = roleDefaultPermissions(target.role);

    // Clear existing overrides then rewrite.
    await this.prisma.membershipPermissionOverride.deleteMany({
      where: { membershipId: target.id },
    });

    const allKeys = new Set<PermissionKey>([...defaults, ...desired]);
    for (const key of allKeys) {
      const inDefault = defaults.has(key);
      const inDesired = desired.has(key);
      if (inDesired && !inDefault) {
        await this.setOverrideAsAdmin(actor, target.id, key, 'ALLOW');
      } else if (!inDesired && inDefault) {
        await this.setOverrideAsAdmin(actor, target.id, key, 'DENY');
      }
    }

    return this.getEffectivePermissions({
      user: await this.prisma.user.findUniqueOrThrow({ where: { id: target.userId } }),
      membership: target,
      organization: actor.organization,
    });
  }

  /**
   * Internal/admin-only override mutation.
   * ASSISTANT cannot create overrides or self-elevate.
   */
  async setOverrideAsAdmin(
    actor: RbacSubject,
    targetMembershipId: string,
    permission: string,
    effect: PermissionEffect,
  ): Promise<{ id: string; permission: PermissionKey; effect: PermissionEffect }> {
    this.assertActiveSubject(actor);

    if (actor.membership.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'Admin role required');
    }

    // Assistants must never modify their own (or any) permissions — enforced by ADMIN gate.
    // Extra guard: reject attempts where client-shaped payloads try to target self as non-admin
    // (already covered). Also reject if actor somehow passes role elevation in parallel.

    const key = this.assertPermissionKey(permission);
    const permissionRow = await this.prisma.permission.findUnique({
      where: { key },
    });
    if (!permissionRow) {
      throw new AppError(
        500,
        'PERMISSION_NOT_SEEDED',
        'Permission catalog is not seeded',
      );
    }

    const target = await this.prisma.membership.findUnique({
      where: { id: targetMembershipId },
    });
    if (!target || target.organizationId !== actor.organization.id) {
      throw new AppError(404, 'NOT_FOUND', 'Membership not found');
    }

    try {
      const existing = await this.prisma.membershipPermissionOverride.findUnique({
        where: {
          membershipId_permissionId: {
            membershipId: target.id,
            permissionId: permissionRow.id,
          },
        },
      });

      if (existing) {
        const updated = await this.prisma.membershipPermissionOverride.update({
          where: { id: existing.id },
          data: { effect, updatedAt: new Date() },
        });
        return { id: updated.id, permission: key, effect };
      }

      const created = await this.prisma.membershipPermissionOverride.create({
        data: {
          id: randomUUID(),
          membershipId: target.id,
          permissionId: permissionRow.id,
          effect,
          updatedAt: new Date(),
        },
      });
      return { id: created.id, permission: key, effect };
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';
      if (code === 'P2002') {
        throw new AppError(
          409,
          'OVERRIDE_CONFLICT',
          'Permission override already exists',
        );
      }
      throw error;
    }
  }

  private assertActiveSubject(subject: RbacSubject): void {
    if (subject.user.status !== 'ACTIVE') {
      throw new AppError(403, 'FORBIDDEN', 'Account is not active');
    }
    if (subject.membership.status !== 'ACTIVE') {
      throw new AppError(403, 'ORGANIZATION_REQUIRED', 'Organization access required');
    }
    if (subject.organization.status !== 'ACTIVE') {
      throw new AppError(403, 'ORGANIZATION_REQUIRED', 'Organization access required');
    }
    if (subject.membership.organizationId !== subject.organization.id) {
      throw new AppError(403, 'ORGANIZATION_REQUIRED', 'Organization access required');
    }
    if (subject.membership.userId !== subject.user.id) {
      throw new AppError(403, 'FORBIDDEN', 'Permission denied');
    }
  }
}
