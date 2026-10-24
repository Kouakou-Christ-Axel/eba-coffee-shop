// Sélection d'une page de clients directement en SQL : recherche, tri et
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
import { foldText } from '@/lib/text';
import type { CustomerSortKey, SortDir } from './types';

export const STATS_SORT_KEYS: readonly CustomerSortKey[] = [
  'ordersCount',
  'totalSpent',
  'lastOrderAt',
];

// Repli des accents côté SQL, symétrique de `foldText` : « Hélène » se trouve
// avec « helene ». (Pas d'extension `unaccent` à installer.)
const ACCENTS = 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ';
const ACCENTS_FOLDED = [...ACCENTS].map(foldText).join('');
const FOLDED_NAME = Prisma.sql`translate(lower(coalesce(c.name, '')), ${ACCENTS}, ${ACCENTS_FOLDED})`;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

/** Tous les mots (dans n'importe quel ordre) dans le nom, OU les chiffres dans le téléphone. */
function searchClause(term: string) {
  const tokens = foldText(term).split(/\s+/).filter(Boolean);
  const digits = term.replace(/\D/g, '');
  const byName = Prisma.join(
    tokens.map(
      (t) => Prisma.sql`${FOLDED_NAME} LIKE ${`%${escapeLike(t)}%`} ESCAPE '\\'`
    ),
    ' AND '
  );
  const byPhone = digits
    ? Prisma.sql` OR c.phone LIKE ${`%${digits}%`}`
    : Prisma.empty;
  return Prisma.sql`WHERE (${byName})${byPhone}`;
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

function orderBy(sort: CustomerSortKey | undefined, dir: SortDir) {
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
      return Prisma.sql`ORDER BY ${tieBreak}`;
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
  const where = term ? searchClause(term) : Prisma.empty;
  const join =
    sort && STATS_SORT_KEYS.includes(sort) ? STATS_JOIN : Prisma.empty;

  const [rows, count] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM customer c ${join} ${where}
      ${orderBy(sort, dir)} LIMIT ${take} OFFSET ${skip}`,
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM customer c ${where}`,
  ]);
  return { ids: rows.map((r) => r.id), total: count[0]?.total ?? 0 };
}
