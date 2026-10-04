// lib/jeko/reconcile.ts
//
// Réconciliation à la demande : on lit la demande de paiement chez Jèko et, si
// elle a réussi, on règle la commande SANS attendre le webhook (Jèko peut mettre
// jusqu'à 5 min à réconcilier). Le webhook reste la source de vérité ; ceci n'en
// est que le filet, et `settleJekoTransaction` est idempotent.
//
// Partagé par le retour du client sur la page de suivi et par l'expiration
// opportuniste (lib/jeko/expiry.ts).

import prisma from '@/lib/prisma';
import {
  getJekoPaymentRequest,
  type JekoConfig,
  type JekoStatus,
} from './client';
import { settleJekoTransaction, type SettleOutcome } from './settle';
import { PaymentNotPendingError } from './start-payment';

type RemoteRequest = Awaited<ReturnType<typeof getJekoPaymentRequest>>;

/**
 * Règle une demande lue chez Jèko et réussie. `unreadable` : Jèko annonce un
 * succès sans détailler la transaction — on ne peut ni régler ni conclure.
 */
export async function settleFromRemote(
  remote: RemoteRequest
): Promise<SettleOutcome | 'unreadable'> {
  if (!remote.reference || remote.amountFcfa === null) return 'unreadable';
  return settleJekoTransaction({
    transactionId: remote.transactionId ?? remote.id,
    status: 'success',
    amountFcfa: remote.amountFcfa,
    gatewayFeeFcfa: remote.gatewayFeeFcfa ?? 0,
    paymentMethod: remote.paymentMethod,
    reference: remote.reference,
    paymentRequestId: remote.id,
  });
}

/**
 * Vérifie le paiement d'une commande auprès de Jèko et le règle s'il a abouti.
 * Renvoie le statut côté Jèko (le client recharge ensuite la commande). Une
 * panne de Jèko remonte : le client réessaiera.
 */
export async function reconcileOrderPayment(
  orderId: string,
  config: JekoConfig
): Promise<{ status: JekoStatus; errorReason: string | null }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { isPaid: true, paymentRequestId: true },
  });
  if (!order) throw new PaymentNotPendingError('not_found');
  if (order.isPaid) return { status: 'success', errorReason: null };
  if (!order.paymentRequestId) throw new PaymentNotPendingError('not_online');

  const remote = await getJekoPaymentRequest(config, order.paymentRequestId);
  if (remote.status === 'success') {
    await settleFromRemote(remote);
  }
  return { status: remote.status, errorReason: remote.errorReason ?? null };
}
