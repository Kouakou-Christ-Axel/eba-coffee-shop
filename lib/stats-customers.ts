// lib/stats-customers.ts
//
// Agrégats clients & fidélité sur une plage de jours civils (page Statistiques
// + outil MCP). Les commandes sont bornées par Order.dailyDate ; les événements
// horodatés (Customer.createdAt, LoyaltyLedger.createdAt) par l'intervalle
// d'instants équivalent [from 00:00, to+1j 00:00[ (Abidjan = UTC+0).

import prisma from '@/lib/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

export type TopCustomer = {
  customerId: string;
  name: string | null;
  phone: string;
  orders: number;
  revenue: number;
};

export type CustomerRangeStats = {
  /** Clients créés sur la période (Customer.createdAt). */
  newCustomers: number;
  /** Clients distincts ayant au moins 1 commande non annulée sur la période. */
  activeCustomers: number;
  /** Clients avec ≥ 2 commandes non annulées sur la période. */
  returningCustomers: number;
  /** Commandes non annulées rattachées à un client. */
  identifiedOrders: number;
  /** identifiedOrders / commandes non annulées (0..1, 0 si aucune commande). */
  identificationRate: number;
  /** Meilleurs clients de la période, triés par CA décroissant. */
  topCustomers: TopCustomer[];
  loyalty: {
    /** Tampons gagnés (somme des deltas STAMP_EARNED). */
    stampsEarned: number;
    /** Récompenses débloquées (nb d'événements REWARD_EARNED). */
    rewardsEarned: number;
    /** Récompenses utilisées (nb d'événements REWARD_USED). */
    rewardsUsed: number;
    /** Ajustements manuels de tampons (somme signée des deltas ADJUSTMENT). */
    adjustmentStamps: number;
  };
};

/**
 * Stats clients & fidélité sur `[from, to]` (jours civils inclus).
 * Convention CA client : somme des `total` hors CANCELLED, sans condition
 * `isPaid` — cohérent avec `statsByCustomer` (lib/customers.ts), qui mesure
 * l'activité du client plutôt que l'encaissement.
 */
export async function getCustomerRangeStats(
  from: Date,
  to: Date,
  topLimit = 5
): Promise<CustomerRangeStats> {
  const toExclusive = new Date(to.getTime() + DAY_MS);
  const orderWhere = {
    dailyDate: { gte: from, lte: to },
    status: { not: 'CANCELLED' as const },
  };

  const [newCustomers, grouped, totalOrders, ledger] = await Promise.all([
    prisma.customer.count({
      where: { createdAt: { gte: from, lt: toExclusive } },
    }),
    prisma.order.groupBy({
      by: ['customerId'],
      where: { ...orderWhere, customerId: { not: null } },
      _count: true,
      _sum: { total: true },
    }),
    prisma.order.count({ where: orderWhere }),
    prisma.loyaltyLedger.groupBy({
      by: ['type'],
      where: { createdAt: { gte: from, lt: toExclusive } },
      _count: true,
      _sum: { stamps: true },
    }),
  ]);

  const identifiedOrders = grouped.reduce((s, g) => s + g._count, 0);
  const top = [...grouped]
    .sort((a, b) => (b._sum.total ?? 0) - (a._sum.total ?? 0))
    .slice(0, topLimit);

  const names = await prisma.customer.findMany({
    where: { id: { in: top.map((g) => g.customerId as string) } },
    select: { id: true, name: true, phone: true },
  });
  const nameById = new Map(names.map((c) => [c.id, c]));

  const ledgerByType = new Map(
    ledger.map((l) => [l.type, { count: l._count, stamps: l._sum.stamps ?? 0 }])
  );

  return {
    newCustomers,
    activeCustomers: grouped.length,
    returningCustomers: grouped.filter((g) => g._count >= 2).length,
    identifiedOrders,
    identificationRate: totalOrders > 0 ? identifiedOrders / totalOrders : 0,
    topCustomers: top.map((g) => {
      const c = nameById.get(g.customerId as string);
      return {
        customerId: g.customerId as string,
        name: c?.name ?? null,
        phone: c?.phone ?? '—',
        orders: g._count,
        revenue: g._sum.total ?? 0,
      };
    }),
    loyalty: {
      stampsEarned: ledgerByType.get('STAMP_EARNED')?.stamps ?? 0,
      rewardsEarned: ledgerByType.get('REWARD_EARNED')?.count ?? 0,
      rewardsUsed: ledgerByType.get('REWARD_USED')?.count ?? 0,
      adjustmentStamps: ledgerByType.get('ADJUSTMENT')?.stamps ?? 0,
    },
  };
}
