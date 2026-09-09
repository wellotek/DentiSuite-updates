import type { Logger } from '../lib/logger.js';

/**
 * Structured auth event hooks for Phase 8 AuditLog.
 * Phase 2: application logs only — never credentials or raw tokens.
 */
export type AuthEvent =
  | { type: 'auth.register'; userId: string; email: string }
  | { type: 'auth.login.success'; userId: string; sessionId: string; deviceId: string | null }
  | { type: 'auth.login.failure'; reason: 'invalid_credentials' | 'disabled' }
  | { type: 'auth.logout'; userId: string; sessionId: string }
  | { type: 'auth.refresh'; userId: string; sessionId: string }
  | { type: 'auth.password_change'; userId: string; sessionId: string }
  | { type: 'auth.session_revoke'; userId: string; sessionId: string; targetSessionId: string }
  | { type: 'auth.device_revoke'; userId: string; deviceId: string };

export function logAuthEvent(logger: Logger, event: AuthEvent): void {
  logger.info({ authEvent: event.type, ...sanitize(event) }, 'auth_event');
}

function sanitize(event: AuthEvent): Record<string, unknown> {
  switch (event.type) {
    case 'auth.register':
      return { userId: event.userId, email: event.email };
    case 'auth.login.success':
      return {
        userId: event.userId,
        sessionId: event.sessionId,
        deviceId: event.deviceId,
      };
    case 'auth.login.failure':
      return { reason: event.reason };
    case 'auth.logout':
    case 'auth.refresh':
    case 'auth.password_change':
      return { userId: event.userId, sessionId: event.sessionId };
    case 'auth.session_revoke':
      return {
        userId: event.userId,
        sessionId: event.sessionId,
        targetSessionId: event.targetSessionId,
      };
    case 'auth.device_revoke':
      return { userId: event.userId, deviceId: event.deviceId };
    default:
      return {};
  }
}
