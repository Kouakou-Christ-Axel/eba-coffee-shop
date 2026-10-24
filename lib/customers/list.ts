import type { Customer } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { searchCustomers } from '@/lib/customer-search';
import { ORDERS_PAGE_SIZE } from '@/config/constants';
import type {
  CustomerStats,
  CustomerSortKey,
  SortDir,
  RankedCustomer,
} from './types';
import { statsByCustomer, ZERO_STATS } from './stats';

type WithOptionalStats = RankedCustomer & { stats?: CustomerStats };

export function compareCustomers(sort: CustomerSortKey, dir: SortDir) {
  const mul = dir === 'asc' ? 1 : -1;
  return (a: WithOptionalStats, b: WithOptionalStats) => {
    switch (sort) {
      case 'name':
        return (a.name ?? '').localeCompare(b.name ?? '', 'fr') * mul;
      case 'ordersCount':
        return (
          ((a.stats?.ordersCount ?? 0) - (b.stats?.ordersCount ?? 0)) * mul
        );
      case 'totalSpent':
        return ((a.stats?.totalSpent ?? 0) - (b.stats?.totalSpent ?? 0)) * mul;
      case 'lastOrderAt': {
        const at = a.stats?.lastOrderAt?.getTime() ?? 0;
        const bt = b.stats?.lastOrderAt?.getTime() ?? 0;
        return (at - bt) * mul;
      }
    }
  };
}

const STATS_SORT_KEYS: readonly CustomerSortKey[] = [
  'ordersCount',
  'totalSpent',
  'lastOrderAt',
];

/**
 * Liste paginée des clients.
 *
 * Les stats (agrégats sur les commandes) sont coûteuses : elles ne sont
 * calculées que si `withStats` est demandé, ou si le tri porte sur une stat
 * (il faut alors classer TOUS les candidats). Sinon `stats` vaut `null` et la
 * page les charge à part via `GET /api/customers/stats` : la liste et la
 * recherche ne dépendent plus d'une agrégation sur toute la base.
 */
export async function listCustomers({
  search,
  page = 1,
  sort,
  dir = 'desc',
  withStats = false,
}: {
  search?: string;
  page?: number;
  sort?: CustomerSortKey;
  dir?: SortDir;
  withStats?: boolean;
}) {
  const pageSize = ORDERS_PAGE_SIZE;
  const skip = (page - 1) * pageSize;
  const term = search?.trim();
  const sortsOnStats = sort !== undefined && STATS_SORT_KEYS.includes(sort);

  let customers: Customer[];
  let total: number;
  let pageStats: Map<string, CustomerStats> | null = null;

  if (!term && !sortsOnStats) {
    const orderBy =
      sort === 'name' ? { name: dir } : ({ createdAt: 'desc' } as const);
    [customers, total] = await Promise.all([
      prisma.customer.findMany({ orderBy, skip, take: pageSize }),
      prisma.customer.count(),
    ]);
  } else {
    const allCandidates = await prisma.customer.findMany({
      select: { id: true, name: true, phone: true },
    });
    // Recherche floue (lib/customer-search.ts) : classe par pertinence,
    // conservée telle quelle tant qu'aucun tri explicite n'est demandé.
    let candidates: RankedCustomer[] = term
      ? searchCustomers(allCandidates, term)
      : allCandidates;

    if (sortsOnStats) {
      const stats = await statsByCustomer(candidates.map((c) => c.id));
      const ranked = candidates.map((c) => ({
        ...c,
        stats: stats.get(c.id) ?? ZERO_STATS,
      }));
      ranked.sort(compareCustomers(sort, dir));
      candidates = ranked;
      pageStats = stats;
    } else if (sort === 'name') {
      candidates = [...candidates].sort(compareCustomers('name', dir));
    }

    total = candidates.length;
    const pageIds = candidates.slice(skip, skip + pageSize).map((c) => c.id);
    const rows = pageIds.length
      ? await prisma.customer.findMany({ where: { id: { in: pageIds } } })
      : [];
    const byId = new Map(rows.map((c) => [c.id, c]));
    customers = pageIds
      .map((id) => byId.get(id))
      .filter((c): c is Customer => c != null);
  }

  const stats =
    pageStats ??
    (withStats ? await statsByCustomer(customers.map((c) => c.id)) : null);
  const rows = customers.map((c) => ({
    ...c,
    stats: stats ? (stats.get(c.id) ?? ZERO_STATS) : null,
  }));

  return { customers: rows, total, pageSize };
}
