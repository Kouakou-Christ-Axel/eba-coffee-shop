// Mutations de commandes — stock-needs.

import { Prisma } from '@/generated/prisma/client';
import { optionKey } from '@/lib/orders/availability';
import type { ShortageLine } from '@/lib/orders/shortage';
import type { CartItem } from '@/lib/cart-store';
import { StockShortageError } from './errors';

export async function resolveOptionId(
  tx: Prisma.TransactionClient,
  productId: string,
  groupName: string,
  optionName: string
): Promise<string | null> {
  const option = await tx.supplementOption.findFirst({
    where: {
      name: optionName,
      available: true,
      // Le groupe peut être propre au produit OU global (« Extras »,
      // `isGlobal: true`, sans `productId`) — voir prisma/schema.prisma.
      group: {
        name: groupName,
        OR: [{ productId }, { isGlobal: true }],
      },
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  return option?.id ?? null;
}

// Appelé uniquement par `reserveStockOnce` : jamais en direct (double décrément).
export async function decrementStockForOrderItems(
  tx: Prisma.TransactionClient,
  items: CartItem[]
): Promise<void> {
  for (const item of items) {
    const productResult = await tx.product.updateMany({
      where: {
        id: item.productId,
        OR: [
          { stockQuantity: null },
          { stockQuantity: { gte: item.quantity } },
        ],
      },
      data: { stockQuantity: { decrement: item.quantity } },
    });
    if (productResult.count !== 1) {
      throw new StockShortageError(
        `Stock insuffisant pour « ${item.productName} »`
      );
    }

    for (const supplement of item.supplements) {
      const needed = (supplement.quantity ?? 1) * item.quantity;
      const optionId = await resolveOptionId(
        tx,
        item.productId,
        supplement.groupName,
        supplement.optionName
      );
      if (!optionId) {
        throw new StockShortageError(
          `Option indisponible pour « ${item.productName} — ${supplement.optionName} »`
        );
      }
      const optionResult = await tx.supplementOption.updateMany({
        where: {
          id: optionId,
          OR: [{ stockQuantity: null }, { stockQuantity: { gte: needed } }],
        },
        data: { stockQuantity: { decrement: needed } },
      });
      if (optionResult.count !== 1) {
        throw new StockShortageError(
          `Stock insuffisant pour « ${item.productName} — ${supplement.optionName} »`
        );
      }
    }
  }
}

/** Besoin TOTAL de la commande par cible de stock. */
export async function aggregateStockNeeds(
  tx: Prisma.TransactionClient,
  items: CartItem[]
): Promise<{
  products: Map<string, { name: string; needed: number }>;
  options: Map<
    string,
    {
      productName: string;
      groupName: string;
      optionName: string;
      needed: number;
    }
  >;
  unresolved: Map<
    string,
    {
      productName: string;
      groupName: string;
      optionName: string;
      needed: number;
    }
  >;
}> {
  const products = new Map<string, { name: string; needed: number }>();
  const options = new Map<
    string,
    {
      productName: string;
      groupName: string;
      optionName: string;
      needed: number;
    }
  >();
  const unresolved = new Map<
    string,
    {
      productName: string;
      groupName: string;
      optionName: string;
      needed: number;
    }
  >();

  for (const item of items) {
    const current = products.get(item.productId);
    products.set(item.productId, {
      name: item.productName,
      needed: (current?.needed ?? 0) + item.quantity,
    });

    for (const supplement of item.supplements) {
      const optionId = await resolveOptionId(
        tx,
        item.productId,
        supplement.groupName,
        supplement.optionName
      );
      const needed = (supplement.quantity ?? 1) * item.quantity;
      if (!optionId) {
        const key = optionKey(
          item.productId,
          supplement.groupName,
          supplement.optionName
        );
        const existing = unresolved.get(key);
        unresolved.set(key, {
          productName: item.productName,
          groupName: supplement.groupName,
          optionName: supplement.optionName,
          needed: (existing?.needed ?? 0) + needed,
        });
        continue;
      }
      const existing = options.get(optionId);
      options.set(optionId, {
        productName: item.productName,
        groupName: supplement.groupName,
        optionName: supplement.optionName,
        needed: (existing?.needed ?? 0) + needed,
      });
    }
  }

  return { products, options, unresolved };
}

/** Ce qui manque pour honorer `items` face au stock COURANT. */
export async function computeShortage(
  tx: Prisma.TransactionClient,
  items: CartItem[]
): Promise<ShortageLine[]> {
  const { products, options } = await aggregateStockNeeds(tx, items);
  const lines: ShortageLine[] = [];

  if (products.size > 0) {
    const rows = await tx.product.findMany({
      where: { id: { in: [...products.keys()] } },
      select: { id: true, stockQuantity: true },
    });
    for (const row of rows) {
      const need = products.get(row.id);
      if (!need || row.stockQuantity === null) continue;
      const missing = need.needed - row.stockQuantity;
      if (missing > 0) {
        lines.push({
          target: 'product',
          targetId: row.id,
          productName: need.name,
          missing,
        });
      }
    }
  }

  if (options.size > 0) {
    const rows = await tx.supplementOption.findMany({
      where: { id: { in: [...options.keys()] } },
      select: { id: true, stockQuantity: true },
    });
    for (const row of rows) {
      const need = options.get(row.id);
      if (!need || row.stockQuantity === null) continue;
      const missing = need.needed - row.stockQuantity;
      if (missing > 0) {
        lines.push({
          target: 'option',
          targetId: row.id,
          productName: need.productName,
          groupName: need.groupName,
          optionName: need.optionName,
          missing,
        });
      }
    }
  }

  return lines;
}
