import { type CashierOrder } from '@/lib/cashier-queue';

export type PaymentBadge =
  | { kind: 'paid'; split: boolean; autoValidatedByAi: boolean }
  | { kind: 'unpaid' }
  | { kind: 'on-account' }
  | { kind: 'pay-after' }
  | { kind: 'pickup-unpaid' };

export function getPaymentBadge(order: CashierOrder): PaymentBadge {
  // Payée sans mode unique résolu = paiement fractionné (détail dans `OrderPayment`, non exposé sur `CashierOrder`).
  if (order.isPaid) {
    return {
      kind: 'paid',
      split: order.paymentMode === null,
      autoValidatedByAi: order.paymentAutoValidatedByAi,
    };
  }
  // Ardoise : choix délibéré, prioritaire sur les badges d'alerte ; la dette est suivie dans /dashboard/ardoise.
  if (order.isOnAccount) return { kind: 'on-account' };
  // Récupérée mais toujours pas encaissée : à signaler clairement.
  if (order.status === 'COMPLETED') return { kind: 'pickup-unpaid' };
  if (order.status === 'PREPARING' || order.status === 'READY') {
    return { kind: 'pay-after' };
  }
  return { kind: 'unpaid' };
}
