// lib/jeko/refund.ts
//
// Remboursement immédiat d'un paiement Jèko arrivé APRÈS l'expiration de la
// commande, quand on ne peut pas la servir (stock insuffisant, récompense
// fidélité déjà restituée). Jèko n'a pas d'API de remboursement : transfert vers
// le numéro de la commande, avec le moyen utilisé pour payer.
//
// On rend les PRODUITS seulement : les frais en ligne (`onlineFee`) restent acquis.
// Jamais de perte silencieuse : tout ce qui empêche l'envoi (numéro invalide,
// solde Jèko insuffisant, panne) aboutit à une alerte staff qui dit quoi faire.

import prisma from '@/lib/prisma';
import { normalizeIvorianPhone } from '@/lib/phone';
import { notifyOrderCustomer } from '@/lib/push-notify';
import { JekoApiError } from './client';
import { jekoConfig } from './config';
import { jekoMethodToPaymentMode } from './payment-mode';
import { recordAutoLateRefund } from '@/lib/refunds/record-auto';
import { alertStaff } from './settle-alerts';
import {
  createJekoContact,
  createJekoTransfer,
  minTransferFcfa,
  toTransferMethod,
} from './transfers';
import type { JekoTransaction } from './webhook-payload';

export type RefundableOrder = {
  id: string;
  reference: string;
  dailyNumber: number;
  customerName: string | null;
  customerPhone: string | null;
  onlineFee: number | null;
};

export type RefundOutcome = 'refunded' | 'manual';

/** Référence déterministe : un rejeu retombe sur le même transfert (409 chez Jèko). */
export function buildRefundReference(
  orderReference: string,
  transactionId: string
): string {
  return `REMB-${orderReference}-${transactionId.slice(-12)}`.slice(0, 100);
}

type Sent = {
  transferId: string | null;
  fee: number;
  status: 'success' | 'pending' | 'exists';
};

async function sendTransfer(
  order: RefundableOrder,
  tx: JekoTransaction,
  amount: number
): Promise<Sent | { manual: string }> {
  const config = jekoConfig();
  if (!config) return { manual: 'Jèko non configuré' };
  const method = toTransferMethod(tx.paymentMethod);
  if (!method) {
    return {
      manual: `moyen de paiement non remboursable (${tx.paymentMethod})`,
    };
  }
  const phone = order.customerPhone
    ? normalizeIvorianPhone(order.customerPhone)
    : null;
  if (!phone) return { manual: 'numéro de la commande absent ou invalide' };
  if (amount < minTransferFcfa(method)) {
    return { manual: `montant sous le minimum du transfert (${amount} F)` };
  }

  try {
    const contact = await createJekoContact(config, {
      name: order.customerName?.trim() || 'Client EBA',
      method,
      phoneE164: phone,
    });
    const transfer = await createJekoTransfer(config, {
      contactId: contact.id,
      amountFcfa: amount,
      reference: buildRefundReference(order.reference, tx.transactionId),
      description: `Remboursement commande ${order.reference}`,
    });
    if (transfer.status === 'error') {
      return { manual: 'transfert refusé par l’opérateur' };
    }
    return {
      transferId: transfer.id,
      fee: Math.round(transfer.feeFcfa),
      status: transfer.status,
    };
  } catch (err) {
    // 409 : ce transfert existe déjà (livraison rejouée) — il est parti, on n'en
    // recrée pas un second.
    if (err instanceof JekoApiError && err.status === 409) {
      return { transferId: null, fee: 0, status: 'exists' };
    }
    console.error(`[jeko] remboursement de ${order.reference} échoué :`, err);
    return {
      manual:
        err instanceof JekoApiError && err.code === 'insufficient_balance'
          ? 'solde Jèko insuffisant : le recharger'
          : err instanceof Error
            ? err.message
            : 'erreur inconnue',
    };
  }
}

export async function refundLatePayment(
  order: RefundableOrder,
  tx: JekoTransaction,
  why: string
): Promise<RefundOutcome> {
  const amount = tx.amountFcfa - (order.onlineFee ?? 0);
  const sent = await sendTransfer(order, tx, amount);

  // L'argent est bien arrivé chez Jèko : on le trace (solde Jèko) que le
  // remboursement soit parti ou non. Le transfert part AVANT cette écriture ; un
  // plantage entre les deux se rattrape au rejeu (409 → « déjà parti »).
  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentTransactionId: tx.transactionId,
      paymentRequestId: tx.paymentRequestId ?? undefined,
      gatewayFee: Math.round(tx.gatewayFeeFcfa),
      ...('manual' in sent
        ? {}
        : {
            refundTransferId: sent.transferId,
            refundedAt: new Date(),
            refundAmount: amount,
            refundFee: sent.fee,
          }),
    },
  });

  await recordAutoLateRefund({
    orderId: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    channel: jekoMethodToPaymentMode(tx.paymentMethod),
    amount,
    result:
      'manual' in sent
        ? { kind: 'failed', reason: sent.manual }
        : sent.status === 'exists' || !sent.transferId
          ? { kind: 'exists' }
          : {
              kind: 'sent',
              status: sent.status,
              transferId: sent.transferId,
              fee: sent.fee,
            },
  }).catch((err) => {
    console.error('[jeko] trace du remboursement échouée :', err);
  });

  if ('manual' in sent) {
    alertStaff(
      order.id,
      order.dailyNumber,
      `Payée en retard (${tx.amountFcfa} F), ${why}. Remboursement automatique impossible (${sent.manual}) : rembourser ${amount} F depuis le Dashboard Jèko.`
    );
    return 'manual';
  }

  alertStaff(
    order.id,
    order.dailyNumber,
    `Payée en retard (${tx.amountFcfa} F), ${why} : ${amount} F remboursés automatiquement.`
  );
  // Transfert encore en cours : le client est prévenu quand il aboutit
  // (lib/refunds/on-paid.ts).
  if (sent.status === 'success') notifyOrderCustomer(order.id, 'REFUNDED');
  return 'refunded';
}
