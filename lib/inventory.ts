// lib/inventory.ts
//
// Lecture de l'inventaire périodique (back-office). Les écritures vivent dans
// lib/inventory-mutations.ts. Toutes les quantités Decimal de Prisma sont
// converties en `number` ici — on ne laisse jamais fuiter de Decimal côté client.

import { cache } from 'react';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';

/** Decimal Prisma → number (les quantités stock tiennent largement dans un float). */
function num(d: Prisma.Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : d.toNumber();
}

export interface InventoryFilters {
  search?: string;
  category?: string;
  /** Ne garder que les articles sous le seuil (calculé en JS). */
  lowStockOnly?: boolean;
  /** Filtre l'état actif/archivé. Défaut : actifs uniquement. */
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

function buildInventoryWhere({
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

function toView(item: {
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

/**
 * Liste des références (vues planes), filtrées. `lowStockOnly` filtré en JS.
 * `cache()` : réutilisée par plusieurs sections Suspense indépendantes de la
 * page Inventaire (Phase 2 — alerte stock bas, onglets référence/comptage/
 * réappro) ; dédupliquée par React quand appelée sans argument (l'objet par
 * défaut `{}` n'entre pas dans la clé de cache tant qu'aucun argument
 * explicite n'est passé).
 */
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

export type InventorySummary = {
  activeCount: number;
  lowStockCount: number;
  stockValue: number;
  neverCounted: number;
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
  for (const it of items) {
    const qty = num(it.currentQuantity);
    const threshold =
      it.reorderPoint === null ? num(it.safetyStock) : num(it.reorderPoint);
    if (threshold > 0 && qty <= threshold) lowStockCount++;
    stockValue += Math.round(qty * it.avgUnitCost);
    if (!it.lastCountedAt) neverCounted++;
  }
  return {
    activeCount: items.length,
    lowStockCount,
    stockValue,
    neverCounted,
  };
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

/** Liste des comptages (sessions), avec totaux agrégés. */
export async function listInventoryCounts(limit = 50) {
  const counts = await prisma.inventoryCount.findMany({
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { lines: true } },
    },
  });
  return counts.map((c) => ({
    id: c.id,
    date: c.date.toISOString().slice(0, 10),
    label: c.label,
    note: c.note,
    lineCount: c._count.lines,
    by: c.createdBy?.name ?? null,
  }));
}

/** Rapport de période : détail d'un comptage (entrées/sorties figées par ligne). */
export async function getInventoryCount(id: string) {
  const count = await prisma.inventoryCount.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      lines: {
        include: {
          item: { select: { id: true, sku: true, name: true, unit: true } },
        },
        orderBy: { item: { name: 'asc' } },
      },
    },
  });
  if (!count) return null;
  const lines = count.lines.map((l) => {
    const consumption = num(l.consumption);
    return {
      itemId: l.itemId,
      item: l.item,
      openingQuantity: num(l.openingQuantity),
      purchasesQuantity: num(l.purchasesQuantity),
      countedQuantity: num(l.countedQuantity),
      consumption,
      unitCostSnapshot: l.unitCostSnapshot,
      consumptionValue: Math.round(consumption * l.unitCostSnapshot),
      stockValue: Math.round(num(l.countedQuantity) * l.unitCostSnapshot),
    };
  });
  return {
    id: count.id,
    date: count.date.toISOString().slice(0, 10),
    label: count.label,
    note: count.note,
    by: count.createdBy?.name ?? null,
    lines,
    totals: {
      consumptionValue: lines.reduce((s, l) => s + l.consumptionValue, 0),
      stockValue: lines.reduce((s, l) => s + l.stockValue, 0),
    },
  };
}

/**
 * Nombre de jours depuis le dernier comptage (global). `null` si jamais compté.
 * Sert au rappel email et à la bannière.
 */
export async function getDaysSinceLastCount(): Promise<number | null> {
  const last = await prisma.inventoryCount.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  if (!last) return null;
  const ms = Date.now() - last.date.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
