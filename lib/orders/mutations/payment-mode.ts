// lib/orders/mutations/payment-mode.ts
//
// Mutations de commandes — payment-mode (extrait de lib/order-mutations.ts, sans changement de comportement).

import type { PaymentMode } from '@/generated/prisma/client';
import type { OrderPaymentLineInput } from '@/lib/schemas/order';

// ─── Encaissement / paiement ──────────────────────────────────────────────────

/**
 * Résout le `paymentMode` « résumé » d'un ensemble de lignes de paiement :
 * le mode lui-même si les lignes partagent toutes le même mode (cas courant,
 * 1 seule ligne ou plusieurs lignes du même mode), `null` sinon (paiement
 * fractionné sur 2+ modes distincts — le détail vit dans `OrderPayment`).
 */
export function resolvePaymentMode(
  payments: OrderPaymentLineInput[]
): PaymentMode | null {
  const distinctModes = new Set(payments.map((p) => p.mode));
  return distinctModes.size === 1 ? payments[0].mode : null;
}
