import prisma from '@/lib/prisma';
import { num } from './helpers';

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

/** Nombre de jours depuis le dernier comptage (global). */
export async function getDaysSinceLastCount(): Promise<number | null> {
  const last = await prisma.inventoryCount.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  if (!last) return null;
  const ms = Date.now() - last.date.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
