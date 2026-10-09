import { withStaffVisible } from '@/lib/orders/visibility';
import prisma from '@/lib/prisma';
import type { CustomerStats } from './types';

/** Stats agrégées (commandes liées) pour un ensemble d'ids client. */
export async function statsByCustomer(
  ids: string[]
): Promise<Map<string, CustomerStats>> {
  if (ids.length === 0) return new Map();
  const grouped = await prisma.order.groupBy({
    by: ['customerId'],
    where: withStaffVisible({
      customerId: { in: ids },
      status: { not: 'CANCELLED' },
    }),
    _count: true,
    _sum: { total: true },
    _max: { createdAt: true },
  });
  return new Map(
    grouped.map((g) => [
      g.customerId as string,
      {
        ordersCount: g._count,
        totalSpent: g._sum.total ?? 0,
        lastOrderAt: g._max.createdAt ?? null,
      },
    ])
  );
}

export const ZERO_STATS: CustomerStats = {
  ordersCount: 0,
  totalSpent: 0,
  lastOrderAt: null,
};
