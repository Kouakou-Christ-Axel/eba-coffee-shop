// lib/jeko/start-payment.ts
//
// Démarrer ou RELANCER le paiement Jèko d'une commande en attente. Chaque
// tentative :
//   - numérote sa référence (`<commande>-<n>`, cf. reference.ts) : Jèko refuse une
//     référence déjà utilisée (409) ;
//   - relance le délai de paiement (`PAYMENT_EXPIRY_MINUTES`) ;
//   - réclame la commande de façon ATOMIQUE, gardée sur `isPaid:false`, statut NEW
//     et échéance non dépassée : un double clic ou un paiement concurrent ne crée
//     pas une seconde demande pour une commande déjà réglée.
// Le montant facturé est toujours `total + onlineFee`, lus en base : le navigateur
// n'intervient pas.

import prisma from '@/lib/prisma';
import { PAYMENT_EXPIRY_MINUTES } from '@/config/constants';
import {
  createJekoPaymentRequest,
  type JekoConfig,
  type JekoPaymentMethod,
} from './client';
import { buildJekoReference } from './reference';

export type PaymentNotPendingReason =
  | 'not_found'
  | 'not_online'
  | 'already_paid'
  | 'cancelled'
  | 'expired'
  | 'conflict';

export class PaymentNotPendingError extends Error {
  constructor(readonly reason: PaymentNotPendingReason) {
    super(`Commande non payable en ligne : ${reason}`);
    this.name = 'PaymentNotPendingError';
  }
}

export async function startJekoPayment(args: {
  orderId: string;
  paymentMethod: JekoPaymentMethod;
  config: JekoConfig;
  /** Racine publique du site, sans slash final (cf. `siteUrl()`). */
  siteUrl: string;
  now?: Date;
}): Promise<{ redirectUrl: string; expiresAt: Date }> {
  const { orderId, paymentMethod, config, siteUrl } = args;
  const now = args.now ?? new Date();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      reference: true,
      isPaid: true,
      status: true,
      total: true,
      onlineFee: true,
      paymentExpiresAt: true,
    },
  });
  if (!order) throw new PaymentNotPendingError('not_found');
  // `paymentExpiresAt` remis à nul (rupture de stock après paiement, cf.
  // settle.ts) : la commande n'attend plus de paiement en ligne.
  if (order.onlineFee === null || order.paymentExpiresAt === null) {
    throw new PaymentNotPendingError('not_online');
  }
  if (order.isPaid) throw new PaymentNotPendingError('already_paid');
  if (order.status !== 'NEW') throw new PaymentNotPendingError('cancelled');
  if (order.paymentExpiresAt <= now)
    throw new PaymentNotPendingError('expired');

  const expiresAt = new Date(now.getTime() + PAYMENT_EXPIRY_MINUTES * 60_000);
  // Réclamation ET lecture du numéro de tentative en une seule requête : relire
  // après coup laisserait deux démarrages concurrents obtenir le même numéro,
  // donc la même référence (409 chez Jèko).
  let paymentAttempts: number;
  try {
    ({ paymentAttempts } = await prisma.order.update({
      where: {
        id: order.id,
        isPaid: false,
        status: 'NEW',
        paymentExpiresAt: { gt: now },
      },
      data: {
        paymentAttempts: { increment: 1 },
        paymentExpiresAt: expiresAt,
        // Figé à la tentative : `total` peut changer ensuite (annulation par le
        // client), alors que ce montant est celui que Jèko encaissera.
        paymentAmountDue: order.total + order.onlineFee,
      },
      select: { paymentAttempts: true },
    }));
  } catch (err) {
    // P2025 : aucune ligne ne satisfait plus la garde (payée, annulée, échue).
    if (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === 'P2025'
    ) {
      throw new PaymentNotPendingError('conflict');
    }
    throw err;
  }

  const request = await createJekoPaymentRequest(config, {
    reference: buildJekoReference(order.reference, paymentAttempts),
    amountFcfa: order.total + order.onlineFee,
    paymentMethod,
    successUrl: `${siteUrl}/commande/${order.id}?paiement=ok`,
    errorUrl: `${siteUrl}/commande/${order.id}?paiement=echec`,
  });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentRequestId: request.id,
      paymentRequestIds: { push: request.id },
    },
  });

  return { redirectUrl: request.redirectUrl, expiresAt };
}
