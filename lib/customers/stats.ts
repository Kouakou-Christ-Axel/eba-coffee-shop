import { Prisma } from '@/generated/prisma/client';
import type { CustomerStats } from './types';

export const ZERO_STATS: CustomerStats = {
  ordersCount: 0,
  totalSpent: 0,
  lastOrderAt: null,
};

/**
 * Colonnes de stats à ajouter au `SELECT` quand `STATS_JOIN` (filter.ts) est
 * présent. `totalSpent` est net des remboursements payés.
 */
export const STATS_COLUMNS = Prisma.sql`
  COALESCE(s.orders, 0)::int AS "ordersCount",
  (COALESCE(s.gross, 0) - COALESCE(rf.refunded, 0))::int AS "totalSpent",
  s.last_order AS "lastOrderAt"`;
