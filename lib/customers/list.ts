import type { Customer } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { ORDERS_PAGE_SIZE } from '@/config/constants';
import { customerFilter, type CustomerQuery } from './filter';
import { STATS_COLUMNS } from './stats';
import type { CustomerStats } from './types';

type StatsColumns = CustomerStats;

/**
 * Clients de la page décrite par `query` + total. Recherche, tri et pagination
 * sont faits par la base (cf. `filter.ts`) : une requête pour les lignes, une
 * pour le total.
 *
 * `withStats` ajoute à chaque client ses chiffres (`stats` : commandes, total net
 * des remboursements, dernière commande) dans LA MÊME requête, par jointure sur
 * des agrégats de commandes. Sans lui `stats` vaut `null` et la jointure n'est
 * faite que si le tri porte sur une stat (la recherche de la caisse reste légère).
 */
export async function listCustomers(
  query: CustomerQuery,
  { withStats = false }: { withStats?: boolean } = {}
) {
  const { where, from, page } = customerFilter(query, { withStats });
  const [rows, count] = await Promise.all([
    prisma.$queryRaw<(Customer & Partial<StatsColumns>)[]>(
      Prisma.sql`SELECT c.*${withStats ? Prisma.sql`, ${STATS_COLUMNS}` : Prisma.empty}
        ${from} ${page}`
    ),
    prisma.$queryRaw<{ total: number }[]>(
      Prisma.sql`SELECT COUNT(*)::int AS total FROM customer c ${where}`
    ),
  ]);
  const customers = rows.map(
    ({ ordersCount, totalSpent, lastOrderAt, ...c }) => ({
      ...(c as Customer),
      stats: withStats
        ? ({
            ordersCount: ordersCount ?? 0,
            totalSpent: totalSpent ?? 0,
            lastOrderAt: lastOrderAt ?? null,
          } satisfies CustomerStats)
        : null,
    })
  );
  return { customers, total: count[0]?.total ?? 0, pageSize: ORDERS_PAGE_SIZE };
}
