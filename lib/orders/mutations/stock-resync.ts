// Mutations de commandes — stock-resync.

import { Prisma } from '@/generated/prisma/client';
import type { CartItem } from '@/lib/cart-store';
import { StockShortageError } from './errors';
import { aggregateStockNeeds } from './stock-needs';

export async function resyncStockForItemChange(
  tx: Prisma.TransactionClient,
  previousItems: CartItem[],
  nextItems: CartItem[],
  restoreRemoved: boolean,
  coverShortage = false
): Promise<void> {
  const before = await aggregateStockNeeds(tx, previousItems);
  const after = await aggregateStockNeeds(tx, nextItems);

  for (const id of new Set([
    ...before.products.keys(),
    ...after.products.keys(),
  ])) {
    const delta =
      (after.products.get(id)?.needed ?? 0) -
      (before.products.get(id)?.needed ?? 0);
    if (delta === 0) continue;
    const name =
      after.products.get(id)?.name ?? before.products.get(id)?.name ?? id;
    if (delta > 0) {
      if (coverShortage) {
        const row = await tx.product.findUnique({
          where: { id },
          select: { stockQuantity: true },
        });
        if (row && row.stockQuantity !== null && row.stockQuantity < delta) {
          await tx.product.update({
            where: { id },
            data: { stockQuantity: { increment: delta - row.stockQuantity } },
          });
        }
      }
      const res = await tx.product.updateMany({
        where: {
          id,
          OR: [{ stockQuantity: null }, { stockQuantity: { gte: delta } }],
        },
        data: { stockQuantity: { decrement: delta } },
      });
      if (res.count !== 1) {
        throw new StockShortageError(`Stock insuffisant pour « ${name} »`);
      }
    } else if (restoreRemoved) {
      // `NULL + n = NULL` : une cible à stock illimité reste illimitée.
      await tx.product.update({
        where: { id },
        data: { stockQuantity: { increment: -delta } },
      });
    }
  }

  for (const id of new Set([
    ...before.options.keys(),
    ...after.options.keys(),
  ])) {
    const delta =
      (after.options.get(id)?.needed ?? 0) -
      (before.options.get(id)?.needed ?? 0);
    if (delta === 0) continue;
    const need = after.options.get(id) ?? before.options.get(id);
    if (delta > 0) {
      if (coverShortage) {
        const row = await tx.supplementOption.findUnique({
          where: { id },
          select: { stockQuantity: true },
        });
        if (row && row.stockQuantity !== null && row.stockQuantity < delta) {
          await tx.supplementOption.update({
            where: { id },
            data: { stockQuantity: { increment: delta - row.stockQuantity } },
          });
        }
      }
      const res = await tx.supplementOption.updateMany({
        where: {
          id,
          OR: [{ stockQuantity: null }, { stockQuantity: { gte: delta } }],
        },
        data: { stockQuantity: { decrement: delta } },
      });
      if (res.count !== 1) {
        throw new StockShortageError(
          `Stock insuffisant pour « ${need?.productName} — ${need?.optionName} »`
        );
      }
    } else if (restoreRemoved) {
      await tx.supplementOption.update({
        where: { id },
        data: { stockQuantity: { increment: -delta } },
      });
    }
  }

  for (const key of new Set([
    ...before.unresolved.keys(),
    ...after.unresolved.keys(),
  ])) {
    const need = after.unresolved.get(key);
    const delta =
      (need?.needed ?? 0) - (before.unresolved.get(key)?.needed ?? 0);
    if (delta > 0 && need) {
      throw new StockShortageError(
        `Option indisponible pour « ${need.productName} — ${need.optionName} »`
      );
    }
  }
}
