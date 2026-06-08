// lib/customers.ts
//
// Lecture des clients (CRM). Les stats (nb commandes, total dépensé, dernière
// commande) sont calculées à la volée depuis les commandes liées — pas de
// compteur dénormalisé à maintenir.

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { customerPhoneKey } from '@/lib/phone';
import { ORDERS_PAGE_SIZE } from '@/config/constants';

export type CustomerStats = {
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
};

/** Stats agrégées (commandes liées) pour un ensemble d'ids client. */
async function statsByCustomer(
  ids: string[]
): Promise<Map<string, CustomerStats>> {
  if (ids.length === 0) return new Map();
  const grouped = await prisma.order.groupBy({
    by: ['customerId'],
    where: { customerId: { in: ids } },
    _count: true,
    _sum: { total: true },
    _max: { createdAt: true },
  });
  return new Map(
    grouped.map((g) => [
      g.customerId as string,
      {
        ordersCount: g._count,
        totalSpent: g._sum.total ?? 0,
        lastOrderAt: g._max.createdAt ?? null,
      },
    ])
  );
}

export async function listCustomers({
  search,
  page = 1,
}: {
  search?: string;
  page?: number;
}) {
  const pageSize = ORDERS_PAGE_SIZE;
  const skip = (page - 1) * pageSize;

  const where: Prisma.CustomerWhereInput = {};
  const term = search?.trim();
  if (term) {
    const digits = term.replace(/\D/g, '');
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      ...(digits ? [{ phone: { contains: digits } }] : []),
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  const stats = await statsByCustomer(customers.map((c) => c.id));
  const rows = customers.map((c) => ({
    ...c,
    stats: stats.get(c.id) ?? {
      ordersCount: 0,
      totalSpent: 0,
      lastOrderAt: null,
    },
  }));

  return { customers: rows, total, pageSize };
}

/** Détail d'un client + ses commandes récentes. */
export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return null;

  const [orders, agg] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.order.aggregate({
      where: { customerId: id },
      _count: true,
      _sum: { total: true },
      _max: { createdAt: true },
    }),
  ]);

  const stats: CustomerStats = {
    ordersCount: agg._count,
    totalSpent: agg._sum.total ?? 0,
    lastOrderAt: agg._max.createdAt ?? null,
  };

  return { customer, orders, stats };
}

/** Recherche d'un client par téléphone (clé canonique). */
export async function getCustomerByPhone(rawPhone: string) {
  const key = customerPhoneKey(rawPhone);
  if (!key) return null;
  return prisma.customer.findUnique({ where: { phone: key } });
}
