// lib/cashier-queue.ts
//
// Snapshot pour l'écran caisse. Filtre :
//   - toute commande du jour PAS encore COMPLETED ni CANCELLED
//   - OU toute commande encore non payée (même si remise — anomalie à régler)
//
// Tri : pickupTime asc avec null en dernier (les commandes online avec créneau
// remontent), puis createdAt asc pour les walk-in et égalités.
//
// Importable par server actions ET route handlers (pas de 'use server').

import { endOfDay, startOfDay } from 'date-fns';
import prisma from '@/lib/prisma';
import type { CartItem } from '@/lib/cart-store';
import {
  fetchStockSnapshot,
  computeOrderItemsAvailability,
} from '@/lib/orders/availability';
import { getLoyaltySettings } from '@/lib/loyalty-settings-db';
import type { LoyaltySettings } from '@/lib/loyalty-settings';
import type {
  OrderStatus,
  OrderType,
  PaymentMode,
} from '@/generated/prisma/client';

export type CashierOrder = {
  id: string;
  reference: string;
  dailyNumber: number;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  pickupTime: Date | null;
  orderType: OrderType;
  items: CartItem[];
  note: string | null;
  total: number;
  /** Montant de la récompense fidélité déjà déduit de `total` (null = aucune). */
  loyaltyDiscount: number | null;
  /** `LoyaltyReward.id` utilisée sur cette commande (null = aucune). */
  loyaltyRewardId: string | null;
  status: OrderStatus;
  isPaid: boolean;
  paymentMode: PaymentMode | null;
  paymentProofUrl: string | null;
  driverRequested: boolean;
  driverName: string | null;
  driverPhone: string | null;
  createdAt: Date;
  // Amorces des minuteurs caisse : entrée en cuisine et passage prête. Null
  // pour les commandes antérieures à l'ajout des colonnes.
  preparingStartedAt: Date | null;
  readyAt: Date | null;
  /** Vrai si au moins un article n'est plus dispo au stock actuel (commande
   * non payée uniquement — toujours faux pour une commande déjà payée, son
   * stock étant déjà réservé). Signal caisse (flag rouge + garde bouton payer). */
  stockShortage: boolean;
  /** Noms des articles en cause quand `stockShortage`, pour l'affichage. */
  unavailableItemNames: string[];
  /** Réglages fidélité (mêmes pour toute la file — dupliqué par commande pour
   * éviter le prop-drilling à travers la chaîne caisse-view → …→ actions). */
  loyaltySettings: LoyaltySettings;
  /** Compteur de tampons du client lié (fidélité), pour le message incitatif
   * du récap. `null` = commande anonyme (`customerId` absent). */
  loyaltyStampCount: number | null;
  /** Cette commande a-t-elle crédité un tampon (et était-ce le tout premier
   * du client) — calculé UNIQUEMENT pour les commandes `READY` (seul statut
   * où le bouton "c'est prêt" s'affiche) ; `null` sinon ou commande anonyme. */
  loyaltyPickupOutcome: {
    stampEarned: boolean;
    isFirstStampEver: boolean;
  } | null;
};

export async function fetchCashierQueue(): Promise<CashierOrder[]> {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const orders = await prisma.order.findMany({
    where: {
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
        // Du jour (walk-in) OU programmée pour aujourd'hui/à venir : on inclut ainsi
        // une commande passée la veille pour un retrait aujourd'hui ou demain.
        {
          OR: [
            { createdAt: { gte: dayStart, lte: dayEnd } },
            { pickupTime: { gte: dayStart } },
          ],
        },
      ],
    },
    // FIFO strict : la commande la plus ancienne en haut.
    orderBy: { createdAt: 'asc' },
  });

  // Disponibilité : un seul instantané de stock, batché sur TOUTES les
  // commandes non payées de la file (pas de N+1 par commande). Une commande
  // déjà payée a réservé son stock au paiement : jamais de calcul pour elle.
  const unpaidItemsList = orders
    .filter((o) => !o.isPaid)
    .map((o) => o.items as CartItem[]);
  const stock = await fetchStockSnapshot(unpaidItemsList);

  // Fidélité : réglages une seule fois pour toute la file, compteur de
  // tampons batché pour tous les clients liés (récap), et issue précise
  // (tampon crédité / premier jamais gagné) batchée UNIQUEMENT pour les
  // commandes READY (seul contexte où le bouton "c'est prêt" en a besoin).
  const customerIds = [
    ...new Set(
      orders.map((o) => o.customerId).filter((id): id is string => id !== null)
    ),
  ];
  const readyOrderIds = orders
    .filter((o) => o.status === 'READY' && o.customerId !== null)
    .map((o) => o.id);

  const [loyaltySettings, customers, stampLedgerForReadyOrders] =
    await Promise.all([
      getLoyaltySettings(),
      customerIds.length > 0
        ? prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, stampCount: true },
          })
        : Promise.resolve([]),
      readyOrderIds.length > 0
        ? prisma.loyaltyLedger.findMany({
            where: { type: 'STAMP_EARNED', orderId: { in: readyOrderIds } },
            select: { orderId: true, customerId: true },
          })
        : Promise.resolve([]),
    ]);

  const stampCountByCustomerId = new Map(
    customers.map((c) => [c.id, c.stampCount])
  );
  const stampEarnedOrderIds = new Set(
    stampLedgerForReadyOrders.map((l) => l.orderId)
  );
  // "Premier tampon jamais gagné" : le client dont CETTE commande a crédité
  // le tampon n'a qu'UNE seule entrée STAMP_EARNED au ledger, tous temps
  // confondus. Un seul groupBy batché pour tous les clients concernés.
  const readyCustomerIds = [
    ...new Set(stampLedgerForReadyOrders.map((l) => l.customerId)),
  ];
  const stampCountsByCustomer =
    readyCustomerIds.length > 0
      ? await prisma.loyaltyLedger.groupBy({
          by: ['customerId'],
          where: { type: 'STAMP_EARNED', customerId: { in: readyCustomerIds } },
          _count: { _all: true },
        })
      : [];
  const totalStampEntriesByCustomerId = new Map(
    stampCountsByCustomer.map((g) => [g.customerId, g._count._all])
  );

  return orders.map((o) => {
    const items = o.items as CartItem[];

    let stockShortage = false;
    let unavailableItemNames: string[] = [];
    if (!o.isPaid) {
      const availability = computeOrderItemsAvailability(items, stock);
      stockShortage = !availability.fulfillable;
      if (stockShortage) {
        const detailByCartId = new Map(
          availability.items
            .filter((a) => !a.available)
            .map((a) => [a.cartId, a])
        );
        // Précise le(s) goût(s) en cause quand c'est une option (et non le
        // produit lui-même) qui manque — ex. « Sponge cake (Vanille) » plutôt
        // que seulement « Sponge cake », qui ne dit pas LEQUEL des goûts
        // commandés est épuisé.
        unavailableItemNames = items
          .filter((item) => detailByCartId.has(item.cartId))
          .map((item) => {
            const detail = detailByCartId.get(item.cartId);
            if (!detail?.missingProduct && detail?.missingOptionNames.length) {
              return `${item.productName} (${detail.missingOptionNames.join(', ')})`;
            }
            return item.productName;
          });
      }
    }

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
      loyaltyDiscount: o.loyaltyDiscount,
      loyaltyRewardId: o.loyaltyRewardId,
      status: o.status,
      isPaid: o.isPaid,
      paymentMode: o.paymentMode,
      paymentProofUrl: o.paymentProofUrl,
      driverRequested: o.driverRequested,
      driverName: o.driverName,
      driverPhone: o.driverPhone,
      createdAt: o.createdAt,
      preparingStartedAt: o.preparingStartedAt,
      readyAt: o.readyAt,
      stockShortage,
      unavailableItemNames,
      loyaltySettings,
      loyaltyStampCount,
      loyaltyPickupOutcome,
    };
  });
}
