import prisma from '@/lib/prisma';
import { ORDERS_PAGE_SIZE } from '@/config/constants';
import type { CustomerSortKey, CustomerStats, SortDir } from './types';
import { queryCustomerPage } from './page-query';
import { statsByCustomer, ZERO_STATS } from './stats';

type ListArgs = {
  search?: string;
  page?: number;
  sort?: CustomerSortKey;
  dir?: SortDir;
};

/** Ids de la page (dans l'ordre) + total : recherche/tri/pagination en SQL. */
function selectPage({ search, page = 1, sort, dir = 'desc' }: ListArgs) {
  return queryCustomerPage({
    term: search?.trim() || undefined,
    sort,
    dir,
    skip: (page - 1) * ORDERS_PAGE_SIZE,
    take: ORDERS_PAGE_SIZE,
  });
}

/** Fiches complètes des ids, dans l'ordre des ids. */
async function fetchCustomers(ids: string[]) {
  const found = await prisma.customer.findMany({ where: { id: { in: ids } } });
  const byId = new Map(found.map((c) => [c.id, c]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/**
 * Liste paginée des clients. Recherche, tri et pagination sont faits par la base
 * (cf. `page-query.ts`) ; seuls les ≤ `ORDERS_PAGE_SIZE` clients de la page sont
 * ensuite lus en entier. Les stats (agrégats sur les commandes) ne sont chargées
 * que si `withStats` est demandé, EN PARALLÈLE de la lecture des fiches.
 */
export async function listCustomers(args: ListArgs & { withStats?: boolean }) {
  const { ids, total } = await selectPage(args);
  const [found, stats] = await Promise.all([
    fetchCustomers(ids),
    args.withStats ? statsByCustomer(ids) : null,
  ]);
  const customers = found.map((c) => ({
    ...c,
    stats: stats ? (stats.get(c.id) ?? ZERO_STATS) : null,
  }));
  return { customers, total, pageSize: ORDERS_PAGE_SIZE };
}

/**
 * Comme `listCustomers`, mais les stats sont une PROMESSE démarrée en même temps
 * que la lecture des fiches et non attendue : la page peut afficher les fiches
 * dès qu'elles sont prêtes et laisser les stats arriver en streaming
 * (`use()` derrière un `Suspense`). Indexées par id ; `null` si le calcul échoue
 * (les cellules affichent alors « — », la liste n'est pas affectée).
 */
export async function listCustomersWithDeferredStats(args: ListArgs) {
  const { ids, total } = await selectPage(args);
  const stats = statsByCustomer(ids).then(
    (byId): Record<string, CustomerStats> =>
      Object.fromEntries(ids.map((id) => [id, byId.get(id) ?? ZERO_STATS])),
    (err) => {
      console.error('[customers] stats', err);
      return null;
    }
  );
  const customers = await fetchCustomers(ids);
  return { customers, total, pageSize: ORDERS_PAGE_SIZE, stats };
}
