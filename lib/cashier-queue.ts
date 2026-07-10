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
import type {
  OrderStatus,
  OrderType,
  PaymentMode,
} from '@/generated/prisma/client';

export type CashierOrder = {
  id: string;
  reference: string;
  dailyNumber: number;
  customerName: string | null;
  customerPhone: string | null;
  pickupTime: Date | null;
  orderType: OrderType;
  items: CartItem[];
  note: string | null;
  total: number;
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

  return orders.map((o) => {
    const items = o.items as CartItem[];

    let stockShortage = false;
    let unavailableItemNames: string[] = [];
    if (!o.isPaid) {
      const availability = computeOrderItemsAvailability(items, stock);
      stockShortage = !availability.fulfillable;
      if (stockShortage) {
        const unavailableCartIds = new Set(
          availability.items.filter((a) => !a.available).map((a) => a.cartId)
        );
        unavailableItemNames = items
          .filter((item) => unavailableCartIds.has(item.cartId))
          .map((item) => item.productName);
      }
    }

    return {
      id: o.id,
      reference: o.reference,
      dailyNumber: o.dailyNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      pickupTime: o.pickupTime,
      orderType: o.orderType,
      items,
      note: o.note,
      total: o.total,
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
    };
  });
}
