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
  /**
   * Seulement sur une commande expirée que le client a payée quand même (cf.
   * lib/jeko/settle-late.ts) : `done` = remboursé de `amount` F, `pending` = pas
   * encore, le staff s'en charge. Absent = rien n'a été débité.
   */
  refund?: { status: 'done' | 'pending'; amount: number | null };
};

export function getPaymentView(
  order: {
    isPaid: boolean;
    status: OrderStatus;
    total: number;
    onlineFee: number | null;
    paymentExpiresAt: Date | null;
    paymentTransactionId?: string | null;
    refundedAt?: Date | null;
    refundAmount?: number | null;
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
    ...(expired && order.paymentTransactionId
      ? {
          refund: order.refundedAt
            ? { status: 'done' as const, amount: order.refundAmount ?? null }
            : { status: 'pending' as const, amount: null },
        }
      : {}),
  };
}
