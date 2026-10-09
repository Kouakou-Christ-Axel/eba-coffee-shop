import type { CartItem } from '@/lib/cart-store';
import {
  computeOrderItemsAvailability,
  type fetchStockSnapshot,
} from '@/lib/orders/availability';
import { isDeferredPickup } from '@/lib/orders/scheduling';

type StockSnapshot = Awaited<ReturnType<typeof fetchStockSnapshot>>;

/**
 * Seules les commandes dont le stock n'est pas réservé comptent (critère
 * `stockReservedAt`, pas `isPaid`), et pas les différées (stock du jour de retrait).
 */
export function needsAvailability(
  o: { stockReservedAt: Date | null; pickupTime: Date | null },
  now: Date
): boolean {
  return o.stockReservedAt === null && !isDeferredPickup(o.pickupTime, now);
}

/** Pénurie d'une commande, avec le(s) goût(s) en cause quand c'est une option qui manque. */
export function describeShortage(
  items: CartItem[],
  stock: StockSnapshot
): { stockShortage: boolean; unavailableItemNames: string[] } {
  const availability = computeOrderItemsAvailability(items, stock);
  if (availability.fulfillable) {
    return { stockShortage: false, unavailableItemNames: [] };
  }
  const detailByCartId = new Map(
    availability.items.filter((a) => !a.available).map((a) => [a.cartId, a])
  );
  const unavailableItemNames = items
    .filter((item) => detailByCartId.has(item.cartId))
    .map((item) => {
      const detail = detailByCartId.get(item.cartId);
      if (!detail?.missingProduct && detail?.missingOptionNames.length) {
        return `${item.productName} (${detail.missingOptionNames.join(', ')})`;
      }
      return item.productName;
    });
  return { stockShortage: true, unavailableItemNames };
}
