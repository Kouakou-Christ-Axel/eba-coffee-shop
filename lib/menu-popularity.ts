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
  aggregatePortionCombos,
  attachPortionCombos,
} from '@/lib/portion-combos';
import {
  POPULARITY_MIN_ORDERS,
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
  return computePopularity(await fetchRecentOrderItems());
}

/**
 * Lignes de commande de la fenêtre, à plat. Un SEUL scan sert les deux
 * enrichissements de la carte (rang de vente et répartitions populaires) : ils
 * lisent la même table sur la même période, les faire séparément doublerait le
 * coût à chaque régénération ISR.
 */
export async function fetchRecentOrderItems(): Promise<CartItemInput[]> {
  const to = todayDailyDate();
  const from = new Date(to.getTime() - (POPULARITY_WINDOW_DAYS - 1) * DAY_MS);

  const orders = await prisma.order.findMany({
    where: { dailyDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
    select: { items: true },
  });

  return orders.flatMap(
    (order) => (order.items as unknown as CartItemInput[]) ?? []
  );
}

/**
 * Classement des ventes à partir de lignes déjà chargées.
 *
 * `eligibleIds` restreint le classement aux produits ENCORE proposés. Sans lui,
 * les rangs sont attribués sur tout l'historique : un best-seller depuis
 * désactivé consomme un rang et le prive d'un produit visible. Constaté en
 * production — 4 des 10 meilleures ventes étaient désactivées, et le rang 2
 * tombait sur un produit absent de la carte.
 */
export function computePopularity(
  items: CartItemInput[],
  eligibleIds?: Set<string>
): Map<string, ProductPopularity> {
  const sold = new Map<string, number>();
  for (const item of items) {
    if (eligibleIds && !eligibleIds.has(item.productId)) continue;
    sold.set(item.productId, (sold.get(item.productId) ?? 0) + item.quantity);
  }

  const ranked = [...sold.entries()].sort((a, b) => b[1] - a[1]);

  const popularity = new Map<string, ProductPopularity>();
  ranked.forEach(([productId, orderCount], index) => {
    popularity.set(productId, { orderCount, rank: index + 1 });
  });
  return popularity;
}

/**
 * Fusionne le rang de vente dans un menu public. Un seul garde-fou ici : en
 * dessous de `POPULARITY_MIN_ORDERS` ventes aucun rang n'est posé — un
 * « #1 le plus commandé » adossé à 3 ventes ment au client.
 *
 * Le rang est posé sur TOUS les produits qui passent ce seuil, pas seulement
 * sur les premiers : c'est un ordre de tri autant qu'un label. Le plafond
 * d'affichage du badge (`POPULARITY_RANKED_COUNT`) est appliqué plus tard, à la
 * présentation (`productBadgeLabel`) — un « #14 » ne vend rien en badge, mais
 * il reste une information utile pour classer la vitrine.
 *
 * Séparer les deux évite le défaut d'origine : la vitrine ne se remplissait que
 * des produits BADGÉS, donc au plus trois, et elle disparaissait dès qu'un seul
 * d'entre eux était indisponible.
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
      return { ...product, popularRank: stats.rank };
    }),
  }));
}

/** Identifiants des produits présents dans un menu public. */
function menuProductIds(menu: MenuCategory[]): Set<string> {
  return new Set(
    menu.flatMap((category) => category.products.map((p) => p.id))
  );
}

/**
 * Menu public enrichi des deux signaux tirés de l'historique : rang de vente et
 * répartitions de parts les plus choisies. Un seul scan des commandes pour les
 * deux (voir `fetchRecentOrderItems`).
 *
 * Dégrade en menu nu si l'agrégation échoue : ce sont des bonus commerciaux,
 * ils ne doivent jamais empêcher la carte de s'afficher.
 */
export async function getMenuWithPopularity(
  menu: MenuCategory[]
): Promise<MenuCategory[]> {
  try {
    const items = await fetchRecentOrderItems();
    // Classement restreint aux produits de la carte : un best-seller désactivé
    // ne doit pas consommer un rang au détriment d'un produit commandable.
    const popularity = computePopularity(items, menuProductIds(menu));
    return attachPortionCombos(
      attachPopularity(menu, popularity),
      aggregatePortionCombos(menu, items)
    );
  } catch (err) {
    console.error('[getMenuWithPopularity]', err);
    return menu;
  }
}
