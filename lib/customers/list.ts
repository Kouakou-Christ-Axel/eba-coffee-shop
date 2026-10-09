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

export function compareCustomers(sort: CustomerSortKey, dir: SortDir) {
  const mul = dir === 'asc' ? 1 : -1;
  return (
    a: RankedCustomer & { stats: CustomerStats },
    b: RankedCustomer & { stats: CustomerStats }
  ) => {
    switch (sort) {
      case 'name':
        return (a.name ?? '').localeCompare(b.name ?? '', 'fr') * mul;
      case 'ordersCount':
        return (a.stats.ordersCount - b.stats.ordersCount) * mul;
      case 'totalSpent':
        return (a.stats.totalSpent - b.stats.totalSpent) * mul;
      case 'lastOrderAt': {
        const at = a.stats.lastOrderAt?.getTime() ?? 0;
        const bt = b.stats.lastOrderAt?.getTime() ?? 0;
        return (at - bt) * mul;
      }
    }
  };
}

export async function listCustomers({
  search,
  page = 1,
  sort,
  dir = 'desc',
}: {
  search?: string;
  page?: number;
  sort?: CustomerSortKey;
  dir?: SortDir;
}) {
  const pageSize = ORDERS_PAGE_SIZE;
  const skip = (page - 1) * pageSize;
  const term = search?.trim();

  let customers: Customer[];
  let total: number;
  let pageStats: Map<string, CustomerStats> | null = null;

  if (!term && (!sort || sort === 'name')) {
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
    const candidates: RankedCustomer[] = term
      ? searchCustomers(allCandidates, term)
      : allCandidates;

    const stats = await statsByCustomer(candidates.map((c) => c.id));
    const ranked = candidates.map((c) => ({
      ...c,
      stats: stats.get(c.id) ?? ZERO_STATS,
    }));
    if (sort) ranked.sort(compareCustomers(sort, dir));

    total = ranked.length;
    const pageSlice = ranked.slice(skip, skip + pageSize);
    pageStats = new Map(pageSlice.map((c) => [c.id, c.stats]));

    const pageIds = pageSlice.map((c) => c.id);
    const rows = pageIds.length
      ? await prisma.customer.findMany({ where: { id: { in: pageIds } } })
      : [];
    const byId = new Map(rows.map((c) => [c.id, c]));
    customers = pageIds
      .map((id) => byId.get(id))
      .filter((c): c is Customer => c != null);
  }

  const stats =
    pageStats ?? (await statsByCustomer(customers.map((c) => c.id)));
  const rows = customers.map((c) => ({
    ...c,
    stats: stats.get(c.id) ?? ZERO_STATS,
  }));

  return { customers: rows, total, pageSize };
}
