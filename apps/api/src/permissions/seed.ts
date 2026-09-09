import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  ADMIN_PERMISSIONS,
  ASSISTANT_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  PERMISSIONS,
  type PermissionKey,
} from './vocabulary.js';

/**
 * Idempotent permission + role-default seed.
 * Does not create users, organizations, or clinical data.
 *
 * Design: hybrid — code owns vocabulary/defaults; DB mirrors them for FKs/overrides.
 */
export async function seedPermissions(prisma: PrismaClient): Promise<{
  permissions: number;
  rolePermissions: number;
}> {
  const permissionIds = new Map<PermissionKey, string>();

  for (const key of PERMISSIONS) {
    const existing = await prisma.permission.findUnique({ where: { key } });
    if (existing) {
      permissionIds.set(key, existing.id);
      if (existing.description !== PERMISSION_DESCRIPTIONS[key]) {
        await prisma.permission.update({
          where: { id: existing.id },
          data: { description: PERMISSION_DESCRIPTIONS[key] },
        });
      }
      continue;
    }

    const created = await prisma.permission.create({
      data: {
        id: randomUUID(),
        key,
        description: PERMISSION_DESCRIPTIONS[key],
      },
    });
    permissionIds.set(key, created.id);
  }

  let rolePermissionCount = 0;

  async function ensureRolePermission(
    role: 'ADMIN' | 'ASSISTANT',
    key: PermissionKey,
  ): Promise<void> {
    const permissionId = permissionIds.get(key);
    if (!permissionId) {
      throw new Error(`Missing permission id for ${key}`);
    }

    const existing = await prisma.rolePermission.findUnique({
      where: {
        role_permissionId: { role, permissionId },
      },
    });
    if (existing) {
      rolePermissionCount += 1;
      return;
    }

    await prisma.rolePermission.create({
      data: {
        id: randomUUID(),
        role,
        permissionId,
      },
    });
    rolePermissionCount += 1;
  }

  for (const key of ADMIN_PERMISSIONS) {
    await ensureRolePermission('ADMIN', key);
  }
  for (const key of ASSISTANT_PERMISSIONS) {
    await ensureRolePermission('ASSISTANT', key);
  }

  // Remove role permissions that are no longer in the canonical set (deterministic sync).
  const adminKeys = new Set<string>(ADMIN_PERMISSIONS);
  const assistantKeys = new Set<string>(ASSISTANT_PERMISSIONS);
  const allRolePerms = await prisma.rolePermission.findMany({
    include: { permission: true },
  });

  for (const row of allRolePerms) {
    const allowed =
      row.role === 'ADMIN'
        ? adminKeys.has(row.permission.key)
        : assistantKeys.has(row.permission.key);
    if (!allowed) {
      await prisma.rolePermission.delete({ where: { id: row.id } });
    }
  }

  return {
    permissions: PERMISSIONS.length,
    rolePermissions: rolePermissionCount,
  };
}
