// lib/jeko/settle-alerts.ts
//
// Alertes staff et cas « déjà payée » partagés par `settle.ts` (règlement normal)
// et `settle-late.ts` (paiement après expiration).

import { ROLE_GROUPS } from '@/lib/auth-helpers';
import { sendPushToRoles } from '@/lib/push-notify';
import type { SettleOutcome } from './settle';
import type { JekoTransaction } from './webhook-payload';

export function alertStaff(
  orderId: string,
  dailyNumber: number,
  message: string
) {
  sendPushToRoles(ROLE_GROUPS.CASHIER_PLUS, {
    title: `Paiement Jèko — commande #${dailyNumber}`,
    body: message,
    url: `/dashboard/commandes/${orderId}`,
    tag: `jeko-${orderId}`,
  }).catch((err) => {
    console.error('[jeko] alerte staff échouée :', err);
  });
}

/**
 * La commande est déjà payée. Même transaction : livraison rejouée. Sinon
 * (`paymentTransactionId` nul = encaissée en caisse ou par le MCP, ou autre
 * transaction = relance payée deux fois), l'argent est parti deux fois : le staff
 * rembourse depuis le Dashboard Jèko.
 */
export function settledElsewhere(
  order: {
    id: string;
    dailyNumber: number;
    paymentTransactionId: string | null;
  },
  tx: JekoTransaction
): SettleOutcome {
  if (order.paymentTransactionId === tx.transactionId) return 'already_paid';
  alertStaff(
    order.id,
    order.dailyNumber,
    order.paymentTransactionId === null
      ? `Commande déjà encaissée, mais le client a aussi payé en ligne (${tx.amountFcfa} F) : rembourser depuis le Dashboard Jèko.`
      : `Double paiement en ligne (${tx.amountFcfa} F de plus) : rembourser le client depuis le Dashboard Jèko.`
  );
  return 'duplicate_payment';
}
