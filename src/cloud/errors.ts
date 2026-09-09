/** Phase 7B — map Cloud IPC / HTTP failures for UI. */

export type CloudErrorKind =
  | 'unauthorized'
  | 'expired'
  | 'credentials'
  | 'forbidden'
  | 'not_found'
  | 'network'
  | 'server'
  | 'validation'
  | 'conflict'
  | 'disabled'
  | 'storage'
  | 'unknown'

export class CloudClientError extends Error {
  readonly kind: CloudErrorKind
  readonly code: string
  readonly status: number

  constructor(kind: CloudErrorKind, code: string, message: string, status = 0) {
    super(message)
    this.name = 'CloudClientError'
    this.kind = kind
    this.code = code
    this.status = status
  }
}

export function mapCloudFailure(payload: {
  code?: string
  message?: string
  status?: number
}): CloudClientError {
  const code = payload.code || 'UNKNOWN'
  const message = payload.message || 'Cloud request failed'
  const status = payload.status ?? 0

  if (code === 'PROBE_DISABLED' || /probe disabled/i.test(message)) {
    return new CloudClientError('disabled', code, message, status)
  }
  if (code === 'SAFE_STORAGE') {
    return new CloudClientError('storage', code, message, status)
  }
  if (code === 'INVALID_CREDENTIALS') {
    return new CloudClientError('credentials', code, message, 401)
  }
  if (code === 'SESSION_EXPIRED') {
    return new CloudClientError('expired', code, message, 401)
  }
  if (code === 'UNAUTHORIZED' || status === 401) {
    return new CloudClientError('unauthorized', code, message, 401)
  }
  if (
    code === 'FORBIDDEN' ||
    code === 'LICENSE_SEAT_LIMIT' ||
    code === 'LICENSE_EXPIRED' ||
    code === 'LICENSE_INACTIVE' ||
    code === 'LICENSE_REQUIRED' ||
    status === 403
  ) {
    return new CloudClientError('forbidden', code, message, 403)
  }
  if (code === 'NOT_FOUND' || status === 404) {
    return new CloudClientError('not_found', code, message, 404)
  }
  if (
    code === 'CONFLICT' ||
    code === 'EMAIL_TAKEN' ||
    code === 'LICENSE_ALREADY_REGISTERED' ||
    code === 'BOOTSTRAP_CONFLICT' ||
    code === 'ALREADY_IN_ORGANIZATION' ||
    code === 'MEMBERSHIP_EXISTS' ||
    code === 'LICENSE_BINDING_CONFLICT' ||
    status === 409
  ) {
    return new CloudClientError('conflict', code, message, status || 409)
  }
  if (code === 'NETWORK' || code === 'TIMEOUT') {
    return new CloudClientError('network', code, message, 0)
  }
  if (code === 'SERVER' || status >= 500) {
    return new CloudClientError('server', code, message, status)
  }
  if (code === 'VALIDATION' || code === 'VALIDATION_ERROR' || status === 400 || status === 422) {
    return new CloudClientError('validation', code, message, status || 400)
  }
  if (code === 'UNKNOWN' && status === 0) {
    return new CloudClientError('unknown', code, message, status)
  }
  if (status === 0 && code !== 'VALIDATION') {
    return new CloudClientError('network', code, message, 0)
  }
  return new CloudClientError('unknown', code, message, status)
}

export function cloudErrorLabel(error: CloudClientError): string {
  switch (error.kind) {
    case 'credentials':
      return 'Identifiants invalides'
    case 'expired':
      return 'Session expirée (401)'
    case 'unauthorized':
      return 'Session expirée ou invalide (401)'
    case 'forbidden':
      if (error.code === 'LICENSE_SEAT_LIMIT') {
        return 'Limite de sièges licence atteinte'
      }
      if (error.code === 'LICENSE_EXPIRED' || error.code === 'LICENSE_INACTIVE') {
        return 'Licence cabinet expirée ou inactive'
      }
      return 'Permission refusée (403)'
    case 'not_found':
      return 'Ressource introuvable (404)'
    case 'conflict':
      return error.message || 'Conflit (409) — email ou licence déjà utilisés'
    case 'network':
      return 'Serveur Cloud inaccessible (réseau)'
    case 'server':
      return error.message || 'Erreur serveur Cloud (5xx)'
    case 'disabled':
      return 'Mode Cloud désactivé'
    case 'storage':
      return 'safeStorage indisponible — session non stockée'
    case 'validation':
      return error.message || 'Données invalides'
    default:
      return error.message
  }
}

export function isSessionExpiredError(error: unknown): boolean {
  return error instanceof CloudClientError && (error.kind === 'expired' || error.kind === 'unauthorized')
}

/** True only for real connectivity failures (no HTTP response). */
export function isCloudUnreachableError(error: unknown): boolean {
  return error instanceof CloudClientError && error.kind === 'network'
}
