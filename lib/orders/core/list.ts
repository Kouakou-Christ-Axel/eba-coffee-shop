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

// `STAFF_VISIBLE` cache les commandes en ligne jamais payées (en attente ou
// abandonnées) des files ACTIVES — caisse, cuisine, stats — où une commande
// fantôme n'a rien à faire. Mais le filtre « Annulées » de cette liste est un
// historique explicite : une commande Jèko expirée (jamais payée, annulée par
// `expirePendingOrders`) EST une commande annulée, et masquer précisément
// celles-là de l'onglet qui les cherche n'a pas de sens. Aucune autre valeur de
// `status` ne change rien : les commandes encore `NEW`/en attente restent cachées
// partout ailleurs.
function applyVisibility(
  where: Prisma.OrderWhereInput,
  status: OrderStatus | undefined
): Prisma.OrderWhereInput {
  return status === 'CANCELLED' ? where : withStaffVisible(where);
}

export async function listOrders({ page, sort, ...filters }: ListOrdersParams) {
  const pageSize = ORDERS_PAGE_SIZE;
  const skip = (page - 1) * pageSize;
  const where = buildOrdersWhere(filters);
  const visibleWhere = applyVisibility(where, filters.status);

  const [orders, total] = await Promise.all([
    // staff-visibility: exempt — passe par applyVisibility, qui applique withStaffVisible
    // sauf pour le filtre `status=CANCELLED` (voir le commentaire sur applyVisibility).
    prisma.order.findMany({
      where: visibleWhere,
      orderBy: ORDER_BY[sort ?? 'recent'],
      skip,
      take: pageSize,
    }),
    // staff-visibility: exempt — idem, cf. applyVisibility.
    prisma.order.count({ where: visibleWhere }),
  ]);

  return { orders, total, pageSize };
}

/** Récupère toutes les commandes correspondant aux filtres (sans pagination), pour l'export CSV. */
export async function getOrdersForExport(filters: OrderFilters) {
  // staff-visibility: exempt — passe par applyVisibility, cf. ce même commentaire plus haut.
  return prisma.order.findMany({
    where: applyVisibility(buildOrdersWhere(filters), filters.status),
    orderBy: { createdAt: 'asc' },
  });
}
