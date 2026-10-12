// lib/orders/reopen.ts
//
// « Remettre dans le process » : rattraper après coup une commande récupérée,
// annulée, remboursée ou expirée par erreur. Pur, serveur et client.

import type { OrderStatus } from '@/generated/prisma/client';

export type ReopenKind = 'completed' | 'cancelled' | 'refunded' | 'expired';

export type ReopenPlan = {
  kind: ReopenKind;
  /** Statut cible, envoyé à `PATCH /api/caisse/orders/:id/status`. */
  target: OrderStatus;
  label: string;
  hint: string;
};

export function getReopenPlan(order: {
  status: OrderStatus;
  isPaid: boolean;
  paymentExpiresAt: Date | string | null;
}): ReopenPlan | null {
  if (order.status === 'COMPLETED') {
    return {
      kind: 'completed',
      target: 'READY',
      label: 'Remettre en prête',
      hint: 'La commande repart dans « Prêtes ».',
    };
  }
  if (order.status !== 'CANCELLED') return null;
  if (order.isPaid) {
    return {
      kind: 'refunded',
      target: 'PREPARING',
      label: 'Annuler le remboursement',
      hint: 'Le paiement d’origine est conservé ; la commande repart en cuisine.',
    };
  }
  if (order.paymentExpiresAt) {
    return {
      kind: 'expired',
      target: 'NEW',
      label: 'Reprendre en caisse',
      hint: 'Paiement en ligne expiré : la commande devient une commande caisse.',
    };
  }
  return {
    kind: 'cancelled',
    target: 'NEW',
    label: 'Remettre à encaisser',
    hint: 'La commande revient dans « À encaisser ».',
  };
}
