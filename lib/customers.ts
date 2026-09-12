// lib/customers.ts
//
// Lecture des clients (CRM). Les stats (nb commandes, total dépensé, dernière
// commande) sont calculées à la volée depuis les commandes liées — pas de
// compteur dénormalisé à maintenir.

import type { Customer } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { customerPhoneKey } from '@/lib/phone';
import { searchCustomers } from '@/lib/customer-search';
import { ORDERS_PAGE_SIZE } from '@/config/constants';

export type CustomerStats = {
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
};

export type CustomerListSummary = {
  totalClients: number;
  /** Fiches créées sur les 7 / 30 derniers jours (Customer.createdAt). */
  newLast7Days: number;
  newLast30Days: number;
  /** CA cumulé (commandes non annulées rattachées à un client) et panier moyen associé. */
  revenueTotal: number;
  ordersCount: number;
  averageBasket: number;
  /** Segmentation par ancienneté de la dernière commande non annulée. */
  active30Days: number;
  active60Days: number;
  active90Days: number;
  inactiveOver90Days: number;
  /** Clients n'ayant jamais commandé (fiche créée sans commande liée). */
  neverOrdered: number;
};

/** Stats agrégées (commandes liées) pour un ensemble d'ids client. */
async function statsByCustomer(
  ids: string[]
): Promise<Map<string, CustomerStats>> {
  if (ids.length === 0) return new Map();
  const grouped = await prisma.order.groupBy({
    by: ['customerId'],
    where: { customerId: { in: ids }, status: { not: 'CANCELLED' } },
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

export type CustomerSortKey =
  | 'name'
  | 'ordersCount'
  | 'totalSpent'
  | 'lastOrderAt';
export type SortDir = 'asc' | 'desc';

const ZERO_STATS: CustomerStats = {
  ordersCount: 0,
  totalSpent: 0,
  lastOrderAt: null,
};

type RankedCustomer = { id: string; name: string | null; phone: string };

/** Comparateur de tri, appliqué en JS sur l'ensemble des candidats (cf. plus bas). */
function compareCustomers(sort: CustomerSortKey, dir: SortDir) {
  const mul = dir === 'asc' ? 1 : -1;
  return (
    a: RankedCustomer & { stats: CustomerStats },
    b: RankedCustomer & { stats: CustomerStats }
  ) => {
    switch (sort) {
      case 'name':
        return (a.name ?? '').localeCompare(b.name ?? '', 'fr') * mul;
      case 'ordersCount':
        return (a.stats.ordersCount - b.stats.ordersCount) * mul;
      case 'totalSpent':
        return (a.stats.totalSpent - b.stats.totalSpent) * mul;
      case 'lastOrderAt': {
        const at = a.stats.lastOrderAt?.getTime() ?? 0;
        const bt = b.stats.lastOrderAt?.getTime() ?? 0;
        return (at - bt) * mul;
      }
    }
  };
}

export async function listCustomers({
  search,
  page = 1,
  sort,
  dir = 'desc',
}: {
  search?: string;
  page?: number;
  sort?: CustomerSortKey;
  dir?: SortDir;
}) {
  const pageSize = ORDERS_PAGE_SIZE;
  const skip = (page - 1) * pageSize;
  const term = search?.trim();

  let customers: Customer[];
  let total: number;
  // Stats déjà connues pour les lignes de la page (calculées pendant le tri
  // ci-dessous) : évite de les recalculer une seconde fois quand on est
  // passés par le chemin recherche/tri.
  let pageStats: Map<string, CustomerStats> | null = null;

  // Chemin rapide : ni recherche, ni tri (ou tri par nom, qu'on peut déléguer
  // à la base) — pagination `skip/take` directement en base, sans charger
  // toute la table.
  if (!term && (!sort || sort === 'name')) {
    const orderBy =
      sort === 'name' ? { name: dir } : ({ createdAt: 'desc' } as const);
    [customers, total] = await Promise.all([
      prisma.customer.findMany({ orderBy, skip, take: pageSize }),
      prisma.customer.count(),
    ]);
  } else {
    // Recherche floue et/ou tri sur une stat calculée (commandes, total
    // acheté, dernière commande) : ces colonnes n'existent pas en base, donc
    // impossible de les déléguer à un `ORDER BY` SQL. On charge l'ensemble
    // minimal des clients (candidats), on calcule leurs stats en une seule
    // requête groupée, on trie/pagine en JS, puis on ne recharge les lignes
    // complètes QUE pour la page affichée.
    const allCandidates = await prisma.customer.findMany({
      select: { id: true, name: true, phone: true },
    });
    // Recherche floue (lib/customer-search.ts) : classe par pertinence,
    // conservée telle quelle tant qu'aucun tri explicite n'est demandé.
    const candidates: RankedCustomer[] = term
      ? searchCustomers(allCandidates, term)
      : allCandidates;

    const stats = await statsByCustomer(candidates.map((c) => c.id));
    const ranked = candidates.map((c) => ({
      ...c,
      stats: stats.get(c.id) ?? ZERO_STATS,
    }));
    if (sort) ranked.sort(compareCustomers(sort, dir));

    total = ranked.length;
    const pageSlice = ranked.slice(skip, skip + pageSize);
    pageStats = new Map(pageSlice.map((c) => [c.id, c.stats]));

    const pageIds = pageSlice.map((c) => c.id);
    const rows = pageIds.length
      ? await prisma.customer.findMany({ where: { id: { in: pageIds } } })
      : [];
    const byId = new Map(rows.map((c) => [c.id, c]));
    customers = pageIds
      .map((id) => byId.get(id))
      .filter((c): c is Customer => c != null);
  }

  const stats =
    pageStats ?? (await statsByCustomer(customers.map((c) => c.id)));
  const rows = customers.map((c) => ({
    ...c,
    stats: stats.get(c.id) ?? ZERO_STATS,
  }));

  return { customers: rows, total, pageSize };
}

/** Ligne d'article telle que stockée dans `Order.items` (cf. lib/schemas/order.ts). */
type OrderItemLike = { productName?: unknown; quantity?: unknown };

export type CustomerDetailStats = CustomerStats & {
  /** Date de la première commande non annulée (ancienneté d'achat). */
  firstOrderAt: Date | null;
  cancelledCount: number;
  /** Part des commandes annulées sur l'ensemble des commandes du client (0..1). */
  cancellationRate: number;
  /** Article le plus commandé en quantité cumulée (commandes non annulées). */
  favoriteProduct: { name: string; quantity: number } | null;
};

/** Détail d'un client + ses commandes récentes. */
export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return null;

  const [orders, agg, cancelledCount, itemsRows] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.order.aggregate({
      where: { customerId: id, status: { not: 'CANCELLED' } },
      _count: true,
      _sum: { total: true },
      _max: { createdAt: true },
      _min: { createdAt: true },
    }),
    prisma.order.count({ where: { customerId: id, status: 'CANCELLED' } }),
    // Requête à part (juste `items`) pour le produit favori : évite de
    // recharger les commandes complètes déjà limitées à 50 lignes ci-dessus.
    prisma.order.findMany({
      where: { customerId: id, status: { not: 'CANCELLED' } },
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

/**
 * Synthèse pour l'en-tête de la liste `/dashboard/clients` : indépendante de
 * la recherche/pagination (toujours calculée sur l'ensemble des clients),
 * pour rester stable pendant que le tableau se filtre.
 */
export async function getCustomerListSummary(): Promise<CustomerListSummary> {
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const [totalClients, newLast7Days, newLast30Days, agg, grouped] =
    await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({
        where: { createdAt: { gte: new Date(now - 7 * DAY_MS) } },
      }),
      prisma.customer.count({
        where: { createdAt: { gte: new Date(now - 30 * DAY_MS) } },
      }),
      prisma.order.aggregate({
        where: { customerId: { not: null }, status: { not: 'CANCELLED' } },
        _count: true,
        _sum: { total: true },
      }),
      prisma.order.groupBy({
        by: ['customerId'],
        where: { customerId: { not: null }, status: { not: 'CANCELLED' } },
        _max: { createdAt: true },
      }),
    ]);

  // Tranches disjointes (pas cumulatives) : chaque client compte dans une
  // seule case, sur l'ancienneté de sa DERNIÈRE commande non annulée.
  let active30Days = 0;
  let active60Days = 0;
  let active90Days = 0;
  let inactiveOver90Days = 0;
  for (const g of grouped) {
    const last = g._max.createdAt;
    if (!last) continue;
    const ageDays = (now - last.getTime()) / DAY_MS;
    if (ageDays <= 30) active30Days += 1;
    else if (ageDays <= 60) active60Days += 1;
    else if (ageDays <= 90) active90Days += 1;
    else inactiveOver90Days += 1;
  }

  const ordersCount = agg._count;
  const revenueTotal = agg._sum.total ?? 0;

  return {
    totalClients,
    newLast7Days,
    newLast30Days,
    revenueTotal,
    ordersCount,
    averageBasket: ordersCount > 0 ? Math.round(revenueTotal / ordersCount) : 0,
    active30Days,
    active60Days,
    active90Days,
    inactiveOver90Days,
    neverOrdered: totalClients - grouped.length,
  };
}

/** Recherche d'un client par téléphone (clé canonique). */
export async function getCustomerByPhone(rawPhone: string) {
  const key = customerPhoneKey(rawPhone);
  if (!key) return null;
  return prisma.customer.findUnique({ where: { phone: key } });
}
