// lib/credits/offer.ts
//
// Ce que l'avoir du client peut couvrir sur une commande, pour l'afficher à
// l'encaissement. Le serveur ré-applique la même règle à l'écriture
// (`setOrderCredit`) : ce montant n'est qu'une proposition.

import prisma from '@/lib/prisma';
import { getCreditSettings } from '@/lib/credit-settings-db';
import { computeCreditApplication } from './apply';

export type CreditOffer = {
  /** Solde d'avoir du client (FCFA), y compris ce que la commande retient déjà. */
  balance: number;
  /** Montant applicable à cette commande selon la règle (0 = rien à proposer). */
  applicable: number;
};

export async function getOrderCreditOffer(
  orderId: string
): Promise<CreditOffer> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      total: true,
      depositPaid: true,
      isPaid: true,
      status: true,
      creditApplied: true,
      customer: { select: { creditBalance: true } },
    },
  });
  if (!order?.customer || order.isPaid || order.status === 'CANCELLED') {
    return { balance: 0, applicable: 0 };
  }
  const balance = order.customer.creditBalance + order.creditApplied;
  const settings = await getCreditSettings();
  const due = order.total - (order.depositPaid ?? 0);
  const applicable = Math.min(
    due,
    computeCreditApplication({ balance, total: order.total, settings })
  );
  return { balance, applicable };
}
