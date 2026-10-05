// lib/orders/pending-payment.ts
//
// Commandes en ligne EN ATTENTE de paiement : invisibles de la file caisse tant
// qu'elles ne sont pas payées (cf. STAFF_VISIBLE, lib/orders/visibility.ts), mais
// le caissier doit pouvoir les voir pour relancer le client, les annuler ou les
// prendre en caisse (encaissement par les moyens habituels, sans Jèko).
//
// Lecture à la demande, HORS de `fetchCashierQueue` : même raison que pour les
// annulées (compteurs, stock et fidélité de la file SSE).

import prisma from '@/lib/prisma';
import { OrderMutationError } from '@/lib/order-mutations';

export type PendingPaymentOrder = {
  id: string;
  dailyNumber: number;
  reference: string;
  customerName: string | null;
  customerPhone: string | null;
  total: number;
  paymentAttempts: number;
  /** Échéance du paiement en cours (15 min après la dernière tentative). */
  paymentExpiresAt: Date;
  createdAt: Date;
};

export async function listPendingPaymentOrders(): Promise<
  PendingPaymentOrder[]
> {
  // staff-visibility: exempt — c'est précisément l'écran des commandes masquées en attente de paiement
  const orders = await prisma.order.findMany({
    where: {
      isPaid: false,
      status: 'NEW',
      paymentExpiresAt: { not: null },
    },
    // La plus proche de l'expiration d'abord : c'est elle qu'il faut relancer.
    orderBy: { paymentExpiresAt: 'asc' },
    select: {
      id: true,
      dailyNumber: true,
      reference: true,
      customerName: true,
      customerPhone: true,
      total: true,
      paymentAttempts: true,
      paymentExpiresAt: true,
      createdAt: true,
    },
  });
  return orders.map((o) => ({
    ...o,
    // Le filtre garantit la présence de l'échéance.
    paymentExpiresAt: o.paymentExpiresAt as Date,
  }));
}

/**
 * « Prendre en caisse » : la commande sort de l'attente de paiement en ligne et
 * devient une commande caisse ordinaire (visible, encaissable en espèces, Wave…).
 * Le client ne peut plus relancer un paiement Jèko (`startJekoPayment` refuse :
 * plus d'échéance) ; un paiement Jèko déjà en route, lui, serait signalé au staff
 * comme double paiement (cf. lib/jeko/settle.ts).
 *
 * Aucun stock n'est touché : il suit l'entrée en cuisine, comme pour toute commande.
 */
export async function releasePendingOrder(id: string): Promise<void> {
  const { count } = await prisma.order.updateMany({
    where: {
      id,
      isPaid: false,
      status: 'NEW',
      paymentExpiresAt: { not: null },
    },
    data: { paymentExpiresAt: null },
  });
  if (count === 0) {
    throw new OrderMutationError(
      "Cette commande n'attend plus de paiement en ligne",
      409
    );
  }
}
