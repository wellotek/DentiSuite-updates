import type { Membership, Prisma, PrismaClient, User } from '@prisma/client';

export type AuditActor = {
  user: User;
  membership?: Pick<Membership, 'role'> | null;
};

export type WriteAuditInput = {
  organizationId: string;
  actor?: AuditActor | null;
  action: string;
  module: string;
  resourceType?: string;
  resourceId?: string;
  summary?: string;
  details?: Prisma.InputJsonValue;
};

export async function writeAuditLog(
  prisma: PrismaClient,
  input: WriteAuditInput,
): Promise<void> {
  const actor = input.actor;
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: actor?.user.id ?? null,
        actorUsername: actor?.user.username ?? null,
        actorDisplayName:
          actor?.user.displayName ??
          actor?.user.username ??
          actor?.user.email ??
          null,
        actorRole: actor?.membership?.role ?? null,
        action: input.action,
        module: input.module,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        summary: input.summary ?? null,
        details: input.details ?? undefined,
      },
    });
  } catch {
    // Never fail the business operation because audit write failed.
  }
}

export function actorLabel(actor?: AuditActor | null): string {
  if (!actor?.user) return 'Système';
  return (
    actor.user.displayName ||
    (actor.user.username ? `@${actor.user.username}` : null) ||
    actor.user.email
  );
}
