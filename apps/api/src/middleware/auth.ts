import type { Device, Session, User } from '@prisma/client';
import type { MiddlewareHandler } from 'hono';
import type { AuthService, PublicUser } from '../auth/service.js';
import { AppError } from '../lib/errors.js';

export type AuthContext = {
  userId: string;
  sessionId: string;
  deviceId: string | null;
  organizationId?: string;
  membershipId?: string;
  membershipRole?: 'ADMIN' | 'ASSISTANT';
};

export type AuthVariables = {
  auth: AuthContext;
  user: User;
  publicUser: PublicUser;
  session: Session;
  device: Device | null;
  rawToken: string;
};

export function extractBearer(header: string | undefined): string {
  if (!header) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match?.[1]) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  return match[1];
}

export function createAuthMiddleware(authService: AuthService): MiddlewareHandler<{
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    const rawToken = extractBearer(c.req.header('authorization'));
    const { user, session, device } = await authService.resolveBearer(rawToken);

    const auth: AuthContext = {
      userId: user.id,
      sessionId: session.id,
      deviceId: device?.id ?? session.deviceId ?? null,
    };

    c.set('auth', auth);
    c.set('user', user);
    c.set('publicUser', authService.toPublicUser(user));
    c.set('session', session);
    c.set('device', device);
    c.set('rawToken', rawToken);

    await next();
  };
}
