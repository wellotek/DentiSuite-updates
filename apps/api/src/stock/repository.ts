import type { Prisma, PrismaClient, StockItem } from '@prisma/client';
import { parseCalendarDate } from '../appointments/schemas.js';
import type { TenantScope } from '../patients/repository.js';
import type {
  CreateStockItemInput,
  ListStockQuery,
  UpdateStockItemInput,
} from './schemas.js';

export class StockItemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    scope: TenantScope,
    id: string,
    data: CreateStockItemInput,
  ): Promise<StockItem> {
    return this.prisma.stockItem.create({
      data: {
        id,
        organizationId: scope.organizationId,
        code: data.code,
        name: data.name,
        category: data.category,
        quantity: data.quantity,
        minQuantity: data.minQuantity,
        unitPrice: data.unitPrice,
        addedAt: parseCalendarDate(data.addedAt),
        expiryDate: data.expiryDate ? parseCalendarDate(data.expiryDate) : null,
        supplier: data.supplier,
        updatedAt: new Date(),
      },
    });
  }

  async findById(scope: TenantScope, id: string): Promise<StockItem | null> {
    return this.prisma.stockItem.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  async list(
    scope: TenantScope,
    query: ListStockQuery,
  ): Promise<{ items: StockItem[]; total: number }> {
    const where: Prisma.StockItemWhereInput = {
      organizationId: scope.organizationId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { code: { contains: query.q, mode: 'insensitive' } },
              { supplier: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.stockItem.count({ where }),
      this.prisma.stockItem.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return { items, total };
  }

  async update(
    scope: TenantScope,
    id: string,
    data: UpdateStockItemInput,
  ): Promise<StockItem | null> {
    const existing = await this.findById(scope, id);
    if (!existing) return null;
    return this.prisma.stockItem.update({
      where: { id: existing.id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
        ...(data.minQuantity !== undefined
          ? { minQuantity: data.minQuantity }
          : {}),
        ...(data.unitPrice !== undefined ? { unitPrice: data.unitPrice } : {}),
        ...(data.addedAt !== undefined
          ? { addedAt: parseCalendarDate(data.addedAt) }
          : {}),
        ...(data.expiryDate !== undefined
          ? {
              expiryDate: data.expiryDate
                ? parseCalendarDate(data.expiryDate)
                : null,
            }
          : {}),
        ...(data.supplier !== undefined ? { supplier: data.supplier } : {}),
        updatedAt: new Date(),
      },
    });
  }

  async delete(scope: TenantScope, id: string): Promise<boolean> {
    const existing = await this.findById(scope, id);
    if (!existing) return false;
    await this.prisma.stockItem.delete({ where: { id: existing.id } });
    return true;
  }
}
