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
  JekoApiError,
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

/** Demandes à interroger : toutes les tentatives, la plus récente d'abord. */
export function requestIdsToCheck(order: {
  paymentRequestId: string | null;
  paymentRequestIds: string[];
}): string[] {
  const ids = new Set<string>();
  if (order.paymentRequestId) ids.add(order.paymentRequestId);
  for (const id of [...order.paymentRequestIds].reverse()) ids.add(id);
  return [...ids];
}

/**
 * Interroge chaque tentative de la commande et règle la première qui a réussi
 * (un paiement peut aboutir sur une tentative antérieure à la dernière). Une
 * demande inconnue de Jèko (404) est ignorée ; toute autre panne remonte.
 * Renvoie le règlement éventuel et l'état de la demande la plus récente.
 */
export async function settleOrderRequests(
  order: { paymentRequestId: string | null; paymentRequestIds: string[] },
  config: JekoConfig
): Promise<{
  settled: SettleOutcome | 'unreadable' | null;
  latest: RemoteRequest | null;
}> {
  let latest: RemoteRequest | null = null;
  let unreadable = false;
  for (const id of requestIdsToCheck(order)) {
    const remote = await getJekoPaymentRequest(config, id).catch((err) => {
      if (err instanceof JekoApiError && err.status === 404) return null;
      throw err;
    });
    if (!remote) continue;
    latest ??= remote;
    if (remote.status !== 'success') continue;
    const outcome = await settleFromRemote(remote);
    if (outcome !== 'unreadable') return { settled: outcome, latest };
    unreadable = true;
  }
  return { settled: unreadable ? 'unreadable' : null, latest };
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
    select: { isPaid: true, paymentRequestId: true, paymentRequestIds: true },
  });
  if (!order) throw new PaymentNotPendingError('not_found');
  if (order.isPaid) return { status: 'success', errorReason: null };
  if (requestIdsToCheck(order).length === 0) {
    throw new PaymentNotPendingError('not_online');
  }

  const { settled, latest } = await settleOrderRequests(order, config);
  if (settled && settled !== 'unreadable') {
    return { status: 'success', errorReason: null };
  }
  if (!latest) throw new PaymentNotPendingError('not_online');
  return { status: latest.status, errorReason: latest.errorReason ?? null };
}
