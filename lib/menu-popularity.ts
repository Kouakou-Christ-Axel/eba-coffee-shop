// lib/menu-popularity.ts
//
// Preuve sociale de la carte publique. Agrège les quantités vendues par
// produit sur une fenêtre glissante (`POPULARITY_WINDOW_DAYS`) pour en tirer un
// classement, et n'en publie que le RANG (« #1 le plus commandé »).
//
// Le volume de ventes reste interne à ce module : il sert à trier et à écarter
// les rangs non significatifs, il n'est jamais posé sur le produit public (cf.
// `Product.popularRank` dans config/menu.ts).
//
// Volontairement SÉPARÉ de `getMenu()` : le scan des commandes est bien plus
// lourd que la lecture du menu, et `/api/menu` (rafraîchi toutes les 60 s,
// appelé par le panier) n'en a pas besoin. La page `/carte` — en ISR 5 min —
// est la seule à payer ce coût, via `attachPopularity()`.

import prisma from '@/lib/prisma';
import type { MenuCategory } from '@/config/menu';
import type { CartItemInput } from '@/lib/schemas/order';
import { todayDailyDate } from '@/lib/daily-numbering';
import {
  POPULARITY_MIN_ORDERS,
  POPULARITY_RANKED_COUNT,
  POPULARITY_WINDOW_DAYS,
} from '@/config/constants';

export type ProductPopularity = {
  /** Quantité vendue sur la fenêtre. */
  orderCount: number;
  /** Rang au classement des ventes (1 = le plus vendu), tous produits confondus. */
  rank: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Quantités vendues par `productId` sur les `POPULARITY_WINDOW_DAYS` derniers
 * jours civils (Abidjan), commandes annulées exclues.
 */
export async function getProductPopularity(): Promise<
  Map<string, ProductPopularity>
> {
  const to = todayDailyDate();
  const from = new Date(to.getTime() - (POPULARITY_WINDOW_DAYS - 1) * DAY_MS);

  const orders = await prisma.order.findMany({
    where: { dailyDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
    select: { items: true },
  });

  const sold = new Map<string, number>();
  for (const order of orders) {
    const items = (order.items as unknown as CartItemInput[]) ?? [];
    for (const item of items) {
      sold.set(item.productId, (sold.get(item.productId) ?? 0) + item.quantity);
    }
  }

  const ranked = [...sold.entries()].sort((a, b) => b[1] - a[1]);

  const popularity = new Map<string, ProductPopularity>();
  ranked.forEach(([productId, orderCount], index) => {
    popularity.set(productId, { orderCount, rank: index + 1 });
  });
  return popularity;
}

/**
 * Fusionne le rang de vente dans un menu public. Deux garde-fous pour que le
 * badge « #N » garde sa valeur de raccourci de décision :
 *   - en dessous de `POPULARITY_MIN_ORDERS` ventes, aucun rang n'est posé — un
 *     « #1 le plus commandé » adossé à 3 ventes ment au client ;
 *   - seuls les `POPULARITY_RANKED_COUNT` premiers sont marqués (un « #14 » ne
 *     vend rien).
 *
 * La quantité vendue n'est jamais recopiée sur le produit : voir l'en-tête.
 */
export function attachPopularity(
  menu: MenuCategory[],
  popularity: Map<string, ProductPopularity>
): MenuCategory[] {
  return menu.map((category) => ({
    ...category,
    products: category.products.map((product) => {
      const stats = popularity.get(product.id);
      if (!stats || stats.orderCount < POPULARITY_MIN_ORDERS) return product;
      if (stats.rank > POPULARITY_RANKED_COUNT) return product;
      return { ...product, popularRank: stats.rank };
    }),
  }));
}

/** Menu public enrichi de la preuve sociale — dégrade en menu nu si l'agrégation échoue. */
export async function getMenuWithPopularity(
  menu: MenuCategory[]
): Promise<MenuCategory[]> {
  try {
    return attachPopularity(menu, await getProductPopularity());
  } catch (err) {
    // La preuve sociale est un bonus commercial : elle ne doit jamais
    // empêcher la carte de s'afficher.
    console.error('[getMenuWithPopularity]', err);
    return menu;
  }
}
