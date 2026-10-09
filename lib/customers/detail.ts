import { withStaffVisible } from '@/lib/orders/visibility';
import prisma from '@/lib/prisma';
import { customerPhoneKey } from '@/lib/phone';
import type { OrderItemLike, CustomerDetailStats } from './types';

/** Détail d'un client + ses commandes récentes. */
export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return null;

  const [orders, agg, cancelledCount, itemsRows] = await Promise.all([
    prisma.order.findMany({
      where: withStaffVisible({ customerId: id }),
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.order.aggregate({
      where: withStaffVisible({ customerId: id, status: { not: 'CANCELLED' } }),
      _count: true,
      _sum: { total: true },
      _max: { createdAt: true },
      _min: { createdAt: true },
    }),
    prisma.order.count({
      where: withStaffVisible({ customerId: id, status: 'CANCELLED' }),
    }),
    // Requête à part (juste `items`) pour le produit favori : évite de
    // recharger les commandes complètes déjà limitées à 50 lignes ci-dessus.
    prisma.order.findMany({
      where: withStaffVisible({ customerId: id, status: { not: 'CANCELLED' } }),
      select: { items: true },
    }),
  ]);

  const qtyByProduct = new Map<string, number>();
  for (const row of itemsRows) {
    const items = Array.isArray(row.items)
      ? (row.items as OrderItemLike[])
      : [];
    for (const it of items) {
      if (typeof it.productName !== 'string') continue;
      const quantity = typeof it.quantity === 'number' ? it.quantity : 1;
      qtyByProduct.set(
        it.productName,
        (qtyByProduct.get(it.productName) ?? 0) + quantity
      );
    }
  }
  let favoriteProduct: { name: string; quantity: number } | null = null;
  for (const [name, quantity] of qtyByProduct) {
    if (!favoriteProduct || quantity > favoriteProduct.quantity) {
      favoriteProduct = { name, quantity };
    }
  }

  const totalOrdersEver = agg._count + cancelledCount;
  const stats: CustomerDetailStats = {
    ordersCount: agg._count,
    totalSpent: agg._sum.total ?? 0,
    lastOrderAt: agg._max.createdAt ?? null,
    firstOrderAt: agg._min.createdAt ?? null,
    cancelledCount,
    cancellationRate:
      totalOrdersEver > 0 ? cancelledCount / totalOrdersEver : 0,
    favoriteProduct,
  };

  return { customer, orders, stats };
}

/** Recherche d'un client par téléphone (clé canonique). */
export async function getCustomerByPhone(rawPhone: string) {
  const key = customerPhoneKey(rawPhone);
  if (!key) return null;
  return prisma.customer.findUnique({ where: { phone: key } });
}
