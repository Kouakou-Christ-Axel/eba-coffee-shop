// Filtre d'une page de clients, en SQL : recherche (pg_trgm), tri et pagination
// se font dans PostgreSQL, jamais en mémoire (`list.ts` : une requête pour les
// lignes — chiffres par client inclus —, une pour le total). Ici, la sélection de
// la page ; les chiffres sont joints ensuite aux seules lignes retenues.

import { Prisma } from '@/generated/prisma/client';
import { trgmSearch } from '@/lib/search/trgm';
import { ORDERS_PAGE_SIZE } from '@/config/constants';
import type { CustomerSortKey, SortDir } from './types';
import { COUNTED_ORDER, REFUND_DEDUCTED } from './stats-rules';

export const STATS_SORT_KEYS: readonly CustomerSortKey[] = [
  'ordersCount',
  'totalSpent',
  'lastOrderAt',
];

/**
 * Nom (similarité trigramme, cf. lib/search/trgm.ts) OU chiffres saisis dans le
 * téléphone. Un téléphone qui correspond classe en tête (score 1).
 */
function searchClause(term: string) {
  const byName = trgmSearch(term, [{ sql: Prisma.sql`c.name` }]);
  const digits = term.replace(/\D/g, '');
  const byPhone = digits
    ? Prisma.sql`c.phone LIKE ${`%${digits}%`}::text`
    : null;
  const clauses = [byName?.where && Prisma.sql`(${byName.where})`, byPhone];
  const where = Prisma.join(
    clauses.filter((c): c is Prisma.Sql => c != null),
    ' OR '
  );
  const score = Prisma.sql`GREATEST(${byName?.score ?? Prisma.sql`0::float8`}, ${
    byPhone
      ? Prisma.sql`CASE WHEN ${byPhone} THEN 1::float8 ELSE 0::float8 END`
      : Prisma.sql`0::float8`
  })`;
  return { where: Prisma.sql`WHERE ${where}`, score };
}

// Agrégats de commandes et de remboursements de TOUS les clients (règles :
// stats-rules.ts). Joints seulement quand le tri porte sur une stat : il faut alors
// classer tous les clients. Sinon, les chiffres sont calculés pour la seule page
// (`STATS_LATERAL`, stats.ts).
const STATS_JOIN = Prisma.sql`
  LEFT JOIN (
    SELECT o."customerId", COUNT(*)::int AS orders, SUM(o.total)::int AS gross,
           MAX(o."createdAt") AS last_order
    FROM "order" o
    WHERE o."customerId" IS NOT NULL AND ${COUNTED_ORDER}
    GROUP BY o."customerId"
  ) s ON s."customerId" = c.id
  LEFT JOIN (
    SELECT r."customerId", SUM(r.amount)::int AS refunded
    FROM refund r JOIN "order" ro ON ro.id = r."orderId"
    WHERE r."customerId" IS NOT NULL AND ${REFUND_DEDUCTED}
    GROUP BY r."customerId"
  ) rf ON rf."customerId" = c.id`;

function orderBy(
  sort: CustomerSortKey | undefined,
  dir: SortDir,
  relevance?: Prisma.Sql
) {
  const d = dir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const tieBreak = Prisma.sql`c."createdAt" DESC, c.id`;
  switch (sort) {
    case 'name':
      return Prisma.sql`ORDER BY c.name ${d} NULLS LAST, ${tieBreak}`;
    case 'ordersCount':
      return Prisma.sql`ORDER BY COALESCE(s.orders, 0) ${d}, ${tieBreak}`;
    case 'totalSpent':
      return Prisma.sql`ORDER BY (COALESCE(s.gross, 0) - COALESCE(rf.refunded, 0)) ${d}, ${tieBreak}`;
    case 'lastOrderAt':
      return Prisma.sql`ORDER BY s.last_order ${d} NULLS LAST, ${tieBreak}`;
    default:
      return relevance
        ? Prisma.sql`ORDER BY ${relevance} DESC, ${tieBreak}`
        : Prisma.sql`ORDER BY ${tieBreak}`;
  }
}

/** Paramètres de la page : ceux de l'URL (cf. `clients/search-params.ts`). */
export type CustomerQuery = {
  search?: string;
  page?: number;
  sort?: CustomerSortKey;
  dir?: SortDir;
};

/**
 * Fragments SQL du filtre : `where` (le total), `from` (+ agrégats de tous les
 * clients SI le tri porte sur une stat), `orderBy` et `limit` (la page). `orderBy`
 * est exposé à part parce que `list.ts` le rejoue après avoir joint les chiffres.
 */
export function customerFilter({
  search: term,
  page = 1,
  sort,
  dir = 'desc',
}: CustomerQuery) {
  const search = term?.trim() ? searchClause(term.trim()) : null;
  const where = search?.where ?? Prisma.empty;
  const join =
    sort && STATS_SORT_KEYS.includes(sort) ? STATS_JOIN : Prisma.empty;
  const skip = (Math.max(1, page) - 1) * ORDERS_PAGE_SIZE;
  return {
    where,
    from: Prisma.sql`FROM customer c ${join} ${where}`,
    orderBy: orderBy(sort, dir, search?.score),
    limit: Prisma.sql`LIMIT ${ORDERS_PAGE_SIZE} OFFSET ${skip}`,
  };
}
