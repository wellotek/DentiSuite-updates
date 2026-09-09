import type {
  Membership,
  MembershipStatus,
  Organization,
  PrismaClient,
  User,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { normalizeEmail } from '../auth/email.js';
import { hashPassword, isArgon2idHash } from '../auth/passwords.js';
import {
  isValidUsername,
  normalizeUsername,
  syntheticEmailForUsername,
} from '../auth/username.js';
import { writeAuditLog } from '../audit/service.js';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import type { PermissionService } from '../permissions/service.js';
import {
  assertOrganizationSeatAvailable,
} from '../organization/license-gate.js';
import {
  isPermissionKey,
  roleDefaultPermissions,
  type PermissionKey,
} from '../permissions/vocabulary.js';
import type {
  CreateTeamMemberInput,
  ListTeamQuery,
  UpdateTeamMemberInput,
} from './schemas.js';

export type TenantScope = { organizationId: string };

export type TeamActor = {
  user: User;
  membership: Membership;
  organization: Organization;
};

export type PublicTeamMember = {
  membershipId: string;
  userId: string;
  email: string;
  username: string | null;
  displayName: string | null;
  userStatus: 'ACTIVE' | 'DISABLED';
  role: 'ADMIN' | 'ASSISTANT';
  status: 'ACTIVE' | 'DISABLED';
  permissions: PermissionKey[];
  overrides: Array<{ permission: PermissionKey; effect: 'ALLOW' | 'DENY' }>;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
};

export class TeamService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly permissionService: PermissionService,
    private readonly logger: Logger,
    private readonly passwordMinLength: number,
  ) {}

  async list(
    actor: TeamActor,
    query: ListTeamQuery,
  ): Promise<{
    items: PublicTeamMember[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    this.assertActorOrg(actor);

    const where = { organizationId: actor.organization.id };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.membership.count({ where }),
      this.prisma.membership.findMany({
        where,
        include: {
          user: true,
          permissionOverrides: { include: { permission: true } },
        },
        orderBy: [{ createdAt: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    const items: PublicTeamMember[] = [];
    for (const row of rows) {
      items.push(await this.toPublic(actor, row));
    }

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async create(
    actor: TeamActor,
    input: CreateTeamMemberInput,
  ): Promise<PublicTeamMember> {
    this.assertActorOrg(actor);
    this.assertAdminActor(actor);
    this.assertPasswordPolicy(input.password);
    await assertOrganizationSeatAvailable(this.prisma, actor.organization.id);

    const username = normalizeUsername(input.username);
    if (!isValidUsername(username)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid username');
    }

    const email = input.email
      ? normalizeEmail(input.email)
      : syntheticEmailForUsername(username, actor.organization.id);

    const existing = await this.prisma.user.findUnique({ where: { email } });

    const usernameTaken = await this.prisma.user.findUnique({ where: { username } });
    if (usernameTaken && (!existing || usernameTaken.id !== existing.id)) {
      throw new AppError(409, 'USERNAME_EXISTS', 'This username is already taken');
    }

    let user: User;
    let createdUser = false;

    if (existing) {
      const already = await this.prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: existing.id,
            organizationId: actor.organization.id,
          },
        },
      });
      if (already) {
        throw new AppError(
          409,
          'MEMBERSHIP_EXISTS',
          'This user is already a member of the organization',
        );
      }
      // Link existing account: set username/displayName if free
      user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          username: existing.username ?? username,
          displayName: input.displayName ?? existing.displayName ?? username,
          updatedAt: new Date(),
        },
      });
    } else {
      const passwordHash = await hashPassword(input.password);
      if (!isArgon2idHash(passwordHash)) {
        throw new AppError(500, 'INTERNAL_ERROR', 'Internal server error');
      }
      const now = new Date();
      user = await this.prisma.user.create({
        data: {
          id: randomUUID(),
          email,
          username,
          displayName: input.displayName ?? username,
          passwordHash,
          status: 'ACTIVE',
          passwordChangedAt: now,
          updatedAt: now,
        },
      });
      createdUser = true;
    }

    const membership = await this.prisma.membership.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        organizationId: actor.organization.id,
        role: input.role,
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
      include: {
        user: true,
        permissionOverrides: { include: { permission: true } },
      },
    });

    if (input.permissions) {
      await this.permissionService.syncEffectivePermissionsAsAdmin(
        actor,
        membership.id,
        input.permissions,
      );
    }

    this.logger.info(
      {
        teamEvent: 'member_created',
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
        membershipId: membership.id,
        userId: user.id,
        role: input.role,
        username,
        createdUser,
      },
      'Team member created',
    );

    await writeAuditLog(this.prisma, {
      organizationId: actor.organization.id,
      actor: { user: actor.user, membership: actor.membership },
      action: 'TEAM_MEMBER_CREATED',
      module: 'team',
      resourceType: 'membership',
      resourceId: membership.id,
      summary: `Création du membre @${username} (${input.role})`,
      details: { userId: user.id, role: input.role, username },
    });

    const fresh = await this.prisma.membership.findUniqueOrThrow({
      where: { id: membership.id },
      include: {
        user: true,
        permissionOverrides: { include: { permission: true } },
      },
    });
    return this.toPublic(actor, fresh);
  }

  async update(
    actor: TeamActor,
    membershipId: string,
    input: UpdateTeamMemberInput,
  ): Promise<PublicTeamMember> {
    this.assertActorOrg(actor);
    this.assertAdminActor(actor);

    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId: actor.organization.id },
      include: { user: true },
    });
    if (!target) {
      throw new AppError(404, 'NOT_FOUND', 'Membership not found');
    }

    if (input.role === 'ADMIN' && actor.membership.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'Only an admin can promote to ADMIN');
    }

    // Only guard last-admin when demoting/disabling an ADMIN membership.
    if (
      (input.role === 'ASSISTANT' && target.role === 'ADMIN') ||
      (input.status === 'DISABLED' && target.role === 'ADMIN' && target.status === 'ACTIVE')
    ) {
      await this.assertNotLastActiveAdmin(actor.organization.id, target.id);
    }
    if (input.role && target.id === actor.membership.id && input.role !== actor.membership.role) {
      if (input.role === 'ASSISTANT') {
        await this.assertNotLastActiveAdmin(actor.organization.id, target.id);
      }
    }

    if (input.password) {
      this.assertPasswordPolicy(input.password);
      const passwordHash = await hashPassword(input.password);
      if (!isArgon2idHash(passwordHash)) {
        throw new AppError(500, 'INTERNAL_ERROR', 'Internal server error');
      }
      const now = new Date();
      await this.prisma.user.update({
        where: { id: target.userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          updatedAt: now,
        },
      });
      // Invalidate all sessions for the target user after admin password reset.
      await this.prisma.session.updateMany({
        where: { userId: target.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await writeAuditLog(this.prisma, {
        organizationId: actor.organization.id,
        actor: { user: actor.user, membership: actor.membership },
        action: 'TEAM_PASSWORD_CHANGED',
        module: 'team',
        resourceType: 'user',
        resourceId: target.userId,
        summary: `Réinitialisation du mot de passe de ${target.user.username ? `@${target.user.username}` : target.user.email}`,
      });
    }

    const userPatch: {
      username?: string;
      displayName?: string | null;
      email?: string;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (input.username) {
      const username = normalizeUsername(input.username);
      if (!isValidUsername(username)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid username');
      }
      const taken = await this.prisma.user.findFirst({
        where: { username, NOT: { id: target.userId } },
      });
      if (taken) {
        throw new AppError(409, 'USERNAME_EXISTS', 'This username is already taken');
      }
      userPatch.username = username;
    }
    if (input.displayName !== undefined) {
      userPatch.displayName = input.displayName;
    }
    if (input.email) {
      const email = normalizeEmail(input.email);
      const emailTaken = await this.prisma.user.findFirst({
        where: { email, NOT: { id: target.userId } },
      });
      if (emailTaken) {
        throw new AppError(409, 'EMAIL_EXISTS', 'This email is already taken');
      }
      userPatch.email = email;
    }

    if (
      userPatch.username !== undefined ||
      userPatch.displayName !== undefined ||
      userPatch.email !== undefined
    ) {
      await this.prisma.user.update({
        where: { id: target.userId },
        data: userPatch,
      });
    }

    const data: {
      role?: 'ADMIN' | 'ASSISTANT';
      status?: MembershipStatus;
      disabledAt?: Date | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (input.role) data.role = input.role;
    if (input.status) {
      if (input.status === 'ACTIVE' && target.status !== 'ACTIVE') {
        await assertOrganizationSeatAvailable(this.prisma, actor.organization.id);
      }
      data.status = input.status;
      data.disabledAt = input.status === 'DISABLED' ? new Date() : null;
    }

    if (input.role || input.status) {
      await this.prisma.membership.update({
        where: { id: target.id },
        data,
      });
    }

    if (input.permissions) {
      await this.permissionService.syncEffectivePermissionsAsAdmin(
        actor,
        target.id,
        input.permissions,
      );
      await writeAuditLog(this.prisma, {
        organizationId: actor.organization.id,
        actor: { user: actor.user, membership: actor.membership },
        action: 'TEAM_PERMISSIONS_CHANGED',
        module: 'team',
        resourceType: 'membership',
        resourceId: target.id,
        summary: `Permissions mises à jour pour ${target.user.username ? `@${target.user.username}` : target.user.email}`,
        details: { permissions: input.permissions },
      });
    }

    if (input.role && input.role !== target.role) {
      await writeAuditLog(this.prisma, {
        organizationId: actor.organization.id,
        actor: { user: actor.user, membership: actor.membership },
        action: 'TEAM_ROLE_CHANGED',
        module: 'team',
        resourceType: 'membership',
        resourceId: target.id,
        summary: `Rôle ${target.role} → ${input.role}`,
        details: { from: target.role, to: input.role },
      });
    }

    if (input.status && input.status !== target.status) {
      await writeAuditLog(this.prisma, {
        organizationId: actor.organization.id,
        actor: { user: actor.user, membership: actor.membership },
        action: input.status === 'DISABLED' ? 'TEAM_SUSPENDED' : 'TEAM_REACTIVATED',
        module: 'team',
        resourceType: 'membership',
        resourceId: target.id,
        summary:
          input.status === 'DISABLED'
            ? `Suspension de ${target.user.username ? `@${target.user.username}` : target.user.email}`
            : `Réactivation de ${target.user.username ? `@${target.user.username}` : target.user.email}`,
      });
    }

    if (
      input.username ||
      input.displayName !== undefined ||
      input.email ||
      (input.role && input.role !== target.role) ||
      (input.status && input.status !== target.status) ||
      input.permissions ||
      input.password
    ) {
      await writeAuditLog(this.prisma, {
        organizationId: actor.organization.id,
        actor: { user: actor.user, membership: actor.membership },
        action: 'TEAM_MEMBER_UPDATED',
        module: 'team',
        resourceType: 'membership',
        resourceId: target.id,
        summary: `Membre mis à jour`,
      });
    }

    this.logger.info(
      {
        teamEvent: 'member_updated',
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
        membershipId: target.id,
      },
      'Team member updated',
    );

    const fresh = await this.prisma.membership.findUniqueOrThrow({
      where: { id: target.id },
      include: {
        user: true,
        permissionOverrides: { include: { permission: true } },
      },
    });
    return this.toPublic(actor, fresh);
  }

  async remove(actor: TeamActor, membershipId: string): Promise<void> {
    this.assertActorOrg(actor);
    this.assertAdminActor(actor);

    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId: actor.organization.id },
      include: { user: true },
    });
    if (!target) {
      throw new AppError(404, 'NOT_FOUND', 'Membership not found');
    }

    if (target.id === actor.membership.id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Cannot remove your own membership');
    }

    if (target.role === 'ADMIN' && target.status === 'ACTIVE') {
      await this.assertNotLastActiveAdmin(actor.organization.id, target.id);
    }

    await this.prisma.membership.delete({ where: { id: target.id } });

    await writeAuditLog(this.prisma, {
      organizationId: actor.organization.id,
      actor: { user: actor.user, membership: actor.membership },
      action: 'TEAM_MEMBER_REMOVED',
      module: 'team',
      resourceType: 'membership',
      resourceId: membershipId,
      summary: `Retrait de ${target.user.username ? `@${target.user.username}` : target.user.email}`,
    });

    this.logger.info(
      {
        teamEvent: 'member_removed',
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
        membershipId: target.id,
        userId: target.userId,
      },
      'Team member removed',
    );
  }

  private async toPublic(
    actor: TeamActor,
    row: Membership & {
      user: User;
      permissionOverrides: Array<{
        effect: 'ALLOW' | 'DENY';
        permission: { key: string };
      }>;
    },
  ): Promise<PublicTeamMember> {
    const permissions = await this.permissionService.getEffectivePermissions(
      {
        user: row.user,
        membership: row,
        organization: actor.organization,
      },
      { skipActiveCheck: true },
    );

    const overrides = row.permissionOverrides
      .map((o) => {
        if (!isPermissionKey(o.permission.key)) return null;
        return {
          permission: o.permission.key,
          effect: o.effect,
        };
      })
      .filter((v): v is { permission: PermissionKey; effect: 'ALLOW' | 'DENY' } => Boolean(v))
      .sort((a, b) => a.permission.localeCompare(b.permission));

    return {
      membershipId: row.id,
      userId: row.userId,
      email: row.user.email,
      username: row.user.username ?? null,
      displayName: row.user.displayName ?? null,
      userStatus: row.user.status,
      role: row.role,
      status: row.status,
      permissions,
      overrides,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      disabledAt: row.disabledAt?.toISOString() ?? null,
    };
  }

  private assertActorOrg(actor: TeamActor): void {
    if (actor.membership.organizationId !== actor.organization.id) {
      throw new AppError(403, 'ORGANIZATION_REQUIRED', 'Organization access required');
    }
  }

  private assertAdminActor(actor: TeamActor): void {
    if (actor.membership.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'Admin role required');
    }
  }

  private assertPasswordPolicy(password: string): void {
    if (password.length < Math.max(8, this.passwordMinLength)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `Password must be at least ${Math.max(8, this.passwordMinLength)} characters`,
      );
    }
  }

  private async assertNotLastActiveAdmin(
    organizationId: string,
    excludingMembershipId: string,
  ): Promise<void> {
    const otherAdmins = await this.prisma.membership.count({
      where: {
        organizationId,
        role: 'ADMIN',
        status: 'ACTIVE',
        id: { not: excludingMembershipId },
      },
    });
    if (otherAdmins === 0) {
      throw new AppError(
        400,
        'LAST_ADMIN',
        'Cannot remove or demote the last active admin',
      );
    }
  }
}

/** Re-export for override sync helpers that need role defaults. */
export { roleDefaultPermissions };
