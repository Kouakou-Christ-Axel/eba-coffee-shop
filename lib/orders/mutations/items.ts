// Mutations de commandes — items.

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { computeItemsTotal, getMaxItemDiscount } from '@/lib/orders/totals';
import type { CartItem } from '@/lib/cart-store';
import { OrderMutationError } from './errors';
import { resyncStockForItemChange } from './stock-resync';

/** Remplace les articles d'une commande et recalcule son total (net après remises). */
export async function updateOrderItems(
  id: string,
  items: CartItem[],
  opts?: { restoreRemovedStock?: boolean; coverShortage?: boolean }
): Promise<{ total: number }> {
  if (items.length === 0) {
    throw new OrderMutationError(
      'La commande doit avoir au moins un article',
      400
    );
  }

  // Plafond de remise par ligne (sécurité serveur, en plus de la validation UI).
  for (const item of items) {
    if ((item.discount ?? 0) > getMaxItemDiscount(item)) {
      throw new OrderMutationError(
        `Remise trop élevée sur « ${item.productName} »`,
        400
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      select: {
        status: true,
        loyaltyDiscount: true,
        items: true,
        stockReservedAt: true,
      },
    });
    if (!order) {
      throw new OrderMutationError('Commande introuvable', 404);
    }
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new OrderMutationError(
        'Impossible de modifier une commande terminée ou annulée',
        409
      );
    }

    if (order.stockReservedAt !== null) {
      await resyncStockForItemChange(
        tx,
        order.items as unknown as CartItem[],
        items,
        opts?.restoreRemovedStock ?? true,
        opts?.coverShortage ?? false
      );
    }

    const total = Math.max(
      0,
      computeItemsTotal(items) - (order.loyaltyDiscount ?? 0)
    );

    await tx.order.update({
      where: { id },
      data: { items: items as unknown as Prisma.InputJsonValue, total },
    });

    return { total };
  });
}
