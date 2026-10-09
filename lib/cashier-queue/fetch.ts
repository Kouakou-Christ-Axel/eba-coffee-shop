import prisma from '@/lib/prisma';
import { withStaffVisible } from '@/lib/orders/visibility';
import type { CartItem } from '@/lib/cart-store';
import { fetchStockSnapshot } from '@/lib/orders/availability';
import { endOfLocalDay, startOfLocalDay } from '@/lib/timezone';
import { coalesceAsyncByKey } from '@/lib/async-coalesce';
import { getOrdersGeneration } from '@/lib/postgres-notify';
import { describeShortage, needsAvailability } from './availability';
import { loadQueueLoyalty } from './loyalty';
import type { CashierOrder } from './types';

async function findQueueOrders(now: Date) {
  // Bornes ancrées sur Abidjan, PAS sur le fuseau du runtime (cf. `lib/preparation-queue.ts`).
  const dayStart = startOfLocalDay(now);
  const dayEnd = endOfLocalDay(now);

  return prisma.order.findMany({
    where: withStaffVisible({
      // Une commande annulée (ou remboursée) quitte la file caisse.
      status: { not: 'CANCELLED' },
      AND: [
        // Toujours active (en cuisine/prête) OU encore impayée.
        {
          OR: [
            { status: { in: ['NEW', 'PREPARING', 'READY'] } },
            { isPaid: false },
          ],
        },
        // Du jour (walk-in) OU programmée pour aujourd'hui/à venir.
        {
          OR: [
            { createdAt: { gte: dayStart, lte: dayEnd } },
            { pickupTime: { gte: dayStart } },
          ],
        },
      ],
    }),
    include: { customer: { select: { isTrusted: true } } },
    // FIFO strict : la commande la plus ancienne en haut.
    orderBy: { createdAt: 'asc' },
  });
}

export async function fetchCashierQueue(): Promise<CashierOrder[]> {
  const now = new Date();
  const orders = await findQueueOrders(now);

  // Un seul instantané de stock pour toutes les commandes concernées (pas de N+1).
  const stock = await fetchStockSnapshot(
    orders
      .filter((o) => needsAvailability(o, now))
      .map((o) => o.items as CartItem[])
  );
  const {
    loyaltySettings,
    stampCountByCustomerId,
    stampEarnedOrderIds,
    totalStampEntriesByCustomerId,
  } = await loadQueueLoyalty(orders);

  return orders.map((o) => {
    const items = o.items as CartItem[];

    const { stockShortage, unavailableItemNames } = needsAvailability(o, now)
      ? describeShortage(items, stock)
      : { stockShortage: false, unavailableItemNames: [] };

    const loyaltyStampCount = o.customerId
      ? (stampCountByCustomerId.get(o.customerId) ?? null)
      : null;
    const loyaltyPickupOutcome =
      o.status === 'READY' && o.customerId
        ? {
            stampEarned: stampEarnedOrderIds.has(o.id),
            isFirstStampEver:
              stampEarnedOrderIds.has(o.id) &&
              totalStampEntriesByCustomerId.get(o.customerId) === 1,
          }
        : null;

    return {
      id: o.id,
      reference: o.reference,
      dailyNumber: o.dailyNumber,
      customerId: o.customerId,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      pickupTime: o.pickupTime,
      orderType: o.orderType,
      items,
      note: o.note,
      total: o.total,
      depositRequired: o.depositRequired,
      depositPaid: o.depositPaid,
      loyaltyDiscount: o.loyaltyDiscount,
      loyaltyRewardId: o.loyaltyRewardId,
      status: o.status,
      isPaid: o.isPaid,
      isOnAccount: o.isOnAccount,
      customerTrusted: o.customer?.isTrusted ?? false,
      paymentMode: o.paymentMode,
      paymentAutoValidatedByAi: o.paymentAutoValidatedByAi,
      paymentProofUrl: o.paymentProofUrl,
      paymentProofVerdict: o.paymentProofVerdict,
      paymentProofAnalysis: o.paymentProofAnalysis,
      source: o.source,
      driverRequested: o.driverRequested,
      driverName: o.driverName,
      driverPhone: o.driverPhone,
      createdAt: o.createdAt,
      preparingStartedAt: o.preparingStartedAt,
      readyAt: o.readyAt,
      stockReservedAt: o.stockReservedAt,
      stockShortage,
      unavailableItemNames,
      loyaltySettings,
      loyaltyStampCount,
      loyaltyPickupOutcome,
    };
  });
}

/**
 * Variante mutualisée pour le flux SSE : les appels déclenchés par le MÊME
 * NOTIFY Postgres partagent une exécution, mais un client réagissant à une
 * notification plus récente obtient un calcul frais (cf. `lib/async-coalesce.ts`).
 */
export const fetchCashierQueueShared = coalesceAsyncByKey(
  fetchCashierQueue,
  getOrdersGeneration
);
