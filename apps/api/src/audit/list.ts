import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export const listAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  module: z.string().trim().max(64).optional(),
  resourceId: z.string().uuid().optional(),
});

export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;

export type PublicAuditLog = {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  actorUsername: string | null;
  actorDisplayName: string | null;
  actorRole: string | null;
  action: string;
  module: string;
  resourceType: string | null;
  resourceId: string | null;
  summary: string | null;
  details: unknown;
  createdAt: string;
};

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(
    organizationId: string,
    query: ListAuditQuery,
  ): Promise<{
    items: PublicAuditLog[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const where = {
      organizationId,
      ...(query.module ? { module: query.module } : {}),
      ...(query.resourceId ? { resourceId: query.resourceId } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        organizationId: r.organizationId,
        actorUserId: r.actorUserId,
        actorUsername: r.actorUsername,
        actorDisplayName: r.actorDisplayName,
        actorRole: r.actorRole,
        action: r.action,
        module: r.module,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        summary: r.summary,
        details: r.details,
        createdAt: r.createdAt.toISOString(),
      })),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit) || 1),
    };
  }
}
