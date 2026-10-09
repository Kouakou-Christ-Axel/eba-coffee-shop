import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import {
  computeCountLines,
  earliestPreviousDate,
  latestPreviousByItem,
} from '@/lib/inventory-count-math';
import { batchCountSchema } from '@/lib/schemas/inventory';
import { num } from './helpers';

/** Enregistre un comptage physique. */
export async function recordInventoryCount(
  input: unknown,
  createdById?: string
) {
  const data = batchCountSchema.parse(input);
  const date = parseDateOnlyToUTC(data.date)!;
  const itemIds = data.lines.map((l) => l.itemId);

  return prisma.$transaction(
    async (tx) => {
      // 1. PMP courant des articles comptés (et contrôle d'existence).
      const items = await tx.inventoryItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, avgUnitCost: true },
      });
      const avgUnitCostByItem = new Map(
        items.map((it) => [it.id, it.avgUnitCost])
      );
      const missing = itemIds.find((id) => !avgUnitCostByItem.has(id));
      if (missing) throw new Error(`Article introuvable : ${missing}`);

      const previousRows = await tx.inventoryCountLine.findMany({
        where: { itemId: { in: itemIds }, count: { date: { lt: date } } },
        select: {
          itemId: true,
          countedQuantity: true,
          count: { select: { date: true, createdAt: true } },
        },
      });
      const previousLines = previousRows.map((row) => ({
        itemId: row.itemId,
        countedQuantity: num(row.countedQuantity),
        countDate: row.count.date,
        sequence: row.count.createdAt.getTime(),
      }));

      const previousByItem = latestPreviousByItem(previousLines, date);
      const since = earliestPreviousDate(previousByItem, itemIds);
      const purchaseRows = await tx.inventoryPurchase.findMany({
        where: {
          itemId: { in: itemIds },
          date: { ...(since ? { gt: since } : {}), lte: date },
        },
        select: {
          itemId: true,
          date: true,
          quantity: true,
          batch: { select: { canceledAt: true } },
        },
      });
      const purchases = purchaseRows.map((row) => ({
        itemId: row.itemId,
        date: row.date,
        quantity: num(row.quantity),
        canceled: Boolean(row.batch?.canceledAt),
      }));

      const computed = computeCountLines({
        date,
        lines: data.lines,
        previousLines,
        purchases,
        avgUnitCostByItem,
      });

      // 4. Écritures.
      const count = await tx.inventoryCount.create({
        data: {
          date,
          label: data.label ?? null,
          note: data.note ?? null,
          createdById: createdById ?? null,
        },
      });
      await tx.inventoryCountLine.createMany({
        data: computed.map((line) => ({ ...line, countId: count.id })),
      });

      // `currentQuantity` diffère par article : un seul UPDATE joint sur une
      // liste de VALUES, plutôt qu'un aller-retour par ligne.
      await tx.$executeRaw`
        UPDATE "inventory_item" AS i
        SET "currentQuantity" = v.counted, "lastCountedAt" = ${date}::date
        FROM (VALUES ${Prisma.join(
          computed.map(
            (line) =>
              Prisma.sql`(${line.itemId}::text, ${line.countedQuantity}::numeric)`
          )
        )}) AS v(id, counted)
        WHERE i.id = v.id
      `;

      return { countId: count.id, lineCount: computed.length };
    },
    // `maxWait` par défaut (2 s) : un comptage complet part souvent en même
    // temps que la caisse, qui tient des connexions du pool.
    { timeout: 30000, maxWait: 10000 }
  );
}
