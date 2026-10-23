// lib/refunds/customer.ts
//
// Remboursements à déduire du CA par client. Même convention que
// `statsByCustomer` : les commandes annulées sont exclues du CA client, donc leurs
// remboursements aussi (sinon le client serait compté deux fois en négatif).

import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';

/**
 * Montants remboursés (payés) par client, sur les commandes non annulées qui
 * respectent `orderWhere` (filtre de plage de dates des stats client).
 */
export async function refundedByCustomer(
  customerWhere: Prisma.RefundWhereInput['customerId'],
  orderWhere: Prisma.OrderWhereInput = {}
): Promise<Map<string, number>> {
  const grouped = await prisma.refund.groupBy({
    by: ['customerId'],
    where: {
      status: 'PAID',
      // Une conversion d'avoir ne diminue pas le CA : l'avoir l'a déjà retiré.
      creditSourceId: null,
      customerId: customerWhere,
      order: { ...orderWhere, status: { not: 'CANCELLED' } },
    },
    _sum: { amount: true },
  });
  return new Map(
    grouped
      .filter((g) => g.customerId)
      .map((g) => [g.customerId as string, g._sum.amount ?? 0])
  );
}
