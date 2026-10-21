// Mutations de commandes — avoir (pont entre lib/credits et les erreurs de commande).

import type { Prisma } from '@/generated/prisma/client';
import { CreditError } from '@/lib/credits/errors';
import {
  creditAmountOf,
  restoreOrderCredit,
  setOrderCredit,
} from '@/lib/credits/spend';
import { OrderMutationError } from './errors';

async function asOrderError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CreditError) {
      throw new OrderMutationError(err.message, err.httpStatus);
    }
    throw err;
  }
}

/**
 * À l'encaissement : aligne l'avoir débité sur la ou les lignes `AVOIR` du
 * paiement (règle d'usage imposée ici, pas par le navigateur).
 */
export function applyPaymentCredit(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    customerId: string | null;
    total: number;
    creditApplied: number;
  },
  lines: { mode: string; amount: number }[],
  actorId?: string | null
): Promise<void> {
  return asOrderError(() =>
    setOrderCredit(tx, {
      orderId: order.id,
      customerId: order.customerId,
      total: order.total,
      current: order.creditApplied,
      wanted: creditAmountOf(lines),
      actorId,
    })
  );
}

/** Rend l'avoir retenu (dépaiement, annulation). */
export function releaseOrderCredit(
  tx: Prisma.TransactionClient,
  orderId: string,
  actorId?: string | null
): Promise<number> {
  return asOrderError(() => restoreOrderCredit(tx, orderId, actorId));
}

/**
 * Reprise d'une commande annulée : l'avoir rendu à l'annulation est de nouveau
 * débité, à hauteur de ses paiements `AVOIR` (refusé si le solde ne suit plus).
 */
export async function reapplyOrderCredit(
  tx: Prisma.TransactionClient,
  orderId: string,
  actorId?: string | null
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      total: true,
      creditApplied: true,
      payments: {
        where: { mode: 'AVOIR' },
        select: { mode: true, amount: true },
      },
    },
  });
  if (!order || order.creditApplied > 0 || order.payments.length === 0) return;
  await applyPaymentCredit(tx, order, order.payments, actorId);
}
