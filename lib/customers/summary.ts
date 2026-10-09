import { withStaffVisible } from '@/lib/orders/visibility';
import prisma from '@/lib/prisma';
import type { CustomerListSummary } from './types';

export async function getCustomerListSummary(): Promise<CustomerListSummary> {
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const [totalClients, newLast7Days, newLast30Days, agg, grouped] =
    await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({
        where: { createdAt: { gte: new Date(now - 7 * DAY_MS) } },
      }),
      prisma.customer.count({
        where: { createdAt: { gte: new Date(now - 30 * DAY_MS) } },
      }),
      prisma.order.aggregate({
        where: withStaffVisible({
          customerId: { not: null },
          status: { not: 'CANCELLED' },
        }),
        _count: true,
        _sum: { total: true },
      }),
      prisma.order.groupBy({
        by: ['customerId'],
        where: withStaffVisible({
          customerId: { not: null },
          status: { not: 'CANCELLED' },
        }),
        _max: { createdAt: true },
      }),
    ]);

  // Tranches disjointes (pas cumulatives) : chaque client compte dans une
  // seule case, sur l'ancienneté de sa DERNIÈRE commande non annulée.
  let active30Days = 0;
  let active60Days = 0;
  let active90Days = 0;
  let inactiveOver90Days = 0;
  for (const g of grouped) {
    const last = g._max.createdAt;
    if (!last) continue;
    const ageDays = (now - last.getTime()) / DAY_MS;
    if (ageDays <= 30) active30Days += 1;
    else if (ageDays <= 60) active60Days += 1;
    else if (ageDays <= 90) active90Days += 1;
    else inactiveOver90Days += 1;
  }

  const ordersCount = agg._count;
  const revenueTotal = agg._sum.total ?? 0;

  return {
    totalClients,
    newLast7Days,
    newLast30Days,
    revenueTotal,
    ordersCount,
    averageBasket: ordersCount > 0 ? Math.round(revenueTotal / ordersCount) : 0,
    active30Days,
    active60Days,
    active90Days,
    inactiveOver90Days,
    neverOrdered: totalClients - grouped.length,
  };
}
