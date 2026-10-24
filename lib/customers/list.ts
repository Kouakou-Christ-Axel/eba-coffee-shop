import type { Customer } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { ORDERS_PAGE_SIZE } from '@/config/constants';
import { customerFilter, type CustomerQuery } from './filter';
import { getPageStats, ZERO_STATS } from './stats';

/**
 * Requête A — fiches des clients de la page décrite par `query` (recherche, tri,
 * pagination faits par la base, cf. `filter.ts`) + total. Indépendante de la
 * requête de stats (`getPageStats`), avec laquelle elle partage le même filtre.
 */
export async function listCustomers(query: CustomerQuery) {
  const { where, from, page } = customerFilter(query);
  const [customers, count] = await Promise.all([
    prisma.$queryRaw<Customer[]>(Prisma.sql`SELECT c.* ${from} ${page}`),
    prisma.$queryRaw<{ total: number }[]>(
      Prisma.sql`SELECT COUNT(*)::int AS total FROM customer c ${where}`
    ),
  ]);
  return {
    customers,
    total: count[0]?.total ?? 0,
    pageSize: ORDERS_PAGE_SIZE,
  };
}

/**
 * Fiches + stats pour les consommateurs qui veulent les deux d'un coup (MCP) :
 * les deux requêtes partent en parallèle puis sont jointes par id.
 */
export async function listCustomersWithStats(query: CustomerQuery) {
  const [list, stats] = await Promise.all([
    listCustomers(query),
    getPageStats(query),
  ]);
  return {
    ...list,
    customers: list.customers.map((c) => ({
      ...c,
      stats: stats[c.id] ?? ZERO_STATS,
    })),
  };
}
