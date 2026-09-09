import { cloudApi, asList, type CloudListResult } from '../api'

export type CloudTeamMember = {
  membershipId: string
  userId: string
  email: string
  username: string | null
  displayName: string | null
  userStatus: 'ACTIVE' | 'DISABLED'
  role: 'ADMIN' | 'ASSISTANT'
  status: 'ACTIVE' | 'DISABLED'
  permissions: string[]
  overrides: Array<{ permission: string; effect: 'ALLOW' | 'DENY' }>
  createdAt: string
  updatedAt: string
  disabledAt: string | null
}

export type CloudTeamCreateInput = {
  username: string
  displayName?: string
  email?: string
  password: string
  role: 'ADMIN' | 'ASSISTANT'
  permissions?: string[]
  customPermissions?: string[]
}

export type CloudTeamUpdateInput = {
  username?: string
  displayName?: string | null
  email?: string
  role?: 'ADMIN' | 'ASSISTANT'
  status?: 'ACTIVE' | 'DISABLED'
  permissions?: string[]
  customPermissions?: string[]
  password?: string
}

export async function listTeamMembers(query: Record<string, string | number | undefined> = {}) {
  const data = await cloudApi<Partial<CloudListResult<CloudTeamMember>>>({
    method: 'GET',
    path: '/team',
    query,
  })
  return asList(data)
}

export async function createTeamMember(body: CloudTeamCreateInput) {
  const data = await cloudApi<{ member: CloudTeamMember }>({
    method: 'POST',
    path: '/team',
    body,
  })
  return data.member
}

export async function updateTeamMember(membershipId: string, body: CloudTeamUpdateInput) {
  const data = await cloudApi<{ member: CloudTeamMember }>({
    method: 'PATCH',
    path: `/team/${membershipId}`,
    body,
  })
  return data.member
}

export async function removeTeamMember(membershipId: string) {
  await cloudApi({ method: 'DELETE', path: `/team/${membershipId}` })
}

export type CloudAuditLog = {
  id: string
  organizationId: string
  actorUserId: string | null
  actorUsername: string | null
  actorDisplayName: string | null
  actorRole: string | null
  action: string
  module: string
  resourceType: string | null
  resourceId: string | null
  summary: string | null
  details: unknown
  createdAt: string
}

export async function listAuditLogs(query: Record<string, string | number | undefined> = {}) {
  const data = await cloudApi<Partial<CloudListResult<CloudAuditLog>>>({
    method: 'GET',
    path: '/audit',
    query,
  })
  return asList(data)
}

/** Permission groups for the admin matrix UI. */
export const TEAM_PERMISSION_GROUPS: Array<{
  id: string
  label: string
  permissions: Array<{ key: string; label: string }>
}> = [
  {
    id: 'patients',
    label: 'Patients',
    permissions: [
      { key: 'patients.read', label: 'Lire' },
      { key: 'patients.create', label: 'Créer' },
      { key: 'patients.update', label: 'Modifier' },
      { key: 'patients.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'appointments',
    label: 'Agenda / RDV',
    permissions: [
      { key: 'appointments.read', label: 'Lire' },
      { key: 'appointments.create', label: 'Créer' },
      { key: 'appointments.update', label: 'Modifier' },
      { key: 'appointments.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'clinical',
    label: 'Clinique / Schéma',
    permissions: [
      { key: 'consultations.read', label: 'Lire consultations' },
      { key: 'consultations.create', label: 'Créer consultations' },
      { key: 'consultations.update', label: 'Modifier consultations' },
      { key: 'consultations.delete', label: 'Supprimer consultations' },
    ],
  },
  {
    id: 'prescriptions',
    label: 'Ordonnances',
    permissions: [
      { key: 'prescriptions.read', label: 'Lire' },
      { key: 'prescriptions.create', label: 'Créer' },
      { key: 'prescriptions.update', label: 'Modifier' },
      { key: 'prescriptions.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'billing',
    label: 'Facturation / Caisse',
    permissions: [
      { key: 'billing.read', label: 'Lire' },
      { key: 'billing.create', label: 'Créer' },
      { key: 'billing.update', label: 'Modifier' },
      { key: 'billing.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'stock',
    label: 'Stock',
    permissions: [
      { key: 'stock.read', label: 'Lire' },
      { key: 'stock.create', label: 'Créer' },
      { key: 'stock.update', label: 'Modifier' },
      { key: 'stock.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    permissions: [
      { key: 'documents.read', label: 'Lire' },
      { key: 'documents.upload', label: 'Upload' },
      { key: 'documents.delete', label: 'Supprimer' },
    ],
  },
]

/** Default ASSISTANT allow-list mirrored for UI (must stay aligned with API vocabulary). */
export const DEFAULT_ASSISTANT_PERMISSIONS: string[] = [
  'patients.read',
  'patients.create',
  'patients.update',
  'appointments.read',
  'appointments.create',
  'appointments.update',
  'consultations.read',
  'consultations.create',
  'consultations.update',
  'prescriptions.read',
  'prescriptions.create',
  'prescriptions.update',
  'dentists.read',
  'documents.read',
  'documents.upload',
  'imaging.read',
  'imaging.upload',
  'stock.read',
  'reports.read',
  'profile.read',
  'profile.update',
  'devices.read',
  'devices.revoke',
]

export function memberDisplayLabel(m: CloudTeamMember): string {
  if (m.displayName) return m.displayName
  if (m.username) return m.username
  return m.email
}
