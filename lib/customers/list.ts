import prisma from '@/lib/prisma';
import { ORDERS_PAGE_SIZE } from '@/config/constants';
import type { CustomerSortKey, SortDir } from './types';
import { queryCustomerPage, STATS_SORT_KEYS } from './page-query';
import { statsByCustomer, ZERO_STATS } from './stats';

/**
 * Liste paginée des clients. Recherche, tri et pagination sont faits par la base
 * (cf. `page-query.ts`) ; seuls les ≤ `ORDERS_PAGE_SIZE` clients de la page sont
 * ensuite lus en entier.
 *
 * Les stats (agrégats sur les commandes) ne sont chargées que si `withStats` est
 * demandé ou si le tri porte sur une stat. Sinon `stats` vaut `null` et la page
 * les charge à part via `GET /api/customers/stats`.
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
  const { ids, total } = await queryCustomerPage({
    term: search?.trim() || undefined,
    sort,
    dir,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const wantStats = withStats || (sort && STATS_SORT_KEYS.includes(sort));
  const [found, stats] = await Promise.all([
    prisma.customer.findMany({ where: { id: { in: ids } } }),
    wantStats ? statsByCustomer(ids) : null,
  ]);
  const byId = new Map(found.map((c) => [c.id, c]));
  const customers = ids.flatMap((id) => {
    const c = byId.get(id);
    return c
      ? [{ ...c, stats: stats ? (stats.get(id) ?? ZERO_STATS) : null }]
      : [];
  });

  return { customers, total, pageSize };
}
