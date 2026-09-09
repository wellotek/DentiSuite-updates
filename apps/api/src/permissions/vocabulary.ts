/**
 * Canonical DentiSuite permission vocabulary (resource.action).
 * Single source of truth — do not duplicate these strings elsewhere.
 */

export const PERMISSIONS = [
  // Patients
  'patients.read',
  'patients.create',
  'patients.update',
  'patients.delete',
  // Appointments
  'appointments.read',
  'appointments.create',
  'appointments.update',
  'appointments.delete',
  // Consultations
  'consultations.read',
  'consultations.create',
  'consultations.update',
  'consultations.delete',
  // Prescriptions
  'prescriptions.read',
  'prescriptions.create',
  'prescriptions.update',
  'prescriptions.delete',
  // Dentists
  'dentists.read',
  'dentists.create',
  'dentists.update',
  'dentists.delete',
  // Documents
  'documents.read',
  'documents.upload',
  'documents.delete',
  // Imaging
  'imaging.read',
  'imaging.upload',
  'imaging.delete',
  // Billing
  'billing.read',
  'billing.create',
  'billing.update',
  'billing.delete',
  // Stock
  'stock.read',
  'stock.create',
  'stock.update',
  'stock.delete',
  // Reports
  'reports.read',
  // Settings
  'settings.read',
  'settings.update',
  // Team
  'team.read',
  'team.create',
  'team.update',
  'team.delete',
  // Audit / license / devices / profile
  'audit.read',
  'license.read',
  'devices.read',
  'devices.revoke',
  'profile.read',
  'profile.update',
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSIONS);

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_SET.has(value);
}

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  'patients.read': 'View patients',
  'patients.create': 'Create patients',
  'patients.update': 'Update patients',
  'patients.delete': 'Delete patients',
  'appointments.read': 'View appointments',
  'appointments.create': 'Create appointments',
  'appointments.update': 'Update appointments',
  'appointments.delete': 'Delete appointments',
  'consultations.read': 'View consultations',
  'consultations.create': 'Create consultations',
  'consultations.update': 'Update consultations',
  'consultations.delete': 'Delete consultations',
  'prescriptions.read': 'View prescriptions',
  'prescriptions.create': 'Create prescriptions',
  'prescriptions.update': 'Update prescriptions',
  'prescriptions.delete': 'Delete prescriptions',
  'dentists.read': 'View dentists',
  'dentists.create': 'Create dentists',
  'dentists.update': 'Update dentists',
  'dentists.delete': 'Delete dentists',
  'documents.read': 'View documents',
  'documents.upload': 'Upload documents',
  'documents.delete': 'Delete documents',
  'imaging.read': 'View imaging',
  'imaging.upload': 'Upload imaging',
  'imaging.delete': 'Delete imaging',
  'billing.read': 'View billing',
  'billing.create': 'Create billing',
  'billing.update': 'Update billing',
  'billing.delete': 'Delete billing',
  'stock.read': 'View stock',
  'stock.create': 'Create stock',
  'stock.update': 'Update stock',
  'stock.delete': 'Delete stock',
  'reports.read': 'View reports',
  'settings.read': 'View settings',
  'settings.update': 'Update settings',
  'team.read': 'View team',
  'team.create': 'Create team members',
  'team.update': 'Update team members',
  'team.delete': 'Remove team members',
  'audit.read': 'View audit logs',
  'license.read': 'View license status',
  'devices.read': 'View devices',
  'devices.revoke': 'Revoke devices',
  'profile.read': 'View own profile',
  'profile.update': 'Update own profile',
};

/** ASSISTANT role defaults (explicit allow-list). */
export const ASSISTANT_PERMISSIONS: readonly PermissionKey[] = [
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
] as const;

export const ASSISTANT_PERMISSION_SET: ReadonlySet<PermissionKey> = new Set(
  ASSISTANT_PERMISSIONS,
);

/** ADMIN receives every defined permission. */
export const ADMIN_PERMISSIONS: readonly PermissionKey[] = PERMISSIONS;

export function roleDefaultPermissions(
  role: 'ADMIN' | 'ASSISTANT',
): ReadonlySet<PermissionKey> {
  if (role === 'ADMIN') {
    return PERMISSION_SET as ReadonlySet<PermissionKey>;
  }
  return ASSISTANT_PERMISSION_SET;
}
