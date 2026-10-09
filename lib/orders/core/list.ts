import { withStaffVisible } from '@/lib/orders/visibility';
import {
  type OrderStatus,
  type PaymentMode,
  Prisma,
} from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { parseOrderSearchTerm } from '@/lib/orders/search';
import { ORDERS_PAGE_SIZE, PHONE_SEARCH_MIN_DIGITS } from '@/config/constants';

/** Filtre paiement : `unpaid` (non encaissée) ou un mode précis. */
export type PaymentFilter = 'unpaid' | PaymentMode;

/** Tri de la liste des commandes (list-only, hors export). */
export type OrderSort =
  | 'recent'
  | 'oldest'
  | 'total_desc'
  | 'total_asc'
  | 'number';

export interface ListOrdersParams {
  page: number;
  status?: OrderStatus;
  /** Filtre par plage de jours civils (dailyDate à 00:00 local, inclusif). */
  dateFrom?: Date;
  dateTo?: Date;
  /** Recherche plein texte sur référence, nom, téléphone et n° du jour. */
  search?: string;
  /** Filtre par état/moyen de paiement. */
  payment?: PaymentFilter;
  /** Ordre de tri (défaut : `recent`). */
  sort?: OrderSort;
}

/** Filtres partagés liste + export (le tri reste propre à la liste). */
export type OrderFilters = Omit<ListOrdersParams, 'page' | 'sort'>;

/** Construit le `where` Prisma partagé entre la liste paginée et l'export. */
export function buildOrdersWhere({
  status,
  dateFrom,
  dateTo,
  search,
  payment,
}: OrderFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status;

  if (payment === 'unpaid') {
    where.isPaid = false;
  } else if (payment) {
    where.isPaid = true;
    where.paymentMode = payment;
  }

  if (dateFrom || dateTo) {
    where.dailyDate = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  const parsed = search ? parseOrderSearchTerm(search) : null;
  if (parsed) {
    const or: Prisma.OrderWhereInput[] = [
      { reference: { contains: parsed.raw, mode: 'insensitive' } },
      { customerName: { contains: parsed.raw, mode: 'insensitive' } },
    ];
    // Téléphone : on compare les CHIFFRES BRUTS du terme, pas le terme brut.
    // « 07 88 12 » ne matchait rien contre un « +22507881234567 » stocké.
    if (parsed.digits.length >= PHONE_SEARCH_MIN_DIGITS) {
      or.push({ customerPhone: { contains: parsed.digits } });
    }
    // Terme purement numérique → match exact du n° du jour (#003 → 3).
    if (parsed.dailyNumber !== null) {
      or.push({ dailyNumber: parsed.dailyNumber });
    }
    where.OR = or;
  }

  return where;
}

/** Mappe un tri vers la clause `orderBy` Prisma correspondante. */
export const ORDER_BY: Record<
  OrderSort,
  Prisma.OrderOrderByWithRelationInput | Prisma.OrderOrderByWithRelationInput[]
> = {
  recent: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  total_desc: { total: 'desc' },
  total_asc: { total: 'asc' },
  // dailyNumber repart à 1 chaque jour → trier d'abord par jour.
  number: [{ dailyDate: 'desc' }, { dailyNumber: 'desc' }],
};

export async function listOrders({ page, sort, ...filters }: ListOrdersParams) {
  const pageSize = ORDERS_PAGE_SIZE;
  const skip = (page - 1) * pageSize;
  const where = buildOrdersWhere(filters);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: withStaffVisible(where),
      orderBy: ORDER_BY[sort ?? 'recent'],
      skip,
      take: pageSize,
    }),
    prisma.order.count({ where: withStaffVisible(where) }),
  ]);

  return { orders, total, pageSize };
}

/** Récupère toutes les commandes correspondant aux filtres (sans pagination), pour l'export CSV. */
export async function getOrdersForExport(filters: OrderFilters) {
  return prisma.order.findMany({
    where: withStaffVisible(buildOrdersWhere(filters)),
    orderBy: { createdAt: 'asc' },
  });
}
