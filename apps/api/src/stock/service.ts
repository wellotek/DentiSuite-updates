import type { PrismaClient, StockItem } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { formatCalendarDate } from '../appointments/schemas.js';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import type { TenantScope } from '../patients/repository.js';
import { StockItemRepository } from './repository.js';
import type {
  CreateStockItemInput,
  ListStockQuery,
  UpdateStockItemInput,
} from './schemas.js';

export type PublicStockItem = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  addedAt: string;
  expiryDate: string | null;
  supplier: string;
  createdAt: string;
  updatedAt: string;
};

export class StockService {
  private readonly stock: StockItemRepository;

  constructor(
    prisma: PrismaClient,
    private readonly logger: Logger,
  ) {
    this.stock = new StockItemRepository(prisma);
  }

  toPublic(row: StockItem): PublicStockItem {
    return {
      id: row.id,
      organizationId: row.organizationId,
      code: row.code,
      name: row.name,
      category: row.category,
      quantity: row.quantity,
      minQuantity: row.minQuantity,
      unitPrice: row.unitPrice,
      addedAt: formatCalendarDate(row.addedAt),
      expiryDate: row.expiryDate ? formatCalendarDate(row.expiryDate) : null,
      supplier: row.supplier,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(scope: TenantScope, input: CreateStockItemInput) {
    const row = await this.stock.create(scope, randomUUID(), input);
    this.logger.info(
      {
        stockEvent: 'stock_created',
        organizationId: scope.organizationId,
        stockItemId: row.id,
      },
      'Stock item created',
    );
    return this.toPublic(row);
  }

  async list(scope: TenantScope, query: ListStockQuery) {
    const { items, total } = await this.stock.list(scope, query);
    return {
      items: items.map((i) => this.toPublic(i)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit) || 1),
    };
  }

  async get(scope: TenantScope, id: string) {
    const row = await this.stock.findById(scope, id);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Stock item not found');
    return this.toPublic(row);
  }

  async update(scope: TenantScope, id: string, input: UpdateStockItemInput) {
    const row = await this.stock.update(scope, id, input);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Stock item not found');
    this.logger.info(
      {
        stockEvent: 'stock_updated',
        organizationId: scope.organizationId,
        stockItemId: row.id,
      },
      'Stock item updated',
    );
    return this.toPublic(row);
  }

  async delete(scope: TenantScope, id: string) {
    const deleted = await this.stock.delete(scope, id);
    if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Stock item not found');
    this.logger.info(
      {
        stockEvent: 'stock_deleted',
        organizationId: scope.organizationId,
        stockItemId: id,
      },
      'Stock item deleted',
    );
  }
}
