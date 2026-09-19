import type { Device, PrismaClient, Session, User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import { logOrgEvent } from '../organization/events.js';
import {
  assertValidLicenseKeyFormat,
  licenseKeyFingerprint,
} from '../organization/license-key.js';
import { buildOrganizationSlug } from '../organization/schemas.js';
import type {
  PublicMembership,
  PublicOrganization,
} from '../organization/service.js';
import { writeAuditLog } from '../audit/service.js';
import { normalizeEmail } from './email.js';
import { logAuthEvent } from './events.js';
import { hashPassword, isArgon2idHash, verifyPassword } from './passwords.js';
import { generateOpaqueToken, hashToken } from './tokens.js';
import { normalizeUsername } from './username.js';

export type PublicUser = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  /** Always null until Phase 3 Organization bootstrap. */
  organizationId: null;
  /** Always null until Phase 3 Membership. */
  membershipId: null;
};

export type AuthBundle = {
  token: string;
  expiresAt: string;
  user: PublicUser;
};

export type DeviceInput = {
  deviceIdentifier: string;
  platform?: string;
  name?: string;
};

export type BootstrapOrganizationInput = {
  licenseKey: string;
  organizationName: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  phone?: string;
  city?: string;
  device?: DeviceInput;
};

export type PublicBootstrapDentist = {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  color: string;
};

export type BootstrapOrganizationResult = {
  token: string;
  expiresAt: string;
  user: PublicUser;
  organization: PublicOrganization;
  membership: PublicMembership;
  dentist: PublicBootstrapDentist;
};

const GENERIC_AUTH_FAILURE = 'Invalid username/email or password';
const DEFAULT_LICENSE_MAX_USERS = 25;
const DEFAULT_DENTIST_COLOR = '#0e628e';

function splitPersonName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Praticien', lastName: 'Principal' };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: parts[0]! };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username ?? null,
      displayName: user.displayName ?? null,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
      organizationId: null,
      membershipId: null,
    };
  }

  async register(emailRaw: string, password: string): Promise<{
    user: PublicUser;
    organization: null;
    membership: null;
    message: string;
  }> {
    const email = normalizeEmail(emailRaw);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }

    const passwordHash = await hashPassword(password);
    if (!isArgon2idHash(passwordHash)) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Internal server error');
    }

    const now = new Date();
    const user = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        email,
        passwordHash,
        status: 'ACTIVE',
        passwordChangedAt: now,
        updatedAt: now,
      },
    });

    logAuthEvent(this.logger, {
      type: 'auth.register',
      userId: user.id,
      email: user.email,
    });

    return {
      user: this.toPublicUser(user),
      organization: null,
      membership: null,
      message:
        'Account created. No organization is linked yet. Clinical cloud access is not available.',
    };
  }

  /**
   * Commercial first-run: license key + cabinet + owner admin in one transaction,
   * then issue an opaque session (auto-login).
   */
  async bootstrapOrganization(
    input: BootstrapOrganizationInput,
  ): Promise<BootstrapOrganizationResult> {
    const email = normalizeEmail(input.adminEmail);
    const licenseKey = assertValidLicenseKeyFormat(input.licenseKey);

    const existingBinding = await this.prisma.licenseBinding.findUnique({
      where: { licenseId: licenseKey },
    });
    if (existingBinding) {
      throw new AppError(
        409,
        'LICENSE_ALREADY_REGISTERED',
        'This license is already linked to a clinic. Please sign in instead.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.adminPassword);
    if (!isArgon2idHash(passwordHash)) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Internal server error');
    }

    const { firstName, lastName } = splitPersonName(input.adminName);
    const now = new Date();
    const organizationId = randomUUID();
    const userId = randomUUID();
    const membershipId = randomUUID();
    const dentistId = randomUUID();
    const bindingId = randomUUID();
    const slug = buildOrganizationSlug(input.organizationName);

    let created: {
      user: User;
      organization: {
        id: string;
        name: string;
        slug: string;
        status: 'ACTIVE' | 'DISABLED';
        phone: string | null;
        city: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
      membership: {
        id: string;
        userId: string;
        organizationId: string;
        role: 'ADMIN' | 'ASSISTANT';
        status: 'ACTIVE' | 'DISABLED';
        createdAt: Date;
        updatedAt: Date;
        disabledAt: Date | null;
      };
      dentist: PublicBootstrapDentist;
    };

    try {
      created = await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            id: organizationId,
            name: input.organizationName.trim(),
            slug,
            status: 'ACTIVE',
            phone: input.phone ?? null,
            city: input.city ?? null,
            updatedAt: now,
          },
        });

        const user = await tx.user.create({
          data: {
            id: userId,
            email,
            passwordHash,
            status: 'ACTIVE',
            passwordChangedAt: now,
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

        await tx.licenseBinding.create({
          data: {
            id: bindingId,
            organizationId: organization.id,
            licenseId: licenseKey,
            maxUsers: DEFAULT_LICENSE_MAX_USERS,
            status: 'ACTIVE',
            lastValidatedAt: now,
            updatedAt: now,
          },
        });

        const dentist = await tx.dentist.create({
          data: {
            id: dentistId,
            organizationId: organization.id,
            firstName,
            lastName,
            specialty: 'Omnipratique',
            photo: '',
            color: DEFAULT_DENTIST_COLOR,
            updatedAt: now,
          },
        });

        return {
          user,
          organization,
          membership,
          dentist: {
            id: dentist.id,
            firstName: dentist.firstName,
            lastName: dentist.lastName,
            specialty: dentist.specialty,
            color: dentist.color,
          },
        };
      });
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';
      if (code === 'P2002') {
        throw new AppError(
          409,
          'BOOTSTRAP_CONFLICT',
          'Organization or license could not be created (conflict)',
        );
      }
      throw error;
    }

    logAuthEvent(this.logger, {
      type: 'auth.register',
      userId: created.user.id,
      email: created.user.email,
    });
    logOrgEvent(this.logger, {
      type: 'organization_created',
      organizationId: created.organization.id,
      userId: created.user.id,
      membershipId: created.membership.id,
    });
    logOrgEvent(this.logger, {
      type: 'membership_created',
      membershipId: created.membership.id,
      userId: created.user.id,
      organizationId: created.organization.id,
      role: 'ADMIN',
    });
    logOrgEvent(this.logger, {
      type: 'license_binding_created',
      organizationId: created.organization.id,
      licenseBindingId: bindingId,
    });

    await writeAuditLog(this.prisma, {
      organizationId: created.organization.id,
      actor: { user: created.user, membership: created.membership },
      action: 'license.activated',
      module: 'license',
      resourceType: 'LicenseBinding',
      resourceId: bindingId,
      summary: 'License activated via organization bootstrap',
      details: { fingerprint: licenseKeyFingerprint(licenseKey) },
    });

    const device = await this.upsertDevice(created.user.id, input.device);
    const { rawToken, session } = await this.createSession(
      created.user.id,
      device?.id ?? null,
    );

    await this.prisma.user.update({
      where: { id: created.user.id },
      data: { lastLoginAt: new Date() },
    });

    logAuthEvent(this.logger, {
      type: 'auth.login.success',
      userId: created.user.id,
      sessionId: session.id,
      deviceId: device?.id ?? null,
    });

    const organization: PublicOrganization = {
      id: created.organization.id,
      name: created.organization.name,
      slug: created.organization.slug,
      status: created.organization.status,
      phone: created.organization.phone,
      city: created.organization.city,
      createdAt: created.organization.createdAt.toISOString(),
      updatedAt: created.organization.updatedAt.toISOString(),
    };

    const membership: PublicMembership = {
      id: created.membership.id,
      userId: created.membership.userId,
      organizationId: created.membership.organizationId,
      role: created.membership.role,
      status: created.membership.status,
      createdAt: created.membership.createdAt.toISOString(),
      updatedAt: created.membership.updatedAt.toISOString(),
      disabledAt: created.membership.disabledAt?.toISOString() ?? null,
    };

    return {
      token: rawToken,
      expiresAt: session.expiresAt.toISOString(),
      user: this.toPublicUser({ ...created.user, lastLoginAt: new Date() }),
      organization,
      membership,
      dentist: created.dentist,
    };
  }

  async getOnboardingStatus(licenseKeyRaw: string): Promise<{
    licenseKey: string;
    registered: boolean;
    organizationName: string | null;
  }> {
    const licenseKey = assertValidLicenseKeyFormat(licenseKeyRaw);
    const binding = await this.prisma.licenseBinding.findUnique({
      where: { licenseId: licenseKey },
      include: { organization: true },
    });
    // Do not reveal clinic name to unauthenticated callers (enumeration).
    if (!binding || binding.organization.status !== 'ACTIVE') {
      return { licenseKey, registered: false, organizationName: null };
    }
    return {
      licenseKey,
      registered: true,
      organizationName: null,
    };
  }

  async login(
    loginRaw: string,
    password: string,
    deviceInput?: DeviceInput,
  ): Promise<AuthBundle> {
    const identifier = loginRaw.trim();
    const looksLikeEmail = identifier.includes('@');
    const user = looksLikeEmail
      ? await this.prisma.user.findUnique({ where: { email: normalizeEmail(identifier) } })
      : await this.prisma.user.findFirst({
          where: {
            OR: [
              { username: normalizeUsername(identifier) },
              { email: normalizeEmail(identifier) },
            ],
          },
        });

    if (!user || user.status !== 'ACTIVE') {
      logAuthEvent(this.logger, {
        type: 'auth.login.failure',
        reason: user?.status === 'DISABLED' ? 'disabled' : 'invalid_credentials',
      });
      // Constant-ish work when user missing
      await verifyPassword(
        '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        password,
      ).catch(() => false);
      throw new AppError(401, 'AUTH_FAILED', GENERIC_AUTH_FAILURE);
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      logAuthEvent(this.logger, {
        type: 'auth.login.failure',
        reason: 'invalid_credentials',
      });
      throw new AppError(401, 'AUTH_FAILED', GENERIC_AUTH_FAILURE);
    }

    // Suspended-only members: if the user has memberships but none ACTIVE, deny.
    // Users with zero memberships may still log in (pre-org bootstrap / register flow).
    const membershipCount = await this.prisma.membership.count({
      where: { userId: user.id },
    });
    if (membershipCount > 0) {
      const activeMembership = await this.prisma.membership.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
      });
      if (!activeMembership) {
        logAuthEvent(this.logger, {
          type: 'auth.login.failure',
          reason: 'disabled',
        });
        throw new AppError(401, 'AUTH_FAILED', GENERIC_AUTH_FAILURE);
      }
    }

    const device = await this.upsertDevice(user.id, deviceInput);
    const { rawToken, session } = await this.createSession(user.id, device?.id ?? null);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logAuthEvent(this.logger, {
      type: 'auth.login.success',
      userId: user.id,
      sessionId: session.id,
      deviceId: device?.id ?? null,
    });

    return {
      token: rawToken,
      expiresAt: session.expiresAt.toISOString(),
      user: this.toPublicUser({ ...user, lastLoginAt: new Date() }),
    };
  }

  /**
   * Idempotent logout by raw bearer token.
   * Already-revoked / unknown tokens do not throw (safe double-logout).
   */
  async logoutByToken(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
    });

    if (!session) {
      return;
    }

    if (!session.revokedAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }

    logAuthEvent(this.logger, {
      type: 'auth.logout',
      userId: session.userId,
      sessionId: session.id,
    });
  }

  async refresh(session: Session, user: User): Promise<AuthBundle> {
    if (user.status !== 'ACTIVE') {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const expiresAt = new Date(Date.now() + this.config.sessionTtlSeconds * 1000);
    const updated = await this.prisma.session.update({
      where: { id: session.id },
      data: {
        expiresAt,
        lastSeenAt: new Date(),
      },
    });

    // Same opaque token — no rotation in Phase 2 (simplest secure Desktop/Mobile path).
    // Client continues using the existing bearer; expiry is extended server-side.
    logAuthEvent(this.logger, {
      type: 'auth.refresh',
      userId: user.id,
      sessionId: session.id,
    });

    // We cannot return the raw token from DB (only hash stored). Refresh requires
    // the client to send the current bearer; echo it back via caller.
    return {
      token: '', // filled by route from request
      expiresAt: updated.expiresAt.toISOString(),
      user: this.toPublicUser(user),
    };
  }

  async changePassword(
    user: User,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<PublicUser> {
    const valid = await verifyPassword(user.passwordHash, currentPassword);
    if (!valid) {
      throw new AppError(401, 'AUTH_FAILED', 'Current password is incorrect');
    }

    if (currentPassword === newPassword) {
      throw new AppError(
        400,
        'PASSWORD_UNCHANGED',
        'New password must be different from the current password',
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const now = new Date();

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordChangedAt: now,
        updatedAt: now,
      },
    });

    // Policy: revoke all other sessions; keep the current session usable.
    await this.prisma.session.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        NOT: { id: sessionId },
      },
      data: { revokedAt: now },
    });

    logAuthEvent(this.logger, {
      type: 'auth.password_change',
      userId: user.id,
      sessionId,
    });

    return this.toPublicUser(updated);
  }

  async revokeSession(
    actorUserId: string,
    actorSessionId: string,
    targetSessionId: string,
  ): Promise<void> {
    const target = await this.prisma.session.findUnique({
      where: { id: targetSessionId },
    });

    if (!target || target.userId !== actorUserId) {
      throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
    }

    if (!target.revokedAt) {
      await this.prisma.session.update({
        where: { id: target.id },
        data: { revokedAt: new Date() },
      });
    }

    logAuthEvent(this.logger, {
      type: 'auth.session_revoke',
      userId: actorUserId,
      sessionId: actorSessionId,
      targetSessionId,
    });
  }

  async revokeDevice(actorUserId: string, deviceId: string): Promise<void> {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.userId !== actorUserId) {
      throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
    }

    const now = new Date();
    if (!device.revokedAt) {
      await this.prisma.device.update({
        where: { id: device.id },
        data: { revokedAt: now },
      });
    }

    await this.prisma.session.updateMany({
      where: {
        deviceId: device.id,
        userId: actorUserId,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    logAuthEvent(this.logger, {
      type: 'auth.device_revoke',
      userId: actorUserId,
      deviceId: device.id,
    });
  }

  async listSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceId: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      deviceId: s.deviceId,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      revokedAt: s.revokedAt?.toISOString() ?? null,
      active: s.revokedAt === null && s.expiresAt > new Date(),
    }));
  }

  async listDevices(userId: string) {
    const devices = await this.prisma.device.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceIdentifier: true,
        platform: true,
        name: true,
        createdAt: true,
        lastSeenAt: true,
        revokedAt: true,
      },
    });

    return devices.map((d) => ({
      id: d.id,
      deviceIdentifier: d.deviceIdentifier,
      platform: d.platform,
      name: d.name,
      createdAt: d.createdAt.toISOString(),
      lastSeenAt: d.lastSeenAt.toISOString(),
      revokedAt: d.revokedAt?.toISOString() ?? null,
    }));
  }

  async resolveBearer(rawToken: string): Promise<{
    user: User;
    session: Session;
    device: Device | null;
  }> {
    const tokenHash = hashToken(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true, device: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (session.user.status !== 'ACTIVE') {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (session.device?.revokedAt) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    if (session.deviceId) {
      await this.prisma.device.updateMany({
        where: { id: session.deviceId, revokedAt: null },
        data: { lastSeenAt: new Date() },
      });
    }

    return {
      user: session.user,
      session,
      device: session.device,
    };
  }

  private async upsertDevice(
    userId: string,
    deviceInput?: DeviceInput,
  ): Promise<Device | null> {
    if (!deviceInput?.deviceIdentifier) {
      return null;
    }

    const existing = await this.prisma.device.findUnique({
      where: {
        userId_deviceIdentifier: {
          userId,
          deviceIdentifier: deviceInput.deviceIdentifier,
        },
      },
    });

    if (existing) {
      if (existing.revokedAt) {
        return this.prisma.device.update({
          where: { id: existing.id },
          data: {
            revokedAt: null,
            lastSeenAt: new Date(),
            platform: deviceInput.platform ?? existing.platform,
            name: deviceInput.name ?? existing.name,
          },
        });
      }

      return this.prisma.device.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          platform: deviceInput.platform ?? existing.platform,
          name: deviceInput.name ?? existing.name,
        },
      });
    }

    return this.prisma.device.create({
      data: {
        id: randomUUID(),
        userId,
        deviceIdentifier: deviceInput.deviceIdentifier,
        platform: deviceInput.platform,
        name: deviceInput.name,
      },
    });
  }

  private async createSession(
    userId: string,
    deviceId: string | null,
  ): Promise<{ rawToken: string; session: Session }> {
    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.config.sessionTtlSeconds * 1000);

    const session = await this.prisma.session.create({
      data: {
        id: randomUUID(),
        userId,
        deviceId,
        tokenHash,
        expiresAt,
      },
    });

    return { rawToken, session };
  }
}
