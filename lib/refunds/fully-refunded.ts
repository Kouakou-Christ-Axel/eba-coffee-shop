// lib/refunds/fully-refunded.ts
//
// « Remboursée en totalité » : les remboursements PAID couvrent tout ce qui a été
// encaissé. Une commande dans ce cas, non récupérée, n'a plus rien à préparer ni à
// encaisser : elle quitte la file caisse et la file cuisine (la commande elle-même
// n'est jamais modifiée, cf. CLAUDE.md « Remboursements »).

import prisma from '@/lib/prisma';

/** Pur : vrai quand `refunded` couvre `paid` (et qu'il y avait bien un encaissement). */
export function isFullyCovered(paid: number, refunded: number): boolean {
  return paid > 0 && refunded >= paid;
}

/**
 * Parmi `orderIds`, ceux remboursés en totalité. Deux requêtes groupées pour toute
 * la file (pas de N+1) ; la seconde n'est lancée que s'il y a au moins un
 * remboursement versé.
 */
export async function fullyRefundedOrderIds(
  orderIds: string[]
): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set();

  const refunded = await prisma.refund.groupBy({
    by: ['orderId'],
    where: { orderId: { in: orderIds }, status: 'PAID' },
    _sum: { amount: true },
  });
  if (refunded.length === 0) return new Set();

  const paid = await prisma.orderPayment.groupBy({
    by: ['orderId'],
    where: { orderId: { in: refunded.map((r) => r.orderId) } },
    _sum: { amount: true },
  });
  const paidByOrder = new Map(paid.map((p) => [p.orderId, p._sum.amount ?? 0]));

  return new Set(
    refunded
      .filter((r) =>
        isFullyCovered(paidByOrder.get(r.orderId) ?? 0, r._sum.amount ?? 0)
      )
      .map((r) => r.orderId)
  );
}
