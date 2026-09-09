/** Phase 7B — Cloud auth types (renderer). Token never stored here. */

export type CloudAuthState =
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'AUTH_ERROR'

export type CloudAppConfig = {
  /** Product mode — CLOUD is the client release default when packaged. */
  appMode: 'CLOUD' | 'LEGACY'
  /** True when Cloud APIs/IPC are active */
  cloudMode: boolean
  /** Compat alias of cloudMode (historical probe flag) */
  probeEnabled: boolean
  apiBaseUrl: string
}

/** @deprecated use CloudAppConfig */
export type CloudProbeConfig = CloudAppConfig


export type CloudUser = {
  id: string
  email: string
  username?: string | null
  displayName?: string | null
  status?: string
}

export type CloudOrganization = {
  id: string
  name: string
  slug: string
  status: string
}

export type CloudMembership = {
  id: string
  userId: string
  organizationId: string
  role: 'ADMIN' | 'ASSISTANT' | string
  status: string
}

export type CloudPermissionsBundle = {
  organizationId: string | null
  membershipId: string | null
  role: string | null
  permissions: string[]
}

export type CloudSessionContext = {
  state?: CloudAuthState
  /** Legacy 7A aliases kept for probe UI */
  status: 'none' | 'expired' | 'authenticated' | 'authenticating' | 'error'
  authenticated?: boolean
  user?: CloudUser | null
  organization?: CloudOrganization | null
  membership?: CloudMembership | null
  role?: string | null
  permissions?: CloudPermissionsBundle | null
}

export type CloudIpcError = {
  ok: false
  code: string
  message: string
  status: number
  state?: CloudAuthState
}

/** Cloud UUID patient — API entity. In CLOUD mode mirrored into Zustand memory (never saveClinic). */
export type CloudPatient = {
  id: string
  organizationId: string
  firstName: string
  lastName: string
  phone: string
  age: number
  address: string
  antecedents: string
  hasAllergies: boolean
  dentistId: string | null
  notes: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type CloudPatientList = {
  items: CloudPatient[]
  page: number
  limit: number
  total: number
  totalPages: number
}

/** Phase 8B — create input (no organizationId; session-derived on API). */
export type CloudPatientCreateInput = {
  firstName: string
  lastName: string
  phone: string
  age: number
  address?: string
  antecedents?: string
  hasAllergies?: boolean
  dentistId?: string | null
  notes?: string | null
}

/** Phase 8C — update input (UUID id + partial fields; no organizationId). */
export type CloudPatientUpdateInput = {
  id: string
  firstName?: string
  lastName?: string
  phone?: string
  age?: number
  address?: string
  antecedents?: string
  hasAllergies?: boolean
  dentistId?: string | null
  notes?: string | null
}

export type CloudRequestInput = {
  method?: string
  path: string
  query?: Record<string, string | number | undefined | null>
  body?: unknown
  auth?: boolean
}
