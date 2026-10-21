// lib/refunds/cap.ts
//
// Plafond remboursable d'une commande : ce qui a réellement été encaissé
// (`OrderPayment`, frais en ligne exclus d'office : `OrderPayment.amount` =
// `total`) moins les remboursements actifs. Ne pas se fier à `Order.total` : un
// acompte, ou une commande dépayée, change le payé réel.

import type { Prisma } from '@/generated/prisma/client';
import { ACTIVE_REFUND_STATUSES } from '@/lib/schemas/refund';

export async function getRefundCap(
  tx: Prisma.TransactionClient,
  orderId: string,
  opts: { excludeRefundId?: string } = {}
): Promise<{ paid: number; used: number; remaining: number }> {
  const [paidAgg, usedAgg] = await Promise.all([
    // Une part payée par avoir n'est pas de l'argent encaissé : elle se rend en
    // avoir, jamais en espèces/Jèko.
    tx.orderPayment.aggregate({
      where: { orderId, mode: { not: 'AVOIR' } },
      _sum: { amount: true },
    }),
    tx.refund.aggregate({
      where: {
        orderId,
        status: { in: ACTIVE_REFUND_STATUSES },
        ...(opts.excludeRefundId ? { id: { not: opts.excludeRefundId } } : {}),
      },
      _sum: { amount: true },
    }),
  ]);
  const paid = paidAgg._sum.amount ?? 0;
  const used = usedAgg._sum.amount ?? 0;
  return { paid, used, remaining: Math.max(0, paid - used) };
}
