// Sélection d'une page de clients directement en SQL : recherche (pg_trgm), tri et
// pagination se font dans PostgreSQL, jamais en mémoire. Renvoie uniquement les
// ids de la page (dans l'ordre) et le total ; les lignes complètes et les stats
// de ces ≤ 20 clients sont lues ensuite (cf. `list.ts`).
//
// Les agrégats de commandes ne sont joints que si le tri en a besoin. Ils
// reprennent à l'identique les règles de `statsByCustomer` (stats.ts) : commandes
// non annulées et visibles du staff (cf. `STAFF_VISIBLE`), total net des
// remboursements PAYÉS hors conversion d'avoir (cf. `refundedByCustomer`).

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { trgmSearch } from '@/lib/search/trgm';
import type { CustomerSortKey, SortDir } from './types';

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

const STATS_JOIN = Prisma.sql`
  LEFT JOIN (
    SELECT "customerId", COUNT(*)::int AS orders, SUM(total)::int AS gross,
           MAX("createdAt") AS last_order
    FROM "order"
    WHERE "customerId" IS NOT NULL AND status <> 'CANCELLED'
      AND ("paymentExpiresAt" IS NULL OR "isPaid")
    GROUP BY "customerId"
  ) s ON s."customerId" = c.id
  LEFT JOIN (
    SELECT r."customerId", SUM(r.amount)::int AS refunded
    FROM refund r JOIN "order" o ON o.id = r."orderId"
    WHERE r.status = 'PAID' AND r."creditSourceId" IS NULL
      AND r."customerId" IS NOT NULL AND o.status <> 'CANCELLED'
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

export async function queryCustomerPage({
  term,
  sort,
  dir,
  skip,
  take,
}: {
  term?: string;
  sort?: CustomerSortKey;
  dir: SortDir;
  skip: number;
  take: number;
}) {
  const search = term ? searchClause(term) : null;
  const where = search?.where ?? Prisma.empty;
  const join =
    sort && STATS_SORT_KEYS.includes(sort) ? STATS_JOIN : Prisma.empty;

  const [rows, count] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM customer c ${join} ${where}
      ${orderBy(sort, dir, search?.score)} LIMIT ${take} OFFSET ${skip}`,
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM customer c ${where}`,
  ]);
  return { ids: rows.map((r) => r.id), total: count[0]?.total ?? 0 };
}
