import prisma from '@/lib/prisma';
import { num } from './helpers';
import { type InventoryItemView, listInventoryItems } from './items';

export type InventorySummary = {
  activeCount: number;
  lowStockCount: number;
  stockValue: number;
  neverCounted: number;
  /** Références actives ayant un PMP non nul. */
  valuedCount: number;
};

/** KPIs de l'inventaire (références actives). */
export async function getInventorySummary(): Promise<InventorySummary> {
  const items = await prisma.inventoryItem.findMany({
    where: { active: true },
    select: {
      currentQuantity: true,
      avgUnitCost: true,
      safetyStock: true,
      reorderPoint: true,
      lastCountedAt: true,
    },
  });
  let lowStockCount = 0;
  let stockValue = 0;
  let neverCounted = 0;
  let valuedCount = 0;
  for (const it of items) {
    const qty = num(it.currentQuantity);
    const threshold =
      it.reorderPoint === null ? num(it.safetyStock) : num(it.reorderPoint);
    if (threshold > 0 && qty <= threshold) lowStockCount++;
    stockValue += Math.round(qty * it.avgUnitCost);
    if (it.avgUnitCost > 0) valuedCount++;
    if (!it.lastCountedAt) neverCounted++;
  }
  return {
    activeCount: items.length,
    lowStockCount,
    stockValue,
    neverCounted,
    valuedCount,
  };
}

/** Dernier coût unitaire connu par référence, lots annulés exclus. */
export async function listLastPurchaseCosts(): Promise<
  Map<string, { unitCost: number; date: string }>
> {
  const purchases = await prisma.inventoryPurchase.findMany({
    where: {
      unitCost: { gt: 0 },
      OR: [{ batchId: null }, { batch: { is: { canceledAt: null } } }],
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { itemId: true, unitCost: true, date: true },
  });
  const byItem = new Map<string, { unitCost: number; date: string }>();
  for (const p of purchases) {
    // Trié du plus récent au plus ancien : le premier vu par article gagne.
    if (byItem.has(p.itemId)) continue;
    byItem.set(p.itemId, {
      unitCost: p.unitCost,
      date: p.date.toISOString().slice(0, 10),
    });
  }
  return byItem;
}

/** Références actives sous leur seuil (réappro/réorder, alerte). */
export async function listLowStockItems(): Promise<InventoryItemView[]> {
  return listInventoryItems({ lowStockOnly: true });
}

/** Catégories distinctes (pour filtres / regroupement). */
export async function listInventoryCategories(): Promise<string[]> {
  const rows = await prisma.inventoryItem.findMany({
    where: { active: true, category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category!).filter(Boolean);
}
