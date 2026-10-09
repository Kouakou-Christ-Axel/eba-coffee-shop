import { cache } from 'react';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { num } from './helpers';

export interface InventoryFilters {
  search?: string;
  category?: string;
  /** Ne garder que les articles sous le seuil (calculé en JS). */
  lowStockOnly?: boolean;
  /** Filtre l'état actif/archivé. */
  active?: boolean;
}

export type InventoryItemView = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  currentQuantity: number;
  avgUnitCost: number;
  stockValue: number;
  safetyStock: number;
  reorderPoint: number | null;
  supplier: string | null;
  notes: string | null;
  active: boolean;
  lastCountedAt: string | null;
  isLowStock: boolean;
};

export function buildInventoryWhere({
  search,
  category,
  active,
}: InventoryFilters): Prisma.InventoryItemWhereInput {
  const where: Prisma.InventoryItemWhereInput = {};
  where.active = active ?? true;
  if (category) where.category = category;
  const q = search?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
      { supplier: { contains: q, mode: 'insensitive' } },
    ];
  }
  return where;
}

export function toView(item: {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  currentQuantity: Prisma.Decimal;
  avgUnitCost: number;
  safetyStock: Prisma.Decimal;
  reorderPoint: Prisma.Decimal | null;
  supplier: string | null;
  notes: string | null;
  active: boolean;
  lastCountedAt: Date | null;
}): InventoryItemView {
  const currentQuantity = num(item.currentQuantity);
  const safetyStock = num(item.safetyStock);
  const reorderPoint =
    item.reorderPoint === null ? null : num(item.reorderPoint);
  const threshold = reorderPoint ?? safetyStock;
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    category: item.category,
    unit: item.unit,
    currentQuantity,
    avgUnitCost: item.avgUnitCost,
    stockValue: Math.round(currentQuantity * item.avgUnitCost),
    safetyStock,
    reorderPoint,
    supplier: item.supplier,
    notes: item.notes,
    active: item.active,
    lastCountedAt: item.lastCountedAt
      ? item.lastCountedAt.toISOString().slice(0, 10)
      : null,
    isLowStock: threshold > 0 && currentQuantity <= threshold,
  };
}

/** Liste des références (vues planes), filtrées. */
export const listInventoryItems = cache(async function listInventoryItems(
  filters: InventoryFilters = {}
): Promise<InventoryItemView[]> {
  const items = await prisma.inventoryItem.findMany({
    where: buildInventoryWhere(filters),
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  const views = items.map(toView);
  return filters.lowStockOnly ? views.filter((v) => v.isLowStock) : views;
});

/** Détail d'une référence + derniers achats + dernières lignes de comptage. */
export async function getInventoryItem(id: string) {
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) return null;
  const [purchases, countLines] = await Promise.all([
    prisma.inventoryPurchase.findMany({
      where: { itemId: id },
      orderBy: { date: 'desc' },
      take: 20,
      include: {
        batch: { select: { id: true, canceledAt: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.inventoryCountLine.findMany({
      where: { itemId: id },
      orderBy: { count: { date: 'desc' } },
      take: 20,
      include: { count: { select: { id: true, date: true, label: true } } },
    }),
  ]);
  return {
    item: toView(item),
    purchases: purchases.map((p) => ({
      id: p.id,
      date: p.date.toISOString().slice(0, 10),
      quantity: num(p.quantity),
      unitCost: p.unitCost,
      totalCost: p.totalCost,
      supplier: p.supplier,
      batchId: p.batchId,
      canceled: Boolean(p.batch?.canceledAt),
      by: p.createdBy?.name ?? null,
    })),
    countLines: countLines.map((l) => ({
      countId: l.countId,
      date: l.count.date.toISOString().slice(0, 10),
      label: l.count.label,
      openingQuantity: num(l.openingQuantity),
      purchasesQuantity: num(l.purchasesQuantity),
      countedQuantity: num(l.countedQuantity),
      consumption: num(l.consumption),
      unitCostSnapshot: l.unitCostSnapshot,
    })),
  };
}
