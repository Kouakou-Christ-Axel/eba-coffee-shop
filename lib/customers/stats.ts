import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { customerFilter, type CustomerQuery } from './filter';
import { COUNTED_ORDER, REFUND_DEDUCTED } from './stats-rules';
import type { CustomerStats } from './types';

export const ZERO_STATS: CustomerStats = {
  ordersCount: 0,
  totalSpent: 0,
  lastOrderAt: null,
};

/**
 * Requête B — stats des clients de la page décrite par `query` (mêmes recherche,
 * tri et pagination que la liste, cf. `filter.ts`), indexées par id.
 *
 * La sélection de la page est une sous-requête de ≤ `ORDERS_PAGE_SIZE` lignes ;
 * les agrégats ne sont calculés que pour elles (une recherche indexée par client
 * chacun), jamais sur tous les clients — sauf si le tri porte sur une stat, où le
 * classement l'exige. `totalSpent` est net des remboursements payés.
 */
export async function getPageStats(
  query: CustomerQuery
): Promise<Record<string, CustomerStats>> {
  const { from, page } = customerFilter(query);
  const rows = await prisma.$queryRaw<
    { id: string; orders: number; net: number; last_order: Date | null }[]
  >(Prisma.sql`
    SELECT p.id, COALESCE(s.orders, 0)::int AS orders,
           (COALESCE(s.gross, 0) - COALESCE(rf.refunded, 0))::int AS net,
           s.last_order
    FROM (SELECT c.id ${from} ${page}) p
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS orders, SUM(o.total)::int AS gross,
             MAX(o."createdAt") AS last_order
      FROM "order" o WHERE o."customerId" = p.id AND ${COUNTED_ORDER}
    ) s ON true
    LEFT JOIN LATERAL (
      SELECT SUM(r.amount)::int AS refunded
      FROM refund r JOIN "order" ro ON ro.id = r."orderId"
      WHERE r."customerId" = p.id AND ${REFUND_DEDUCTED}
    ) rf ON true`);
  return Object.fromEntries(
    rows.map((r) => [
      r.id,
      { ordersCount: r.orders, totalSpent: r.net, lastOrderAt: r.last_order },
    ])
  );
}
