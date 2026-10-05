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
import { getOrderShortage } from '@/lib/order-mutations';
import { isDeferredPickup } from '@/lib/orders/scheduling';
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
  | 'out_of_stock'
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
      pickupTime: true,
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
  // Un article a manqué depuis la création : mieux vaut le dire AVANT que le client
  // paie que de le rembourser après. Une commande différée ne touche pas au stock
  // du jour (il sera produit le jour du retrait).
  if (
    !isDeferredPickup(order.pickupTime, now) &&
    (await getOrderShortage(order.id)).length > 0
  ) {
    throw new PaymentNotPendingError('out_of_stock');
  }

  const expiresAt = new Date(now.getTime() + PAYMENT_EXPIRY_MINUTES * 60_000);
  // Incrément ET relecture dans une même transaction : l'écriture verrouille la
  // ligne, donc deux démarrages simultanés lisent chacun SON numéro de tentative
  // (sinon ils fabriquent la même référence et Jèko refuse le second).
  const paymentAttempts = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: {
        id: order.id,
        isPaid: false,
        status: 'NEW',
        paymentExpiresAt: { gt: now },
      },
      data: {
        paymentAttempts: { increment: 1 },
        paymentExpiresAt: expiresAt,
        // Figé à la tentative : `total` ne doit plus changer ensuite, alors que
        // ce montant est celui que Jèko encaissera.
        paymentAmountDue: order.total + order.onlineFee!,
      },
    });
    if (claimed.count === 0) throw new PaymentNotPendingError('conflict');
    const fresh = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { paymentAttempts: true },
    });
    return fresh.paymentAttempts;
  });

  const request = await createJekoPaymentRequest(config, {
    reference: buildJekoReference(order.reference, paymentAttempts),
    amountFcfa: order.total + order.onlineFee,
    paymentMethod,
    successUrl: `${siteUrl}/commande/${order.id}?paiement=ok`,
    errorUrl: `${siteUrl}/commande/${order.id}?paiement=echec`,
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentRequestId: request.id },
  });

  return { redirectUrl: request.redirectUrl, expiresAt };
}
