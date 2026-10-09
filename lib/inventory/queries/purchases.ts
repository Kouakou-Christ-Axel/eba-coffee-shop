import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { num } from './helpers';

export interface PurchaseFilters {
  dateFrom?: Date;
  dateTo?: Date;
  itemId?: string;
}

/** Journal des entrées (achats) filtré + total valeur. */
export async function listInventoryPurchases(filters: PurchaseFilters = {}) {
  const where: Prisma.InventoryPurchaseWhereInput = {};
  if (filters.dateFrom || filters.dateTo) {
    where.date = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }
  if (filters.itemId) where.itemId = filters.itemId;
  const [purchases, agg] = await Promise.all([
    prisma.inventoryPurchase.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        item: { select: { id: true, sku: true, name: true, unit: true } },
        batch: { select: { id: true, canceledAt: true, source: true } },
        expense: { select: { id: true, receiptNo: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.inventoryPurchase.aggregate({ where, _sum: { totalCost: true } }),
  ]);
  return {
    purchases: purchases.map((p) => ({
      id: p.id,
      date: p.date.toISOString().slice(0, 10),
      item: p.item,
      quantity: num(p.quantity),
      unitCost: p.unitCost,
      totalCost: p.totalCost,
      supplier: p.supplier,
      batchId: p.batchId,
      batchSource: p.batch?.source ?? null,
      canceled: Boolean(p.batch?.canceledAt),
      receiptNo: p.expense?.receiptNo ?? null,
      by: p.createdBy?.name ?? null,
    })),
    totalValue: agg._sum.totalCost ?? 0,
  };
}

/** Liste des lots de réappro (pour l'historique + annulation). */
export async function listRestockBatches(limit = 50) {
  const batches = await prisma.inventoryRestockBatch.findMany({
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: {
      expense: { select: { id: true, receiptNo: true } },
      createdBy: { select: { name: true } },
      _count: { select: { purchases: true } },
      purchases: { select: { totalCost: true } },
    },
  });
  return batches.map((b) => ({
    id: b.id,
    date: b.date.toISOString().slice(0, 10),
    supplier: b.supplier,
    note: b.note,
    source: b.source,
    lineCount: b._count.purchases,
    total: b.purchases.reduce((s, p) => s + p.totalCost, 0),
    receiptNo: b.expense?.receiptNo ?? null,
    canceled: Boolean(b.canceledAt),
    by: b.createdBy?.name ?? null,
  }));
}
