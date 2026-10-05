// lib/jeko/settle.ts
//
// Règlement d'une transaction Jèko réussie (reçue par webhook, ou lue par
// `GET /payment_requests/{id}` lors d'une réconciliation). L'argent a déjà bougé
// chez Jèko : chaque cas limite aboutit à un état que le staff VOIT (push +
// commande), jamais à un paiement perdu en silence.
//
// On encaisse `order.total` (le prix des produits) : les frais en ligne sont
// payés EN PLUS à Jèko, ils ne sont jamais du CA (cf. `Order.onlineFee`).

import prisma from '@/lib/prisma';
import {
  OrderMutationError,
  StockShortageError,
  setOrderPayment,
} from '@/lib/order-mutations';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import { sendPushToRoles } from '@/lib/push-notify';
import { announcePaidOrder } from './notify-paid';
import { jekoMethodToPaymentMode } from './payment-mode';
import { parseJekoReference } from './reference';
import type { JekoTransaction } from './webhook-payload';

export type SettleOutcome =
  | 'paid'
  | 'already_paid'
  | 'duplicate_payment'
  | 'late_payment'
  | 'amount_mismatch'
  | 'shortage'
  | 'ignored';

const ORDER_SELECT = {
  id: true,
  isPaid: true,
  status: true,
  total: true,
  onlineFee: true,
  dailyNumber: true,
  paymentAmountDue: true,
  paymentTransactionId: true,
} as const;

function alertStaff(orderId: string, dailyNumber: number, message: string) {
  sendPushToRoles(ROLE_GROUPS.CASHIER_PLUS, {
    title: `Paiement Jèko — commande #${dailyNumber}`,
    body: message,
    url: `/dashboard/commandes/${orderId}`,
    tag: `jeko-${orderId}`,
  }).catch((err) => {
    console.error('[jeko] alerte staff échouée :', err);
  });
}

export async function settleJekoTransaction(
  tx: JekoTransaction
): Promise<SettleOutcome> {
  // Le webhook ne signale que les succès ; tout autre statut n'est pas à régler.
  if (tx.status !== 'success') return 'ignored';

  const parsed = parseJekoReference(tx.reference);
  if (!parsed) return 'ignored';

  const order = await prisma.order.findUnique({
    where: { reference: parsed.orderReference },
    select: ORDER_SELECT,
  });
  // `onlineFee` nul = commande née hors paiement en ligne : pas la nôtre.
  if (!order || order.onlineFee === null) return 'ignored';

  const fees = {
    gatewayFee: Math.round(tx.gatewayFeeFcfa),
    paymentRequestId: tx.paymentRequestId ?? undefined,
    paymentTransactionId: tx.transactionId,
  };

  if (order.isPaid) {
    // Livraison rejouée après un échec de l'écriture des frais : on la complète.
    if (order.paymentTransactionId === null) {
      await prisma.order.update({ where: { id: order.id }, data: fees });
      return 'already_paid';
    }
    // Une AUTRE transaction sur une commande déjà réglée : deux demandes payées
    // (relance, ancien onglet resté ouvert). L'argent est parti deux fois.
    if (order.paymentTransactionId !== tx.transactionId) {
      alertStaff(
        order.id,
        order.dailyNumber,
        `Double paiement en ligne (${tx.amountFcfa} F de plus) : rembourser le client depuis le Dashboard Jèko.`
      );
      return 'duplicate_payment';
    }
    return 'already_paid';
  }

  // Montant FIGÉ à la tentative : `total` peut avoir changé depuis (l'annulation
  // par le client le remet au prix brut) alors que la demande déjà envoyée à Jèko,
  // elle, ne change pas.
  const due = order.paymentAmountDue ?? order.total + order.onlineFee;
  if (tx.amountFcfa !== due) {
    console.error(
      `[jeko] montant reçu ${tx.amountFcfa} F ≠ dû ${due} F (commande ${parsed.orderReference})`
    );
    // On sort la commande de l'attente : sinon l'expiration la reprendrait à
    // chaque passage (relecture Jèko, nouvelle alerte), sans jamais l'annuler.
    // Elle devient une commande normale que le staff voit et tranche.
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentExpiresAt: null },
    });
    alertStaff(
      order.id,
      order.dailyNumber,
      `Montant reçu ${tx.amountFcfa} F au lieu de ${due} F : commande non encaissée, à vérifier.`
    );
    return 'amount_mismatch';
  }

  const lines = [
    { mode: jekoMethodToPaymentMode(tx.paymentMethod), amount: order.total },
  ];
  let shortage = false;
  try {
    try {
      await setOrderPayment(order.id, true, lines, null);
    } catch (err) {
      if (!(err instanceof StockShortageError)) throw err;
      // Rupture entre la création et le paiement : le client a payé, la commande
      // ne peut pas partir en cuisine. L'argent est bien là : on l'enregistre
      // (sans cuisine) pour que la commande, le solde Jèko et la clôture restent
      // justes. Le staff la lance ensuite par le flux habituel, en confirmant la
      // production (`coverShortage`).
      shortage = true;
      await setOrderPayment(order.id, true, lines, null, {
        skipKitchen: true,
      });
    }
  } catch (err) {
    // Deux livraisons simultanées : la seconde trouve la commande déjà payée.
    if (err instanceof OrderMutationError && err.httpStatus === 409) {
      const fresh = await prisma.order.findUnique({
        where: { reference: parsed.orderReference },
        select: ORDER_SELECT,
      });
      if (fresh?.isPaid) return 'already_paid';
    }
    // Toute autre erreur remonte : le webhook répond 500 et Jèko réessaie.
    throw err;
  }

  // Le paiement est enregistré. Le staff est prévenu AVANT l'écriture des frais :
  // si celle-ci échoue (le webhook répond alors 500 et Jèko rejoue), la livraison
  // rejouée la complète sans réannoncer, et la commande n'a pas été manquée.
  //
  // Commande annulée ou expirée avant l'arrivée du paiement : encaissé, mais pas
  // remis en cuisine. Le staff la reprend par le flux existant (qui restitue le
  // tampon) ou la rembourse — on ne reconsomme pas une récompense à l'aveugle.
  const late = order.status === 'CANCELLED';
  if (shortage) {
    alertStaff(
      order.id,
      order.dailyNumber,
      `Payée en ligne (${tx.amountFcfa} F) mais stock insuffisant : à lancer en cuisine après avoir confirmé la production. Ne pas la refaire payer.`
    );
  } else if (late) {
    alertStaff(
      order.id,
      order.dailyNumber,
      `Payée en ligne (${tx.amountFcfa} F) après annulation ou expiration : rétablir ou rembourser.`
    );
  } else {
    // Commande normale, désormais payée : c'est maintenant que le staff l'apprend
    // (elle était invisible tant qu'elle attendait). Sans attendre : la réponse au
    // webhook ne dépend ni du push ni du courriel.
    void announcePaidOrder(order.id).catch((err) => {
      console.error('[jeko] annonce de la commande payée échouée :', err);
    });
  }

  await prisma.order.update({ where: { id: order.id }, data: fees });
  if (shortage) return 'shortage';
  return late ? 'late_payment' : 'paid';
}
