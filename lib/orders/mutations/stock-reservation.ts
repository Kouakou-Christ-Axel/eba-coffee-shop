// Mutations de commandes — stock-reservation.

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { fetchStockSnapshot, optionKey } from '@/lib/orders/availability';
import { isDeferredPickup } from '@/lib/orders/scheduling';
import type { CartItem } from '@/lib/cart-store';
import { notifyOrderCustomer } from '@/lib/push-notify';
import { decrementStockForOrderItems } from './stock-needs';
import { resyncStockForItemChange } from './stock-resync';
import { coverShortageForOrderItems } from './shortage';

// Seul chemin autorisé à remettre `stockReservedAt` à null (commande jamais payée).
export function releaseUnpaidStockHold(
  tx: Prisma.TransactionClient,
  items: CartItem[]
): Promise<void> {
  return resyncStockForItemChange(tx, items, [], true);
}

// Verrou `Order.stockReservedAt` : décrément au plus une fois par commande.
export async function reserveStockOnce(
  tx: Prisma.TransactionClient,
  orderId: string,
  items: CartItem[],
  opts?: { coverShortage?: boolean }
): Promise<boolean> {
  const claim = await tx.order.updateMany({
    where: { id: orderId, stockReservedAt: null },
    data: { stockReservedAt: new Date() },
  });
  if (claim.count === 0) return false;

  // AVANT le décrément, et seulement sur demande explicite : le staff a
  // confirmé avoir produit la quantité manquante.
  if (opts?.coverShortage) {
    await coverShortageForOrderItems(tx, items);
  }

  await decrementStockForOrderItems(tx, items);
  return true;
}

export async function notifyPendingOrdersOfShortage(
  reservedOrderId: string,
  reservedItems: CartItem[]
): Promise<void> {
  const now = new Date();
  const snapshot = await fetchStockSnapshot([reservedItems]);

  const zeroedProductIds = new Set(
    [...snapshot.products.entries()]
      .filter(([, qty]) => qty === 0)
      .map(([id]) => id)
  );
  const zeroedOptionKeys = new Set(
    [...snapshot.options.entries()]
      .filter(([, qty]) => qty === 0)
      .map(([key]) => key)
  );
  if (zeroedProductIds.size === 0 && zeroedOptionKeys.size === 0) return;

  // staff-visibility: exempt — prévient aussi les clients en cours de paiement qu'un produit de leur commande vient de s'épuiser
  const candidates = await prisma.order.findMany({
    where: {
      id: { not: reservedOrderId },
      stockReservedAt: null,
      status: { notIn: ['CANCELLED', 'COMPLETED'] },
    },
    select: { id: true, items: true, pickupTime: true },
    take: 200,
  });

  for (const candidate of candidates) {
    if (isDeferredPickup(candidate.pickupTime, now)) continue;
    const items = candidate.items as unknown as CartItem[];
    const affected = items.some((item) => {
      if (zeroedProductIds.has(item.productId)) return true;
      return item.supplements.some((s) =>
        zeroedOptionKeys.has(
          optionKey(item.productId, s.groupName, s.optionName)
        )
      );
    });
    if (affected) {
      notifyOrderCustomer(candidate.id, 'ITEM_UNAVAILABLE');
    }
  }
}
