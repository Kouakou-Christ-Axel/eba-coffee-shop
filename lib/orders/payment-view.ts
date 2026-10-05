// lib/orders/payment-view.ts
//
// Ce que la page de suivi sait du paiement d'une commande. Une seule fonction
// pure décide : en attente (compte à rebours, payer / réessayer), expirée, payée,
// ou sans paiement en ligne (caisse, ou commande redevenue normale après une
// rupture de stock survenue après paiement — cf. lib/jeko/settle.ts, qui retire
// alors l'échéance).

import type { OrderStatus } from '@/generated/prisma/client';

export type PaymentView = {
  state: 'none' | 'pending' | 'expired' | 'paid';
  /** Frais de paiement en ligne facturés en plus du total, null si aucun. */
  onlineFee: number | null;
  /** Ce que le client doit encore régler en ligne (total + frais), 0 si payée. */
  amountDue: number;
  /** Échéance du paiement (ISO) tant qu'il est attendu ou vient d'expirer. */
  expiresAt: string | null;
};

export function getPaymentView(
  order: {
    isPaid: boolean;
    status: OrderStatus;
    total: number;
    onlineFee: number | null;
    paymentExpiresAt: Date | null;
  },
  now: Date = new Date()
): PaymentView {
  const { onlineFee } = order;

  if (order.isPaid) {
    return { state: 'paid', onlineFee, amountDue: 0, expiresAt: null };
  }
  if (order.paymentExpiresAt === null) {
    return {
      state: 'none',
      onlineFee,
      amountDue: order.total,
      expiresAt: null,
    };
  }

  const expired = order.status === 'CANCELLED' || order.paymentExpiresAt <= now;
  return {
    state: expired ? 'expired' : 'pending',
    onlineFee,
    amountDue: order.total + (onlineFee ?? 0),
    expiresAt: order.paymentExpiresAt.toISOString(),
  };
}
